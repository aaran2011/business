#!/usr/bin/env bash
#
# One command to put the current code live.
#
#   npm run ship                 # checks, commits everything, pushes
#   npm run ship -- "some note"  # same, with your own commit message
#   npm run ship -- --fast       # skip the production build check
#
# Vercel watches the GitHub repo, so the push IS the deploy. Everything before
# the push exists to stop a broken build reaching the phone in your pocket:
# once it is live, the only way back is another deploy.

set -euo pipefail

cd "$(dirname "$0")/.."

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; OFF=$'\033[0m'
step()  { printf '\n%s==>%s %s\n' "$BOLD" "$OFF" "$1"; }
fail()  { printf '\n%s✗ %s%s\n' "$RED" "$1" "$OFF"; exit 1; }
ok()    { printf '%s✓%s %s\n' "$GREEN" "$OFF" "$1"; }

FAST=0
MESSAGE=""
for arg in "$@"; do
  case "$arg" in
    --fast) FAST=1 ;;
    *) MESSAGE="$arg" ;;
  esac
done

# ---------------------------------------------------------------- sanity ----
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "This folder is not a git repository.
Run the one-time setup in DEPLOY.md first."
git remote get-url origin >/dev/null 2>&1 || fail "No 'origin' remote, so there is nowhere to push.
Run the one-time setup in DEPLOY.md first."

BRANCH="$(git branch --show-current)"
[ -n "$BRANCH" ] || fail "You are not on a branch (detached HEAD). Run: git checkout main"

# Vercel's free plan refuses a deployment whose committer is not a known GitHub
# user, and the failure looks like nothing happening at all. Checked here rather
# than discovered in the dashboard twenty minutes later.
COMMIT_EMAIL="$(git config user.email || true)"
[ -n "$COMMIT_EMAIL" ] || fail "No git user.email is set, so Vercel would reject the deploy.
Run: git config user.email 'you@users.noreply.github.com'"

if [ -z "$(git status --porcelain)" ] && git diff --quiet "origin/$BRANCH" HEAD 2>/dev/null; then
  printf '\n%sNothing to ship — the live site already matches this folder.%s\n' "$YELLOW" "$OFF"
  exit 0
fi

# ------------------------------------------------------------- what's new ---
step "What you're about to put live"
git status --short | sed 's/^/   /'
CHANGED=$(git status --porcelain | wc -l | tr -d ' ')
printf '%s   %s file(s)%s\n' "$DIM" "$CHANGED" "$OFF"

# ----------------------------------------------------------------- checks ---
# The rule assertions are the important gate here: this is a board game, and a
# broken rule is not visible in a screenshot the way a broken layout is.
step "Checking it works"
npm run --silent typecheck        || fail "TypeScript errors. Nothing was pushed."
ok "types"
npm run --silent check >/dev/null || fail "Rule checks failed. Nothing was pushed.
Run 'npm run check' on its own to see which rule broke."
ok "rule checks"

if [ "$FAST" -eq 1 ]; then
  printf '%s   skipped the production build (--fast)%s\n' "$YELLOW" "$OFF"
else
  npm run --silent build >/dev/null 2>&1 || fail "The production build failed. Nothing was pushed.
Run 'npm run build' on its own to see why."
  ok "production build"
fi

# ----------------------------------------------------------------- commit ---
step "Saving and pushing"
[ -n "$MESSAGE" ] || MESSAGE="Update $(date '+%-d %b %Y, %H:%M')"

git add -A
if git diff --cached --quiet; then
  printf '%s   nothing new to commit — pushing what is already saved%s\n' "$DIM" "$OFF"
else
  git commit -q -m "$MESSAGE"
  ok "committed: $MESSAGE"
fi

if ! git push -q origin "$BRANCH" 2>/dev/null; then
  printf '%s   push rejected — pulling the remote changes first%s\n' "$YELLOW" "$OFF"
  git pull --rebase origin "$BRANCH" || fail "Could not merge the remote changes automatically.
Your work is committed and safe. Run 'git status' to see what clashed."
  git push -q origin "$BRANCH" || fail "Push still failed. Your work is committed and safe."
fi
ok "pushed to origin/$BRANCH"

# ------------------------------------------------------------------- done ---
# Deliberately conditional. The script cannot see Vercel, and claiming "it is
# building now" when no Vercel project is connected to this repo is the kind of
# confident lie that leaves you thinking a change is live for a week.
printf '\n%s🚀 Pushed.%s If Vercel is connected to this repo it is building now — a minute or two.\n' "$GREEN" "$OFF"
printf '%s   Check: https://vercel.com/dashboard — and DEPLOY.md if it is not connected yet.%s\n\n' "$DIM" "$OFF"
