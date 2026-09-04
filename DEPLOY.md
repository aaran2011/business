# Putting Business live, and keeping it live

Two one-time steps, then it stays live by itself.

After the setup below, the flow is:

> you ask for a change → the change is made → `npm run ship` → live in ~1 minute

You never touch Vercel again.

---

## Step 1 — one-time: the GitHub repo

The local repository is already set up and committed. It only needs somewhere
to push to.

**1a.** Create an empty repo at [github.com/new](https://github.com/new).

- Name: `business` (or anything you like)
- **Do not** tick "Add a README", a `.gitignore`, or a licence — it must be
  completely empty, or the first push is rejected.

**1b.** Point this folder at it and push. From
`Documents/claude files/international-business`:

```bash
git remote add origin git@github.com:aaran2011/business.git && git push -u origin main
```

That uses SSH, the same as your `rizz` repo. If it hangs on
`Connection timed out`, your network is blocking port 22 — GitHub also serves
SSH on 443, which usually gets through:

```bash
printf '\nHost github.com\n  Hostname ssh.github.com\n  Port 443\n' >> ~/.ssh/config
```

Then run the push again.

---

## Step 2 — one-time: connect Vercel

**2a.** Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.

**2b.** Find the repo and press **Import**.

**2c.** Vercel detects Vite and fills everything in correctly. Change nothing:

| Setting | Value |
|---|---|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Environment variables | none — the game needs no keys |

**2d.** Press **Deploy**. About a minute later you have a URL like
`https://business-xyz.vercel.app`.

That import also switches on Vercel's Git integration, which is the part that
keeps it live: **every push to `main` redeploys automatically, forever.** There
is no second setup step and nothing to renew.

---

## From then on

```bash
npm run ship
```

`scripts/ship.sh` runs the typecheck, the 303 rule assertions and a real
production build, and **refuses to push if any of them fail**. Only then does it
commit everything and push. Vercel sees the push and rebuilds.

```bash
npm run ship -- "made the dice bigger"   # your own commit message
npm run ship -- --fast                   # skip the production build check
```

The checks are the point. This is a board game: a broken rule does not look
broken in a screenshot the way a broken layout does, so the rule assertions are
what stand between a bad change and the phone in your pocket. Don't reach for
`--fast` or a bare `git push` to get around a failure — fix the failure.

### Rolling back

Vercel keeps every deployment. If something is wrong, open the project's
**Deployments** tab, find the last good one and press **Promote to Production**.
That is instant and needs no code change.

---

## Notes

- **Hobby plan is free and non-commercial.** Fine for a game you play with
  friends; charging for it would need Pro.
- **Nothing to pay for beyond that.** The whole game runs in the browser — no
  server, no database, no API keys.
- **This folder is its own git repository**, nested inside `claude files`, which
  ignores it. Same arrangement as `rizz/`. Committing here never touches the
  Instagram planner repo.
