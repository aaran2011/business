-- ===========================================================================
-- Business — reCAPTCHA on creating an account.
-- ===========================================================================
-- RUN `accounts.sql` FIRST. This script replaces one of the functions it
-- creates, so on its own it will fail.
--
-- SIGNING IN IS NOT TOUCHED. His call, 2026-10-12: the tick-box belongs on
-- "Create account" and nowhere else. Signing in stays one tap, and is already
-- bolted by the ten-wrong-guesses lockout in accounts.sql. `business_login`
-- is left exactly as that script made it.
--
-- It is a separate script on purpose: it needs an extension and an outside
-- service, and neither of those is allowed to be a reason that plain accounts
-- stop working.
--
-- ---------------------------------------------------------------------------
-- BEFORE YOU RUN IT
-- ---------------------------------------------------------------------------
-- 1. Register the site at https://www.google.com/recaptcha/admin — choose
--    **reCAPTCHA v2**, "I'm not a robot" tick-box, and add the domains the
--    game is served from (business-chi-eight.vercel.app, and localhost for
--    testing).
-- 2. Put the SITE key in `src/net/recaptcha.ts`. It is public by design.
-- 3. Put the SECRET key in here, on the marked line below, and nowhere else.
--    It never goes in the repository.
--
-- ---------------------------------------------------------------------------
-- HOW IT BEHAVES
-- ---------------------------------------------------------------------------
--   * No secret stored  -> the captcha is OFF and nothing is blocked. That is
--     what makes this script safe to run before you have the keys.
--   * Secret stored, token good -> as normal.
--   * Secret stored, token missing or wrong -> the signup is refused.
--   * Secret stored, GOOGLE UNREACHABLE -> allowed through. Deliberate. A
--     board game locking its own players out because a third party is having
--     a bad morning is a worse failure than a robot getting an account, and
--     being locked out of this game has already happened twice.
-- ===========================================================================

-- pgsql-http, for calling Google from inside the function. If this line
-- fails, the extension is not available on the project and reCAPTCHA cannot
-- be done this way — stop here, nothing above has been changed.
create extension if not exists http with schema extensions;

-- ---------------------------------------------------------------------------
-- Where the secret lives: a table nothing can read but these functions.
-- ---------------------------------------------------------------------------
create table if not exists public.business_config (
  key   text primary key,
  value text not null
);

alter table public.business_config enable row level security;
revoke all on table public.business_config from anon, authenticated;

-- >>> PUT YOUR SECRET KEY HERE, between the quotes, then run the script. <<<
-- Leave it as it is to install everything with the captcha switched off.
insert into public.business_config (key, value)
values ('recaptcha_secret', '')
on conflict (key) do update set value = excluded.value;

-- ---------------------------------------------------------------------------
-- The check itself.
-- ---------------------------------------------------------------------------
create or replace function public.business_captcha_ok(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_body   text;
begin
  select value into v_secret from public.business_config where key = 'recaptcha_secret';

  -- Not configured: the captcha is off, so nothing is blocked.
  if v_secret is null or btrim(v_secret) = '' then
    return true;
  end if;

  -- Configured, but nothing was sent. That is a refusal, not an outage.
  if coalesce(btrim(p_token), '') = '' then
    return false;
  end if;

  begin
    select content
      into v_body
      from extensions.http_post(
        'https://www.google.com/recaptcha/api/siteverify',
        'secret=' || extensions.urlencode(v_secret)
          || '&response=' || extensions.urlencode(p_token),
        'application/x-www-form-urlencoded'
      );
  exception when others then
    -- Google could not be reached. See HOW IT BEHAVES at the top: we let them
    -- in rather than shutting the game because somebody else's service is
    -- down. The attempt still has to pass every other check.
    return true;
  end;

  return coalesce((v_body::jsonb ->> 'success')::boolean, false);
end $$;

-- ---------------------------------------------------------------------------
-- The two doors, now with the check in front of them.
--
-- `p_captcha` has a default, so a client that sends no token still matches
-- the function and is judged on the rules above rather than failing to find
-- anything to call.
-- ---------------------------------------------------------------------------
/*
  The old shape is DROPPED, not replaced. `create or replace` only replaces a
  function with the same argument list, so adding `p_captcha` would leave two
  overloads side by side — and a request naming the first three arguments
  would match both, which PostgREST refuses outright (PGRST203). That failure
  would take account creation down completely.

  Re-running `accounts.sql` after this script puts the old shape back and
  causes exactly that. If you ever do, run this script again afterwards.
*/
drop function if exists public.business_signup(text, text, text);

create or replace function public.business_signup(
  p_username text,
  p_password text,
  p_avatar   text,
  p_captcha  text default ''
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
  if not public.business_captcha_ok(p_captcha) then
    return json_build_object('ok', false, 'error', 'Tick the robot check and try again.');
  end if;
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

  return json_build_object('ok', true, 'username', v_row.username, 'avatar', v_row.avatar_id);
exception
  when unique_violation then
    return json_build_object('ok', false, 'error', 'That username is already taken.');
end $$;

-- ---------------------------------------------------------------------------
-- Only the door is callable. The checker is not: nothing outside should be
-- able to spend tokens against the secret.
-- ---------------------------------------------------------------------------
revoke all on function public.business_captcha_ok(text)               from public;
revoke all on function public.business_signup(text, text, text, text) from public;

grant execute on function public.business_signup(text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
