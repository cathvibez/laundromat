#!/usr/bin/env bash
#
# Promote main to prod, which deploys.
#
#   scripts/deploy.sh            promote main -> prod and push; GitHub Actions deploys
#   scripts/deploy.sh --local    skip CI and run `fly deploy` from this machine
#   scripts/deploy.sh --check    verify the live deploy, change nothing
#
# WHY THIS EXISTS: rooms and games live in memory, so a deploy ENDS EVERY GAME
# IN PROGRESS. Deploying is therefore a deliberate act with a checklist, not a
# side effect of pushing code. Develop on main; promote when nobody is playing.

set -euo pipefail

APP="play-laundromat"
BASE="https://play-laundromat.fly.dev"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bold=$'\033[1m'; green=$'\033[32m'; yellow=$'\033[33m'; red=$'\033[31m'; off=$'\033[0m'
ok()   { printf '%s  ok%s  %s\n' "$green" "$off" "$*"; }
warn() { printf '%s warn%s %s\n' "$yellow" "$off" "$*"; }
die()  { printf '%s fail%s %s\n' "$red" "$off" "$*" >&2; exit 1; }
step() { printf '\n%s%s%s\n' "$bold" "$*" "$off"; }

MODE="promote"
case "${1:-}" in
  --local) MODE="local" ;;
  --check) MODE="check" ;;
  --help|-h) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  "") ;;
  *) die "unknown option: $1 (try --help)" ;;
esac

# ---------------------------------------------------------------------------
# Verify the live deploy. Used by --check and after every deploy.
# ---------------------------------------------------------------------------
verify() {
  step "Verifying $BASE"

  # ONE machine. Fly prints "Creating a second machine for high availability"
  # and does it, even with min_machines_running = 1 — a floor, not a ceiling.
  # Two machines means two in-memory room stores behind one hostname, and two
  # players typing the same code land in different games.
  local count
  count=$(flyctl machines list -a "$APP" --json | jq 'length')
  if [ "$count" -eq 1 ]; then
    ok "exactly one machine"
  else
    warn "$count machines — scaling back to 1"
    flyctl scale count 1 -y
  fi

  local health
  health=$(curl -fsS "$BASE/api/health") || die "health check failed"
  ok "health: $health"

  [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")" = "200" ] \
    && ok "client served" || die "client did not return 200"

  # SPA fallback: a /join/ABCD link must serve index.html, not a 404.
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/join/ABCD")" = "200" ] \
    && ok "SPA fallback on /join/ABCD" || die "/join/ABCD did not return 200"

  # The real test: three SocketIO clients, a move, and the assertions that
  # nobody saw another player's cards and a dropped player can reclaim a seat.
  step "Smoke test"
  ( cd web && npm run smoke -- "$BASE" )
}

if [ "$MODE" = "check" ]; then
  verify
  step "Done"
  ok "nothing was deployed"
  exit 0
fi

# ---------------------------------------------------------------------------
# Preflight. Everything here is a reason NOT to deploy.
# ---------------------------------------------------------------------------
step "Preflight"

[ -z "$(git status --porcelain)" ] || die "working tree is dirty — commit or stash first"
ok "working tree clean"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$BRANCH" = "main" ] || die "on '$BRANCH'; deploys promote main. git checkout main first"
ok "on main"

git fetch origin --quiet
if [ -n "$(git log origin/main..main --oneline)" ]; then
  warn "main has commits not pushed to origin — pushing"
  git push origin main
fi
[ -z "$(git log main..origin/main --oneline)" ] || die "origin/main is ahead; git pull first"
ok "main is in sync with origin"

step "Tests"
( cd web && npm test ) || die "tests failed — not deploying"
ok "suite passed"

# The one thing a green test run cannot tell you.
step "Live games"
ROOMS=$(curl -fsS "$BASE/api/health" | sed 's/.*"rooms":\([0-9]*\).*/\1/') || ROOMS="?"
if [ "$ROOMS" != "0" ] && [ "$ROOMS" != "?" ]; then
  warn "$ROOMS room(s) currently open on $BASE."
  warn "Deploying ENDS every game in progress — players cannot reconnect."
  printf 'Continue anyway? [y/N] '
  read -r reply
  [ "$reply" = "y" ] || [ "$reply" = "Y" ] || die "aborted"
else
  ok "no open rooms"
fi

# ---------------------------------------------------------------------------
# Deploy.
# ---------------------------------------------------------------------------
if [ "$MODE" = "local" ]; then
  step "Deploying from this machine"
  # From the REPO ROOT: the Dockerfile is here and expects the root as its
  # build context. Running this from web/ gives it a context with no web/
  # directory and every COPY fails.
  flyctl deploy --config web/fly.toml
else
  step "Promoting main -> prod"
  # Read the current release BEFORE pushing. CI finishes in well under two
  # minutes, so capturing this afterwards can miss the change entirely and then
  # sit through the whole timeout waiting for something that already happened.
  before=$(flyctl releases -a "$APP" --json | jq '.[0].version')
  git checkout prod --quiet
  git merge --ff-only main --quiet
  git push origin prod
  git checkout main --quiet
  ok "pushed prod; GitHub Actions is deploying"
  echo "   watch: gh run watch --repo cathvibez/laundromat"
  echo "   or:    https://github.com/cathvibez/laundromat/actions"

  # Wait for the release to land before verifying, otherwise the smoke test
  # races the rollout and fails against the old machine.
  step "Waiting for the rollout"
  for _ in $(seq 1 60); do
    sleep 10
    now=$(flyctl releases -a "$APP" --json | jq '.[0].version')
    [ "$now" != "$before" ] && { ok "release $now is live"; break; }
    printf '.'
  done
fi

verify

step "Done"
ok "$BASE is live and verified"
