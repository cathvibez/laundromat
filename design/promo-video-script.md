# Promo video script — Laundromat (digital version)

Designer: Kailin Zheng. Subject: the browser version at <https://play-laundromat.fly.dev>.
Everything below is checked against `web/src/ui/RulesGuide.tsx`, `web/src/rules/selectors.ts`
and `web/src/rules/reckoning.ts`. If a line here is not in the code, it is not in the video.

---

## 1. Length and platform

**One cut: 60 seconds, screen-capture led, 16:9 with a 9:16 safe crop.**

The reason is arithmetic, not taste. The hook is the premise's second paragraph —
shoes, underwear, dark on light — and each of those three is a *demonstration*: a drum
with items in it and the verdict stamps showing who loses. Four to five seconds each,
and they do not work as a montage, because the joke is reading whose clothes went back.
That is 20 seconds before anything else happens. The day structure (everyone loads, the
keyholder flips one washer, everything runs at once) is another 10, Jimothy is 12, and
the three ways to play plus the URL is 8. Cutting below 45 means dropping either a
betrayal or the raccoon, and both are load-bearing.

**A 90-second store-page cut is not recommended.** There is no third act. The extra 30
seconds would go on the rest of the special deck — Bleach, Coloring, Mesh bag, Color
catcher, Coffee — which are variations on "somebody did something to your washer", and
the middle sags exactly where a store-page viewer leaves.

**Short cut, 20 seconds, for feeds that punish length:** keep 0:00–0:22 (the cold open
and the three betrayals) and 0:52–1:00 (modes and URL) verbatim; drop the day structure,
the reckoning and Jimothy entirely. Do not try to keep a compressed Jimothy — half a
raccoon is worse than none, and the beat is the only laugh in the piece.

Aspect: shoot 16:9 from a 1512×982 browser window (matches the existing captures). For
9:16, the safe crop is one washer plus the turn bar plus the hand rail; the seven-washer
floor does not survive a vertical crop and should be replaced there by a 2-washer close-up.

---

## 2. Shot list

Assets named as `scratchpad/…` live in the session scratchpad
(`/private/tmp/claude-501/-Users-kld-Projects-laundromat/2f8f544b-a0d7-4322-988c-947b3778eac3/scratchpad/`).
Assets named as `web/public/art/…` are in the repo. **CAPTURE** marks a shot that does not
exist yet; §4 says how to get each one.

| Time | On screen | VO / on-screen text | Audio |
|---|---|---|---|
| 0:00–0:04 | `scratchpad/clip-1512-6.png` — the six-player floor, Day 1, seven empty washers, every drum reading `0/7`. Slow push in from the whole floor to Washer 2. | VO: "One laundromat. Everybody's washing." | Room tone: fluorescent hum, a dryer turning somewhere off screen. One door thunk on the cut. |
| 0:04–0:09 | **CAPTURE A** — three different players' cards dropping into Washer 2 in sequence: a purple dark shirt, an orange dark pair of pants, a blue dark hat. Held on the full drum, `3/7`. | VO: "What you put in a washer lands on everyone else's laundry, not just yours." | Three soft card-drop ticks, on the beat of each drop. |
| 0:09–0:14 | **CAPTURE B** — a drum holding dark shoes plus two other players' garments, forecast stamps visible: WASHED on the shoes, BACK, BACK. Fallback if capture slips: the "Shoes spoil it" washer in `scratchpad/guide-3.png`. | VO: "Your dirty shoes send someone's pants back for another wash." | A stamp thump on each BACK. Nothing else. |
| 0:14–0:18 | **CAPTURE C** — a drum with one player's dark underwear and one other player's dark socks. Stamps: BACK on the underwear, WASHED on the socks. Fallback: "Underwear, with company" in `scratchpad/guide-3.png`. | VO: "Your underwear is delicate. It needs the machine to itself." | Same stamp thump. |
| 0:18–0:22 | The "Dark taints light" washer from `scratchpad/guide-4.png` — dark pants WASHED, light hat BACK — or **CAPTURE D**, the same pair live on the board. | VO: "Your dark clothes dirty someone's light ones." On-screen text, small, bottom left: "and the owner of the dark item pays nothing for that" | Stamp thump, then the room tone drops out for a beat. |
| 0:22–0:27 | **CAPTURE E** — the turn bar: die rolls a 5, one card goes in, turn passes. Then the header chip `Key: Player 1`, and Washer 3 flipping `ON` → `OFF` with two items already inside it. | VO: "Everyone loads first. Then whoever holds the key flips one washer on or off — and that's the last word on what runs tonight." | Die rattle. A hard switch clack on the ON→OFF flip. |
| 0:27–0:33 | The reckoning modal stepping machine by machine — shape of `scratchpad/solo-07-reckoning.png`, but **CAPTURE F** with a loaded floor so the counts are not zero. Cut to a hand rail where two items return dirty and one lands in the clean pile. | VO: "Then every washer that's still on runs at once. The board tells you what tonight will do to your clothes before it happens — and it tells everyone else too." | Wash cycle swell, then a single machine-finished chime. |
| 0:33–0:37 | `web/public/art/cards/jimothy.jpg` full frame — the raccoon in a blue cap with a bindle and a stolen sock, walking left to right. Hold it. This is the only still in the video that is allowed to sit. | VO: "And sometimes a raccoon moves into a washer." On-screen text: "HERE COMES JIMOTHY!" (the card's own headline, from `scratchpad/pdf-page6.png`) | Everything stops. One banjo-ish pluck, or nothing at all — the silence is funnier. |
| 0:37–0:42 | **CAPTURE G** — a washer's power chip reading `JIMOTHY` instead of `ON`, with two of your items visible inside it. Camera does not move. | VO: "That machine is out of service until he leaves. Anything inside is stuck with him." | Room tone returns, quieter. |
| 0:42–0:47 | **CAPTURE H** — the Snacc card (`web/public/art/cards/snacc.jpg`, the bitten green apple) played, and Jimothy relocating into a washer that already holds three of somebody else's items. | VO: "You can lure him somewhere else with an apple core. Somewhere with four of your friend's shirts in it." | A small comic scurry. One card flick. |
| 0:47–0:52 | **CAPTURE I** — the RACE TO 8 rail on the right of the board, one player's bar filling to full while the others sit behind, and the win state. | VO: "First to get everything on their list washed wins. Sabotage or collaborate — your choice." | Room tone up, dryer buzzer. |
| 0:52–1:00 | The landing page at the top of `scratchpad/guide-3.png`: the three mode cards — "Play by myself", "Play with friends here", "Play online" — then **CAPTURE J**, the lobby with a live four-character room code (recapture; `scratchpad/online-lobby.png` still shows a localhost link). End card: wordmark on the game's paper background. | VO: "Play it against bots, pass one screen around the table, or send a room code. It runs in a browser." On-screen text, end card: **Laundromat** / play-laundromat.fly.dev | Buzzer tail, cut to silence on the end card. |

---

## 3. Voiceover, clean

Read flat and slightly bored, like someone explaining a house rule they have explained
before. No emphasis on "raccoon" — the picture does that.

> One laundromat. Everybody's washing.
>
> What you put in a washer lands on everyone else's laundry, not just yours.
>
> Your dirty shoes send someone's pants back for another wash.
>
> Your underwear is delicate. It needs the machine to itself.
>
> Your dark clothes dirty someone's light ones.
>
> Everyone loads first. Then whoever holds the key flips one washer on or off — and
> that's the last word on what runs tonight.
>
> Then every washer that's still on runs at once. The board tells you what tonight will
> do to your clothes before it happens — and it tells everyone else too.
>
> And sometimes a raccoon moves into a washer.
>
> That machine is out of service until he leaves. Anything inside is stuck with him.
>
> You can lure him somewhere else with an apple core. Somewhere with four of your
> friend's shirts in it.
>
> First to get everything on their list washed wins. Sabotage or collaborate — your choice.
>
> Play it against bots, pass one screen around the table, or send a room code. It runs
> in a browser.

**Alternate closing line**, if the bots need selling harder — it is verbatim from
`BOT_LEVELS` in `web/src/game/bot.ts` and it is the best sentence in the codebase:

> Play it against bots. There is a hell mode: it loads where its own laundry washes and
> yours does not.

---

## 4. Notes

### Shots that do not exist yet

All of these are one browser session. `npm run dev` in `web/`, then
`http://localhost:5173/?autostart&players=6` for a populated board; capture at 1512×982
to match the existing stills. Hide the header's "Stay in touch" and "Review" buttons in
post, or crop above them — they are feedback chrome and read as beta furniture.

- **A** — three players' cards entering one drum. Easiest hot-seat: load one item per
  player into Washer 2 over three turns, then cut the three loads together.
- **B, C, D** — the three betrayals, live rather than from the rules guide. Live is worth
  the trouble: the guide diagrams are drawn small and shade-flattened, and the stamps
  land harder at full card size with the real garment art behind them.
- **E** — the key flip. Needs a keyholder with a loaded washer to switch off; the switch
  is the shot, so frame the chip, not the floor.
- **F** — reckoning with a loaded floor. `solo-07-reckoning.png` exists but reads
  "nothing inside", which undercuts the line.
- **G, H** — Jimothy occupying a washer and being lured. The event only arrives on the
  first 6 of a day, so this needs either a patient session or a seeded one; the Snacc
  card then has to be drawn on a 5. Budget an afternoon or drive it from a script.
- **I** — a win. Three players against two hell-mode bots is the fastest route.
- **J** — the lobby against the live deploy, so the share link reads
  `play-laundromat.fly.dev/join/XXXX` rather than localhost.

Two art cautions: some older captures (`scratchpad/specials.png`) show cards reading
"art pending" for blankets and underwear — use recent six-player captures, where the
garment art is complete. And the printed card sheets (`scratchpad/pdf-page6.png`,
`pdf-page7.png`, `pdf-page4.png`, `pdf-page5.png`, `web/public/art/sheet*.jpg`) are the
strongest-looking assets in the project; if a shot is failing on screen, cut to the card.

### Deliberately left out

- **The rest of the special deck.** Bleach, Coloring, Color catcher, Mesh bag, Coffee,
  the Laundry Token. Each needs a sentence of setup to be funny and the video has room
  for one such object. Jimothy earns it; Color catcher does not.
- **Blankets and tangling.** True, good, and ten seconds of explanation: a blanket takes
  the whole drum bar one item, and that companion gets *tangled* rather than washed. It
  is a second-viewing rule.
- **Crowding** (three of one garment type and all three go back). Same reason — it is the
  rule with no villain in it, so it cannot carry a beat in a sabotage-led cut.
- **Neighborhood Shootout / the Gang event**, which permanently destroys a washer. Funny
  at the table, but in 60 seconds a permanently dead machine reads as the game breaking.
- **Hidden hands and the pass-the-device interstitial.** Correct and unglamorous.
- **Any specific number of items to wash.** It varies with player count — ten each at
  three and four players, eight at five and six — so the VO says "everything on their
  list", which is true at every count and is the designer's own phrasing.
- **Anything about the physical edition.** This is the digital cut; the box does not
  exist yet and the name is still a placeholder.
- **Balance claims of any kind.** The simulation figures in `sim/out/` describe a ruleset
  the app has moved past — see `design/implementation-status.md`. Nothing in this script
  quotes a win rate, an average game length, or a "plays in N minutes".
