# Laundromat — Card Text

**All player-facing text for every card in the game.** Working title "Laundromat" is used
throughout; see `open-questions-for-print.md`, item 1 — the name is expected to change before print.

Sources: `design/game-brief.md` v9 (§6, §7, §11), `design/rules-v0.4.md` §5–6, and the current
implementation in `web/src/rules/` (`reckoning.ts`, `phases.ts`, `selectors.ts`, `config.ts`), which
is ahead of the brief on two rules. Anything unsettled is marked **[UNRESOLVED]** and listed in
`open-questions-for-print.md`.

House style for card faces: **bold trigger word**, then the effect, then any lingering rule.
Two printed lines maximum. Plain words. No cross-references to other cards unless unavoidable.

Vocabulary used on every card: **washer** (not "machine"), **wash**, **goes back**, **load**,
**your turn**, **the key**.

---

## 1. Special item cards — 20 cards, 7 kinds

**[UNRESOLVED — deck composition]** The deck is exactly 20 cards, but how many copies of each of
these seven is not decided. Do not send to print until it is. See `open-questions-for-print.md` §4.

Rules that are true of all seven and should appear **once in the rulebook, not on every card**:

- You may play at most one special item card on your turn, before you load.
- You may not play a card on the day you drew it.
- After a card has done its work it goes back into the special item deck and is shuffled in.

[CALLOUT — put this block in the rulebook's card section, not on the cards]

---

### Coloring

**Card face**
> **Play on a washer.** When it runs, every other player's laundry inside is ruined and goes back.

**Reminder text (small)**
> Your own laundry is not ruined — but nothing else protects it either.

**Rulebook entry**
Coloring attaches to a washer and waits there until the washer runs. When it runs, every item
belonging to a player other than you is sent back to its owner, whatever the ladder said. Your own
items are untouched by Coloring, but they still have to survive the ladder and the filters like
everyone else's — Coloring is not armour. If two players both play Coloring on the same washer, each
ruins the other, and only a player holding a Color catcher gets anything out of it.
*(Traceable to `reckoning.ts` filter `coloring`; rules-v0.4 worked examples 25–27.)*

---

### Color catcher

**Card face**
> **Play on a washer.** Your laundry inside is safe from Coloring.

**Reminder text (small)**
> Protects you only, and only from Coloring.

**Rulebook entry**
Color catcher attaches to a washer and cancels Coloring for your items in that washer — including a
Coloring played after yours, and including two Colorings at once. It protects nobody else, and it
does nothing against the ladder, crowding, underwear, blankets or shoes. If no Coloring is ever
played there, the card is wasted.
*(Traceable to `reckoning.ts` filter `coloring`, `catcherOwners`; worked example 25.)*

---

### Bleach

**Card face**
> **Play on a washer.** Until it runs, every item inside counts as the opposite shade: dark counts
> as light, light counts as dark.

**Reminder text (small)**
> Shoes are still shoes. Bleach swaps shades, nothing else.

**Rulebook entry**
Bleach flips the shade of everything in the washer — including your own laundry — before the ladder
is read. It does not disarm shoes: dark shoes become *light* shoes, which are still shoes and still
beat every non-shoe item in the washer. Two Bleaches on the same washer do not cancel out; the
swap happens once.
*(`reckoning.ts` step S1; rules-v0.4 §6.8 and worked examples 11–12.)*

> **TEXT CHANGE, deliberate.** Brief v9 §6 and §11 say Bleach means "light items wash, dark items
> are sent back." That shorthand gives the wrong answer whenever shoes are present — see worked
> example 12, where bleached dark shoes still wash. The wording above is the swap the rule actually
> is. **Flagged for the designer**, not decided unilaterally: see `open-questions-for-print.md` §7.

---

### Mesh bag

*(Internal id in both codebases is still `Wash net`. The printed name is **Mesh bag**. See
`open-questions-for-print.md` §6.)*

**Card face**
> **Play on a washer as you load.** Everything you put into that washer this turn goes in the bag,
> and all of it washes when the washer runs — whatever else is inside.

**Reminder text (small)**
> Only what you load this turn, only into this washer. Not what was already in there.

**Rulebook entry**
Play the Mesh bag before you load, then load as normal. Every item you put into that one washer on
that turn is bagged. When the washer runs, bagged items wash — the ladder, crowding, underwear
isolation, blanket exclusivity and Coloring all lose to the bag. Items already sitting in the washer
from an earlier day are **not** bagged, nor is anything you load elsewhere, nor is anything anyone
else loads. Bagged items are still in the washer for everyone else's purposes: your bagged dark
shoes still wreck the wash for the other players.

> **[UNRESOLVED — two sub-questions.]** (a) Do bagged items still set the ladder and count for
> crowding for everyone else? Currently **yes**. (b) Do bagged socks beside a blanket still come out
> damp? Currently **yes**. Both must be settled before this card's rulebook entry is final.

> **[UNRESOLVED — balance.]** The brief flags the Mesh bag as comfortably the strongest card in the
> game and notes a predecessor card was cut for exactly this. If it is weakened or reverted to the
> v8 "Wash net", this card face is rewritten from scratch. Fallback text, already written and
> intact:
> *"**Play on a washer as you load.** Underwear you load into it this turn washes here even among
> other garments. Underwear already inside is not protected."*

---

### Sanitizer

**Card face**
> **Play on a washer.** Shoes count as ordinary clothes in this wash.

**Reminder text (small)**
> Helps whoever it happens to help — including your opponents.

**Rulebook entry**
Sanitizer attaches to a washer and switches off the two shoe rungs of the ladder. Shoes are still
washed or sent back, but only on shade, exactly like a shirt or a pair of pants. It also flattens
shoes on your own ladder: with a Sanitizer up, your own shoes no longer outrank your own shirt.
Every other rule is untouched. It affects the whole washer, not just you, so it can hand two
opponents a wash. A Sanitizer on a washer holding no shoes does nothing.
*(`reckoning.ts` S2 and `ownCategory`; rules-v0.4 §6.10, worked examples 13 and 24.)*

> **[UNRESOLVED — scope.]** Machine-wide (as written above) is the default in the brief, the
> simulation and the app, and rules-v0.4 argues the alternative is disqualifying — but it is still
> nominally open. If it becomes owner-only, the face reads: *"Play on a washer. Shoes stop tainting
> **your** laundry there."*

---

### Coin

**Card face**
> **Turn any one washer on or off, right now.** You do not need the key.

**Reminder text (small)**
> One use, then back to the deck. The keyholder still acts later today and can undo it.

**Rulebook entry**
The Coin is played on your turn like any other special item, and resolves at once: pick any washer
that is not destroyed and flip its power. It is spent immediately and shuffled back into the special
item deck — it is not kept, and it is not a second key. Because the keyholder acts after every
player has taken their turn, the keyholder can switch your washer straight back.
*(Brief v9 §6, RESOLVED v8; `phases.ts:applySpecial`; rules-v0.4 §4.4 and worked example B14.)*

---

### Snacc

**Card face**
> **Move Jimothy to any other washer.** Everything he was sitting on goes back to its owners,
> unwashed.

**Reminder text (small)**
> Only playable while Jimothy is on the board.

**Rulebook entry**
Snacc lures the raccoon out of the washer he is in and into any other washer that has not been
destroyed. The items he was holding hostage are released — released, not washed: they go straight
back to their owners' hands. His new washer immediately becomes unusable and anything already
sitting in it becomes hostage. You cannot play Snacc when Jimothy is not in play.
*(Brief v9 §6, §7; `phases.ts:moveJimothy` / `releaseHostages`; `canPlaySpecial` refuses the play
when Jimothy is absent.)*

---

## 2. Event cards — exactly 4 cards, one copy of each

Rules true of all four, for the rulebook rather than the cards:

- An event card is drawn only on the **first 6 rolled each day**, and is turned face up the instant
  it is drawn.
- At most one event happens per day.
- After resolving, an event card is shuffled back into the event deck — **except Gang, which never
  comes back**, and **Jimothy, whose card stays on the board while he is in play**.

> **[UNRESOLVED — when an event resolves.]** Revealed on draw is settled. *Resolved* on draw is not.
> Three arms are live (E1 immediate / E2 after everyone has loaded / E3 split). Every event card face
> below is written to be true under all three, so no card art is at risk — but the rulebook's day
> sequence is not, and the choice must be made. See `open-questions-for-print.md` §2.

---

### Gang

**Card face**
> **Choose a washer.** The gang hides behind it and shoots it. It is out of the game for good, and
> everything inside goes back to its owners.

**Reminder text (small)**
> Leave this card on the wreck. Gang happens once per game and never returns to the deck.

**Rulebook entry**
The player who drew the card chooses the washer. Its contents return to their owners' hands
unwashed, and the washer is destroyed: it can never be loaded, run, or switched on again, and the
board is one washer smaller for the rest of the game. If the chosen washer is the one Jimothy is
sitting in, the hostages are released as normal and **Jimothy relocates** to another surviving
washer — the same player chooses where.
*(Brief v9 §7 RESOLVED v8; `phases.ts:resolveGang`; rules-v0.4 worked examples B2, B10.)*

---

### Circuit break

**Card face — [UNRESOLVED, print one of these three]**

> **V2, brief v9 as written:**
> **The power trips.** Every washer switches off. They keep whatever is inside them.
> *Reminder: the keyholder can switch one back on each day.*

> **V1 "blackout":**
> **The power trips.** Nothing washes tonight. Every washer keeps what is inside it, and the power
> is back to normal tomorrow.

> **V3 "auto-restore", the app's current default:**
> **The power trips.** Every washer switches off and keeps what is inside it. They all come back on
> at the end of tomorrow.

**Rulebook entry (written for V2, the brief's text)**
Circuit break switches off every washer that has not been destroyed. Nothing is lost: each washer
holds on to its contents. Off washers **can still be loaded**, and loading is mandatory, so the
board keeps filling while nothing drains. Recovery is one washer per day via the key, unless someone
spends a Coin. Jimothy is not affected, and a destroyed washer stays destroyed.
*(Brief v9 §7; `phases.ts:resolveCircuitBreak`; rules-v0.4 §8.2, worked examples B3–B4.)*

---

### Jimothy

**Card face**
> **A raccoon moves in.** Choose a washer: it cannot run and cannot be loaded, and everything inside
> is stuck with him.

**Reminder text (small)**
> Only Snacc or Animal control move him. Leave this card on the washer.

**Rulebook entry**
The player who drew the card chooses which surviving washer Jimothy settles in. That washer is out
of service: it does not run at the reckoning, nothing may be loaded into it, and items already
inside cannot be taken out by a roll of 4. Those items are hostages and are released — unwashed —
only when Jimothy leaves. Neither Gang nor Circuit break removes him; Gang destroying his washer
makes him move, it does not get rid of him.
*(Brief v9 §7; `phases.ts:resolveJimothyEvent`, `placement.ts` refusal `raccoon`; rules-v0.4 §5.5,
worked examples B6–B9.)*

---

### Animal control

**Card face**
> **Jimothy is taken away.** Everything stuck with him goes back to its owners, unwashed.

**Reminder text (small)**
> If Jimothy is not on the board, nothing happens.

**Rulebook entry**
Animal control removes the raccoon from the board at once and frees his washer for use from the next
load onwards. The hostages are returned to their owners' hands, not washed — players expect this
card to save their laundry and it does not. If Jimothy is not in play the card does nothing at all,
which is roughly half the time. Both this card and Jimothy's card go back into the event deck.
*(Brief v9 §7; `phases.ts:resolveAnimalControl`; rules-v0.4 worked examples B11–B12.)*

---

## 3. Garment cards — 84 cards, 6 colours × 14

Each player colour has 14 cards: **7 garment types × 2 shades (dark and light)**. Garment cards
carry no effect text. They need a name, a shade, an owner colour, and — recommended — the small
reminder that governs that type.

### The 14 cards in every colour

| # | Card name as printed | Shade | Type | Category | Sort rank |
|---|---|---|---|---|---|
| 1 | **Dark Shoes** | dark | shoes | clothes | 1 |
| 2 | **Light Shoes** | light | shoes | clothes | 2 |
| 3 | **Dark Socks** | dark | socks | clothes | 3 |
| 4 | **Dark Pants** | dark | pants | clothes | 3 |
| 5 | **Dark Shirt** | dark | shirts | clothes | 3 |
| 6 | **Dark Hat** | dark | hats | clothes | 3 |
| 7 | **Dark Blanket** | dark | blanket | linen | 3 |
| 8 | **Light Socks** | light | socks | clothes | 4 |
| 9 | **Light Pants** | light | pants | clothes | 4 |
| 10 | **Light Shirt** | light | shirts | clothes | 4 |
| 11 | **Light Hat** | light | hats | clothes | 4 |
| 12 | **Light Blanket** | light | blanket | linen | 4 |
| 13 | **Dark Underwear** | dark | underwear | linen | 5 |
| 14 | **Light Underwear** | light | underwear | linen | 6 |

A card of **Socks** is one pair, and counts as one item.

**Sort rank** is the order hands, damp zones and clean piles are laid out in:
*dark shoes → light shoes → dark clothing and dark blanket → light clothing and light blanket →
dark underwear → light underwear.* It is presentation only and changes no outcome, but it is a
teaching aid and it should be identical on the cards, in the app and in the rulebook. Printing the
rank as a small corner numeral is recommended so a new player can fan their hand correctly without
being taught.
*(Brief v9 §1 "Card sort order"; `selectors.ts:sortRank`.)*

### Shade indicator

[DIAGRAM: the two shade marks side by side at card-corner size, shown in greyscale as well as in
colour, to prove they are distinguishable without hue.]

Shade decides most of the game and must be readable across the table, in bad light, by a colour-blind
player, and on the back-lit edge of a fanned hand. Do not carry it on tone alone.

- Print the word **DARK** or **LIGHT** on the face.
- Add a shape mark that differs in silhouette, not just fill — for example a solid disc versus an
  open ring — and repeat it in the same corner on every card.
- Owner colour is a separate axis and must not be confusable with shade. A dark-shade card in the
  yellow player's colour and a light-shade card in the purple player's colour must not read alike.

### Type reminder text (small, on the card face)

Recommended: it removes the four rules lookups new players actually make.

| Type | Reminder text |
|---|---|
| Shoes | Shoes beat everything else in the washer. Dark shoes beat light shoes. |
| Socks | Washed beside a blanket? Comes out damp — needs one more wash. |
| Pants, Shirt, Hat | *(none needed)* |
| Blanket | Needs a washer to itself. Socks may share with it. |
| Underwear | Washes only in a washer holding nothing but underwear. |

The Underwear reminder is exactly true under the current rules, with one exception — the Mesh bag —
which is named on the Mesh bag itself. The Socks reminder holds whether or not the blanket itself
washes.

---

## 4. Things that are printed but are not cards

Listed here so nothing is lost between this document and the layout.

- **Machine tiles, 7.** Number them **1** to **7**. A tile needs a place for the on/off marker, a
  clearly bounded area for up to 4 item cards, and room for attached special item cards.
- **On/off markers, 7.** Two states, readable across a table: **ON / OFF**. Do not rely on the
  marker being present or absent — an absent marker reads as "someone dropped it".
- **Key token, 1.** Reads as a key. Reminder printed on it if space allows: *"Turn one washer on or
  off, or pass. Then pass me on."*
- **Jimothy standee, 1.** A raccoon.
- **Die, 1 six-sided.** A custom-faced die is recommended by the publishing research and solves a
  real teaching problem: print the action on the face. Faces 1/2/3 = "LOAD 1/2/3"; face 4 = "LOAD 1
  + MOVE"; face 5 = "LOAD 1 + CARD"; face 6 = "LOAD 1 + EVENT".
- **Damp markers.** [DESIGNER DECISION NEEDED] Damp socks are the only lasting per-item state in the
  game and the component manifest does not include a token for them. See
  `open-questions-for-print.md` §8.
