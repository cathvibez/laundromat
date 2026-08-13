#!/bin/zsh
# Screenshot single pages of the built rulebook, for design review.
# usage: shot.sh <outdir> <page> [<page> ...]
set -e
BOOK=/Users/kld/Projects/laundromat/design/rulebook/rulebook.html
OUT=$1; shift
mkdir -p "$OUT"
for n in "$@"; do
  { cat "$BOOK"; print "<style>.page{display:none!important}.page:nth-of-type($n){display:block!important;margin:0 auto!important;box-shadow:none!important}body{padding:0!important}</style>"; } > "$OUT/p$n.html"
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
    --hide-scrollbars --force-device-scale-factor=1.7 --window-size=560,795 \
    --screenshot="$OUT/p$n.png" "file://$OUT/p$n.html" >/dev/null 2>&1
  rm -f "$OUT/p$n.html"
done
print "done: $OUT"
