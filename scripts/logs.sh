#!/usr/bin/env bash
#
# Read the production logs.
#
#   scripts/logs.sh                    live tail, human-readable
#   scripts/logs.sh --room 8U3W        only that game
#   scripts/logs.sh --user a1b2c3d4e5f6  only that person
#   scripts/logs.sh --errors           warnings and errors only
#   scripts/logs.sh --recent           the last chunk, then exit (no tailing)
#   scripts/logs.sh --raw              untouched JSON, for piping into jq
#
# Combine them: scripts/logs.sh --room 8U3W --errors
#
# The server logs one JSON object per line (server/log.ts). Every line caused by
# a game carries `room`, and every line caused by a person carries `user` — the
# hashed, anonymous id their browser sends. Those two fields are the whole point:
# a bug report is "room 8U3W broke" or "it keeps dropping me", and each becomes
# one filter rather than a scroll through six players interleaved.
#
# WHAT YOU WILL NOT FIND HERE: anything from a previous run of the server. Logs
# are Fly's live stream, and state is in memory — after a restart both the games
# and their history are gone. If you are debugging something that killed the
# server, look for `shutting down` or `staying up, but this is a bug`.

set -euo pipefail

APP="play-laundromat"
ROOM=""
USER_FP=""
ERRORS_ONLY=0
RAW=0
NO_TAIL=0

while [ $# -gt 0 ]; do
  case "$1" in
    --room)   ROOM="$(printf '%s' "$2" | tr '[:lower:]' '[:upper:]')"; shift 2 ;;
    --user)   USER_FP="$2"; shift 2 ;;
    --errors) ERRORS_ONLY=1; shift ;;
    --raw)    RAW=1; shift ;;
    --recent) NO_TAIL=1; shift ;;
    --app)    APP="$2"; shift 2 ;;
    --help|-h) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1 (try --help)" >&2; exit 1 ;;
  esac
done

command -v flyctl > /dev/null 2>&1 || { echo "flyctl not installed" >&2; exit 1; }
command -v jq     > /dev/null 2>&1 || { echo "jq not installed (brew install jq)" >&2; exit 1; }

# Build a jq filter from the flags. Fly wraps each app line in its own envelope
# and also emits proxy/health lines that are not ours, so `fromjson? // empty`
# quietly drops everything that is not one of our JSON objects.
FILTER='fromjson? // empty'
[ -n "$ROOM" ]        && FILTER="$FILTER | select(.room == \"$ROOM\")"
[ -n "$USER_FP" ]     && FILTER="$FILTER | select(.user == \"$USER_FP\")"
[ "$ERRORS_ONLY" = 1 ] && FILTER="$FILTER | select(.level == \"warn\" or .level == \"error\" or .level == \"fatal\")"

if [ "$RAW" = 1 ]; then
  RENDER='.'
else
  # One readable line: time, level, room, user, message, then whatever else the
  # line carried. Dropping the fields we have already printed keeps the tail
  # short enough to read at a glance.
  RENDER='"\(.time // "") \(.level // "?" | ascii_upcase) "
    + (if .room then "[\(.room)] " else "" end)
    + (if .user and .user != "anon" then "(\(.user[0:8])) " else "" end)
    + "\(.msg // "")"
    + (if (del(.time,.level,.room,.user,.msg,.service,.pid,.hostname) | length) > 0
       then "  " + (del(.time,.level,.room,.user,.msg,.service,.pid,.hostname) | tostring)
       else "" end)'
fi

echo "reading logs for $APP${ROOM:+  room=$ROOM}${USER_FP:+  user=$USER_FP}" >&2
[ "$ERRORS_ONLY" = 1 ] && echo "(warnings and errors only)" >&2

FLAGS=(-a "$APP")
[ "$NO_TAIL" = 1 ] && FLAGS+=(--no-tail)

if [ "$RAW" = 1 ]; then
  flyctl logs "${FLAGS[@]}" | jq -R "$FILTER | $RENDER"
else
  flyctl logs "${FLAGS[@]}" | jq -Rr "$FILTER | $RENDER"
fi
