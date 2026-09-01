# Promo video script — Laundromat

**20 seconds. No gameplay footage.** The whole film is the game's own How to Play
guide, which already contains hand-drawn washers with real cards in them and
verdict stamps on those cards. That artwork explains the game better than a
screen recording does, and it does not require the viewer to follow a live board.

The earlier 60-second screen-capture cut is preserved in git history at commit
`86a5b2f` if a longer version is ever wanted.

---

## Why 20 seconds works here and 60 did not

The long cut spent 20 of its 60 seconds *demonstrating* the three betrayals —
a drum, cards in it, stamps you have to read. Demonstrations are slow.

Naming them is fast. "Your dirty shoes send someone's pants back" is a complete
idea in one breath, and the guide's diagram sits under it as evidence rather
than as something to be studied. That trade is what buys the whole film down to
20 seconds without losing the hook.

**Budget:** ~50 words of voiceover. Read flat, unhurried — roughly 2.5 words a
second. Every shot is a still or a slow push; nothing needs to be followed.

---

## Shot list

| Time | On screen | Voiceover | Audio |
|---|---|---|---|
| 0:00–0:04 | Guide page 1, **About the game** (`guide-0.png`). Slow push on the washer diagram — three players' clothes in one drum. | "One laundromat. Everybody's washing." | A washer starting up. Nothing else. |
| 0:04–0:07 | Guide page 4, **Shoes and underwear** (`split-3.png`). Hold on the washer where the shoes spoil the load — the BACK stamps are already drawn. | "Your dirty shoes send someone's pants back." | Machine hum under. |
| 0:07–0:10 | Same page, cut to the underwear washer. | "Your underwear needs the machine to itself." | |
| 0:10–0:13 | Guide page 5, **Dark against light** (`split-4.png`). The "Dark taints light" washer: one WASHED, one BACK. | "Your dark clothes dirty someone's light ones." | |
| 0:13–0:16 | **Jimothy**, full frame, still, on paper (`web/public/art/cards/jimothy.jpg`). Let the printed headline read. | "And sometimes a raccoon moves in." | Hum stops dead. One beat of silence. |
| 0:16–0:20 | The landing page's three mode cards — the SAME page the guide is on, just scrolled up. Then the wordmark and URL. | "First to get everything washed wins. Play it in a browser." | Hum returns, resolves. |

The one edit that matters is at 0:13. The machine noise **stops** when Jimothy
appears and the frame goes still. He is the only living thing in the film and
the only cut with silence under it, which is what makes him the joke rather than
another rule.

---

## Voiceover, clean

Read flat and slightly bored, like someone explaining a house rule they have
explained before. No emphasis on "raccoon" — the picture does that.

> One laundromat. Everybody's washing.
>
> Your dirty shoes send someone's pants back.
>
> Your underwear needs the machine to itself.
>
> Your dark clothes dirty someone's light ones.
>
> And sometimes a raccoon moves in.
>
> First to get everything washed wins. Play it in a browser.

**42 words** — 17 seconds of speech at an unhurried 2.5 words a second, 19 at
2.2, which leaves room for the beat of silence on Jimothy inside 20 seconds. If it runs long, the line to cut is "Your underwear needs the
machine to itself" — two betrayals carry the idea as well as three, and it buys
back three seconds.

**Silent version.** The same six lines work as on-screen text over the same
stills, set in Fredoka to match the game. Social autoplays muted; this cut
should not depend on sound.

---

## What needs capturing

**Nothing new, and the film is simpler than it first looked.**

Every frame comes from ONE page. The three mode cards — Play by myself / Play
with friends here / Play online — sit at the top of the landing page, directly
above How to play, and the guide pages are the same page scrolled down. So the
whole 20 seconds can be shot as a single continuous capture of
https://play-laundromat.fly.dev at 1512×982: open on the mode cards, scroll into
the guide, page through it, and cut back up at the end.

That is worth doing rather than assembling stills. It shows, without a word,
that this is one page a person can actually visit — which is the only thing the
last four seconds needs to say.

- Existing stills if you prefer to cut rather than scroll: `guide-0.png`,
  `split-3.png`, `split-4.png`. Recapture from the deployed site rather than a
  dev server, and leave the browser chrome out.
- `jimothy.jpg` — ships with the game; the higher-resolution original is page 6
  of `assets/LAUNDRY PRINT FILE.pdf`.

---

## Deliberately left out

**The board.** Requested, and correct: a populated six-player board is a lot to
take in and reads as work rather than as an invitation.

**The die, the days, the key, blankets, the special deck.** All real and all
interesting, and none of them survive a 20-second cut. The key in particular —
one player deciding what runs — is the best strategic idea in the game and
deserves better than three seconds.

**Any number.** No player count, no playtime, no balance figures. `sim/out/` is
stale per `design/implementation-status.md`, and none of it earns its place here.
