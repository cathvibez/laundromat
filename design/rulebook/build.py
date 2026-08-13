#!/usr/bin/env python3
"""
Build the self-contained rulebook.

Concatenates design/rulebook/parts/*.html in filename order and inlines every
art sheet as a base64 data URI, so the delivered rulebook.html has no external
dependency of any kind — no CDN, no font request, no image path.

    python3 design/rulebook/build.py

Art lives in web/public/art/ and is READ ONLY. Nothing outside design/rulebook/
is written.
"""

import base64
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
PARTS = pathlib.Path(__file__).resolve().parent / "parts"
ART = ROOT / "web" / "public" / "art"
OUT = pathlib.Path(__file__).resolve().parent / "rulebook.html"

MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}


def data_uri(name: str) -> str:
    p = ART / name
    raw = p.read_bytes()
    return f"data:{MIME[p.suffix]};base64,{base64.b64encode(raw).decode('ascii')}"


def main() -> None:
    html = "".join(p.read_text() for p in sorted(PARTS.glob("*.html")))

    # __ART:sheet1.jpg__  ->  data:image/jpeg;base64,...
    def sub(m: "re.Match[str]") -> str:
        return data_uri(m.group(1))

    html, n = re.subn(r"__ART:([A-Za-z0-9._-]+)__", sub, html)

    # Folios are auto-numbered in document order, so pages can be split or
    # reordered without hand-editing every page number.
    counter = iter(range(1, 999))

    def folio(m: "re.Match[str]") -> str:
        n = next(counter)
        # `pgno hidden` still consumes a number (the cover) but prints nothing.
        return "" if "hidden" in m.group(0) else str(n)

    html = re.sub(r'<span class="pgno[^"]*"[^>]*></span>', folio, html)
    OUT.write_text(html)
    kb = OUT.stat().st_size / 1024
    print(f"wrote {OUT.relative_to(ROOT)} — {kb:.0f} KB, {n} art references inlined")


if __name__ == "__main__":
    main()
