-- ===========================================================================
-- Business — player accounts.
-- ===========================================================================
-- Run this ONCE, in the Supabase dashboard: SQL Editor -> New query -> paste
-- -> Run. It is safe to run again; nothing is dropped and nothing is lost.
--
-- ONE EXCEPTION: if `recaptcha.sql` has also been run, running this again
-- puts back the versions of the two functions that know nothing about a
-- captcha, leaving two of each. Run `recaptcha.sql` again afterwards to
-- clear that up.
--
-- Why it is needed at all: until now the game used only Realtime Broadcast,
-- which needs no tables, no SQL and no row-level security. Accounts with a
-- password are the one thing that cannot work that way — a password has to be
-- checked somewhere that is not the player's own browser.
--
-- The shape of it:
--   * The table has row-level security ON and NO policies, so the publishable
--     key that ships in the browser cannot read or write it. Not one row.
--   * The only way in is the three functions below. They run as the owner
--     (`security definer`), so they can touch the table while callers cannot,
--     and each one returns only what the caller is entitled to know.
--   * Passwords are stored as bcrypt hashes (pgcrypto, cost 10) and are never
--     sent back out. The browser never sees a hash and the database never sees
--     a plain password twice.
--   * Ten wrong guesses locks the name for five minutes. The publishable key
--     is public by design, so the sign-in door is public too, and a public
--     door needs a bolt.
-- ===========================================================================

-- pgcrypto gives us bcrypt. Supabase normally has it already, in the
-- `extensions` schema; this installs it there if some project does not.
create extension if not exists pgcrypto with schema extensions;

-- The hashing calls below are deliberately UNQUALIFIED. Every function here
-- pins `search_path = public, extensions`, so `crypt()` is found whichever of
-- the two schemas pgcrypto happens to live in. Writing `extensions.crypt()`
-- would be the better habit in general, but it breaks outright on a project
-- where pgcrypto was installed into `public` instead, and that failure looks
-- like the whole script never having run.

create table if not exists public.business_accounts (
  id             uuid primary key default gen_random_uuid(),
  -- As typed, for showing back to the player.
  username       text        not null,
  -- Folded to lower case, for deciding whether a name is taken. "Aaran" and
  -- "aaran" are the same player, not two.
  username_key   text        not null unique,
  password_hash  text        not null,
  avatar_id      text        not null default 'cat',
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  failed_tries   integer     not null default 0,
  locked_until   timestamptz
);

alter table public.business_accounts enable row level security;

-- Deliberately no policies. See the header: the three functions are the door.
revoke all on table public.business_accounts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Shared checks, so sign-up and sign-in cannot drift apart.
-- ---------------------------------------------------------------------------
create or replace function public.business_name_problem(p_username text)
returns text
language plpgsql
immutable
as $$
declare
  v_key text := lower(trim(coalesce(p_username, '')));
begin
  if length(v_key) < 3  then return 'Pick a username of at least 3 characters.'; end if;
  if length(v_key) > 16 then return 'Usernames can be at most 16 characters.'; end if;
  if v_key !~ '^[a-z0-9_]+$' then return 'Letters, numbers and underscores only.'; end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Create an account.
-- ---------------------------------------------------------------------------
create or replace function public.business_signup(
  p_username text,
  p_password text,
  p_avatar   text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key     text := lower(trim(coalesce(p_username, '')));
  v_problem text := public.business_name_problem(p_username);
  v_row     public.business_accounts;
begin
  if v_problem is not null then
    return json_build_object('ok', false, 'error', v_problem);
  end if;
  if length(coalesce(p_password, '')) < 6 then
    return json_build_object('ok', false, 'error', 'Pick a password of at least 6 characters.');
  end if;
  if exists (select 1 from public.business_accounts where username_key = v_key) then
    return json_build_object('ok', false, 'error', 'That username is already taken.');
  end if;

  insert into public.business_accounts (username, username_key, password_hash, avatar_id)
  values (
    trim(p_username),
    v_key,
    crypt(p_password, gen_salt('bf', 10)),
    coalesce(nullif(trim(coalesce(p_avatar, '')), ''), 'cat')
  )
  returning * into v_row;

  return json_build_object(
    'ok', true, 'username', v_row.username, 'avatar', v_row.avatar_id
  );
exception
  -- Two people claiming one name in the same instant: the unique index wins.
  when unique_violation then
    return json_build_object('ok', false, 'error', 'That username is already taken.');
end $$;

-- ---------------------------------------------------------------------------
-- Sign in.
-- ---------------------------------------------------------------------------
create or replace function public.business_login(
  p_username text,
  p_password text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text := lower(trim(coalesce(p_username, '')));
  v_row public.business_accounts;
begin
  select * into v_row from public.business_accounts where username_key = v_key;

  -- One wording for "no such name" and "wrong password" on purpose: the door
  -- does not tell a stranger which usernames exist.
  if v_row.id is null then
    return json_build_object('ok', false, 'error', 'Wrong username or password.');
  end if;

  if v_row.locked_until is not null and v_row.locked_until > now() then
    return json_build_object(
      'ok', false,
      'error', 'Too many wrong tries. Try again in a few minutes.'
    );
  end if;

  if crypt(coalesce(p_password, ''), v_row.password_hash) <> v_row.password_hash then
    update public.business_accounts
       set failed_tries = failed_tries + 1,
           locked_until = case when failed_tries + 1 >= 10
                               then now() + interval '5 minutes'
                               else null end
     where id = v_row.id;
    return json_build_object('ok', false, 'error', 'Wrong username or password.');
  end if;

  update public.business_accounts
     set failed_tries = 0, locked_until = null, last_seen_at = now()
   where id = v_row.id;

  return json_build_object(
    'ok', true, 'username', v_row.username, 'avatar', v_row.avatar_id
  );
end $$;

-- ---------------------------------------------------------------------------
-- Change the character on an existing account. Needs the password, so a
-- public key alone cannot repaint somebody else's player.
-- ---------------------------------------------------------------------------
create or replace function public.business_set_avatar(
  p_username text,
  p_password text,
  p_avatar   text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text := lower(trim(coalesce(p_username, '')));
  v_row public.business_accounts;
begin
  select * into v_row from public.business_accounts where username_key = v_key;
  if v_row.id is null
     or crypt(coalesce(p_password, ''), v_row.password_hash) <> v_row.password_hash then
    return json_build_object('ok', false, 'error', 'Wrong username or password.');
  end if;

  update public.business_accounts
     set avatar_id = coalesce(nullif(trim(coalesce(p_avatar, '')), ''), avatar_id),
         last_seen_at = now()
   where id = v_row.id
  returning * into v_row;

  return json_build_object('ok', true, 'username', v_row.username, 'avatar', v_row.avatar_id);
end $$;

-- ---------------------------------------------------------------------------
-- Only these three are callable from the browser.
-- ---------------------------------------------------------------------------
revoke all on function public.business_signup(text, text, text)     from public;
revoke all on function public.business_login(text, text)            from public;
revoke all on function public.business_set_avatar(text, text, text) from public;

grant execute on function public.business_signup(text, text, text)     to anon, authenticated;
grant execute on function public.business_login(text, text)            to anon, authenticated;
grant execute on function public.business_set_avatar(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tell the API layer to look again.
--
-- PostgREST answers from a cached picture of the schema. Without this it can
-- keep saying "could not find the function ... in the schema cache" for a
-- while after the functions above exist, which looks exactly like the SQL
-- never having been run.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
