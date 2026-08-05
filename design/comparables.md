# Laundromat — Comparables Research

Research notes on published games that already hit the problems this design is walking into.
Sources are linked inline. Written against `game-brief.md` v2.

**Prior art alert, read first.** A game with nearly this exact premise already exists:
**Dirty Laundry: Sabotage Shedding Game** (Quokka Games, 2021) — "players take turns to
strategically place concealed items, action cards and garments into communal washing
machines… throw a red sock into a load of white garments… break washing machines so no one
can win." First to wash all their laundry wins.
[BGG](https://boardgamegeek.com/boardgame/353938/dirty-laundry-sabotage-shedding-game) ·
[publisher](https://quokkagames.com/products/dirty-laundry) ·
[retail description](https://morethanmeeples.com.au/product/dirty-laundry-card-game/) ·
[rules walkthrough video](https://rpggeek.com/video/385775/dirty-laundry-sabotage-shedding-game/dirty-laundry-instructional-walkthrough)

Same theme, same communal machines, same red-sock-ruins-whites core, same "wash all your
laundry first" victory. Two differences that matter: (a) loaded items are **concealed**, so
the destructive interaction is a memory/bluffing game rather than a public-information one;
(b) it is explicitly marketed as a **sabotage** game, i.e. it leans into the take-that rather
than trying to be tactical. Other laundry games worth 20 minutes of rules-reading:
[Washing Machine Game](https://boardgamegeek.com/boardgame/14363/washing-machine-game),
[Washing Lines](https://boardgamegeek.com/boardgame/240895/washing-lines),
[Monster Laundry](https://boardgamegeek.com/boardgame/166929/monster-laundry),
[Tokyo Coin Laundry](https://www.jordandraper.com/tokyocoinlaundry).

The strategic question this raises: Laundromat's differentiator cannot be "laundry" or
"communal machines." It has to be **open-information tactical loading** — the opposite of
Dirty Laundry's hidden-sabotage design. That choice should be made deliberately and defended,
and it drives most of the recommendations below.

---

## 1. Shared contested space

**Problem in Laundromat.** 4–7 machines, no capacity limit, everyone loads into them, and one
dark shoe voids the entire machine for everyone else. Whether this reads as a tactical duel
or as weather depends entirely on how much a player knows at the moment they commit an item —
and Laundromat currently gives them very little, because the die tells them *how many* items
they must load before they choose *which*, and because the reckoning happens after two more
phases of other people's actions.

**Games that faced it.**

- **6 nimmt! / Take 5** (Kramer, 1994) — four shared rows; the sixth card into a row forces
  that player to eat it. Everyone plays simultaneously into the same contested space, and
  everyone's placement degrades everyone else's options.
  [Wikipedia](https://en.wikipedia.org/wiki/6_nimmt!) ·
  [review](https://bumblingthroughdungeons.com/take-5-board-game-review/)
- **Coloretto** (Kramer, 2003) — shared face-up rows; you either take a row or add a card to
  one. The signature move is **"poisoning"**: you dump a card you don't want into a row that
  someone else wants, degrading it.
  [What's Eric Playing review](https://whatsericplaying.com/2016/10/23/coloretto/) ·
  [RPG.net review](https://www.rpg.net/reviews/archive/10/10909.phtml)
- **Kingdomino** — shared tile offer, ordered by value, with pick order as the cost.
  [Meeple Mountain](https://www.meeplemountain.com/reviews/kingdomino/) ·
  [Roll to Review](https://rolltoreview.com/kingdomino-review-a-family-game-favourite/)
- **Camel Up** — shared betting stacks where the first bettor on a camel takes the biggest
  payout, so occupancy by others directly degrades your return.
  [Meeple Mountain](https://www.meeplemountain.com/articles/games-we-love-camel-up-second-edition/)
- **Deep Sea Adventure** — literally a shared consumable (one air supply for all divers).
  [The Thoughtful Gamer](https://thethoughtfulgamer.com/2018/11/28/deep-sea-adventure-review/)

**What worked.**

1. **Total open information at the moment of commitment.** In 6 nimmt! every row end-value is
   visible; in Coloretto every row's contents are visible; in Kingdomino the entire offer and
   the resulting turn order are visible. The player is never surprised by *what is there* —
   only by *what other people will do about it*. That is the difference between tactics and
   weather.
2. **Harm is a consequence of the victim's own choice.** Coloretto's poisoning is prized
   precisely because you don't choose the victim — you make a row worse and someone still has
   to voluntarily take it. Reviewers note this is why it "doesn't feel too personal or too
   aggressive" despite being pure interference
   ([What's Eric Playing](https://whatsericplaying.com/2016/10/23/coloretto/)). Same in
   6 nimmt!: you don't hit anyone, you place a number and the rules resolve.
3. **Simultaneity converts spite into a read.** 6 nimmt! and Incan Gold both commit everyone
   at once, so nobody is "targeted" and there is no last-mover who gets to punish. Faidutti on
   Diamant: simultaneous choices make it "a game of psychology than of statistics"
   ([designer's own site](https://faidutti.com/blog/blog/category/principaux-succes-main-hits/diamant-incan-gold/)).
4. **Legible probability structure.** 6 nimmt!'s penalty values follow visible patterns
   (multiples of 5, 10, 11), so a player can price the risk rather than guess at it.

**What failed and why.**

- **Camel Up's chaos is criticised when it stops being readable** — "the potential for chaos
  in the game doesn't always match the reality"; a hot camel steamrolls and the interference
  tools don't bite
  ([Bumbling Through Dungeons](https://bumblingthroughdungeons.com/camel-up-board-game-review/)).
  Contested space needs the contest to be *actionable*, not just visible.
- **Deep Sea Adventure fails when the shared resource collapses for everyone at once**:
  "nothing but frustration… no one could make it back to the sub"
  ([review roundup](https://rolltoreview.com/deep-sea-adventure-review/),
  [Zatu](https://zatu.com/en-us/blogs/reviews/deep-sea-adventure-boost-review)). A shared
  space where the common outcome is "nobody accomplishes anything" reads as a broken game,
  not a tense one. **This is Laundromat's most likely default state**: with 3–6 players
  loading 1–3 items each into 4–7 machines with no capacity limit, and dark shoes voiding a
  whole machine, the modal reckoning is "almost everything comes back."

**Recommendations.**

- **R1.1 — Make the load phase simultaneous, or at minimum make loading a single
  simultaneous commit.** This is the single highest-value change available. It kills targeting,
  kills turn-order advantage in the machines, and converts every contested machine into a
  read on opponents rather than a punishment from the player seated to your right.
- **R1.2 — Nothing may change a machine's contents between the last load and reckoning.**
  Currently the special-item phase and the key phase both sit between commitment and
  resolution, so a player's read at commit time is worthless. Either move special items and
  the key *before* loading, or accept that loading is a gamble, not a decision.
- **R1.3 — Add capacity limits to machines.** "No capacity limit" removes the entire
  contested-space tension: there is never a moment where a machine is full and you must choose
  a worse one. Capacity is what makes 6 nimmt!'s rows and Kingdomino's offer bite. A capacity
  of ~4–5 also makes the crowding rule meaningful instead of a rare edge case.
- **R1.4 — Make at least one machine reliably clean.** In every good version of this pattern,
  a cautious player has a safe-but-low option. If every machine can be voided by any player,
  the space is weather.

---

## 2. Progress-loss and reset

**Problem in Laundromat.** Items return to hand constantly (any machine with a dark shoe
returns everything else; crowding returns triples; Gang empties every machine). Victory
requires washing all 10 drawn items. Progress loss is therefore the *normal* case, not the
exception, and the Gang card is an uncompensated global wipe.

**Games that faced it.**

- **Incan Gold / Diamant** (Faidutti & Moon) — you lose everything you're carrying, but only
  because you personally chose to take one more step, and everyone chooses simultaneously.
  [Faidutti's designer notes](https://faidutti.com/blog/blog/category/principaux-succes-main-hits/diamant-incan-gold/)
- **Quacks of Quedlinburg** — the bag explodes and you lose *one* of two rewards (points or
  purchasing), never both, and never your accumulated engine.
  [BGG](https://boardgamegeek.com/boardgame/244521/the-quacks-of-quedlinburg) ·
  [detailed review](https://boardgamegeek.com/thread/3159467/the-quacks-of-quedlinburg-a-detailed-review) ·
  [is-it-broken-to-always-explode thread](https://boardgamegeek.com/thread/2638590/quacks-quedlinburg-broken-if-you-choose-always-exp)
- **Can't Stop** — losing a turn's progress; the board state you banked is permanent.
- **Sorry! / Trouble / Parcheesi** — the canonical failure. Being sent back to start "right
  when you're on the precipice of home"; the underlying folk game is literally called
  *Frustration*, and the German ancestor is *Mensch ärgere Dich nicht* ("don't get angry").
  [Nostalgia Central](https://nostalgiacentral.com/pop-culture/toys-games/sorry-2/) ·
  [Trouble](https://en.wikipedia.org/wiki/Trouble_(board_game))
- **Deep Sea Adventure** — global loss that hits everybody (see §1).

**What separates thrilling loss from miserable loss.** Four concrete levers, all present in
the good examples and all absent from the bad ones:

1. **The player chose the risk, knowingly, with the odds visible.** Incan Gold's entire design
   is one decision. Sorry!'s send-back is something that happens *to* you on someone else's
   turn. Note the mapping: this is exactly Engelstein's **input vs. output randomness**
   distinction — randomness before the decision preserves agency, randomness after it destroys
   it; "players are more tolerant of input randomness than output randomness."
   [Skeleton Code Machine](https://www.skeletoncodemachine.com/p/input-output-randomness-part-1) ·
   [Ludology GameTek Classic 183](https://ludology.libsyn.com/gametek-classic-183-input-output-randomness) ·
   [Goonhammer](https://www.goonhammer.com/game-design-discourse-randomness/)
2. **The loss is partial and bounded.** Quacks never takes your bag away; explosion costs you
   *one* of two payouts. Loss should reduce a gain, not erase a position.
3. **Recovery is fast and the loss is small relative to the game.** Incan Gold rounds are
   ~3 minutes. Sorry! can erase 20 minutes of play.
4. **The loss is not caused by another player choosing you.** Every well-regarded example
   above has loss caused by dice/deck/your own choice; every badly-regarded one has loss
   caused by an opponent selecting you.

**Where Laundromat currently sits.** It fails 1, 2, and 4 simultaneously. The die dictates
your action (output randomness at maximum: rolling 4/5/6 means you may not load at all, which
is a pure tempo loss you did not choose); the loss is total per machine; and roll-4 plus
Coloring make opponents the cause. The **Gang** card additionally fails 1 for everyone at once
and is drawn face-down by a player who doesn't know what they drew — meaning *nobody at the
table can plan around it*. That is the Deep Sea Adventure failure mode with no compensating
tension, because nobody chose anything.

**Recommendations.**

- **R2.1 — Make sent-back items cost something small but let the player choose exposure.**
  Right now sent-back items return "with no penalty," which sounds merciful but actually makes
  the whole reckoning feel weightless *and* makes the game long. The better shape is: loading
  is a bet the player sizes, and a failed wash costs a little (e.g. the item returns face-up
  and can't be reloaded next day). Bounded, chosen, recoverable.
- **R2.2 — Cut or radically rework Gang.** An unannounced global wipe drawn by a player who
  doesn't know what they drew is uncompensated output randomness. Cheapest fixes, in order of
  preference: (a) the event card is drawn face-up so everyone can plan the day around it;
  (b) Gang returns only *one* machine, chosen randomly; (c) Gang gives each victim a
  compensation (draw a special item card), turning the wipe into an exchange.
- **R2.3 — Reconsider the die's action table.** A roll that determines *what kind of turn you
  get* is the strongest form of output randomness in the design. Compare: give every player
  the same menu of actions each day and use the die only to size one of them, or let the
  player choose between "load N items" and "take a special item" after seeing the roll.
- **R2.4 — Guarantee monotone progress somewhere.** Bedding requires *two* washes and can be
  reset before finishing; underwear can only wash among underwear. These stack multiplicatively
  with global resets. Consider banking: an item that survives one wash is safe even if the
  machine later fails.

---

## 3. Take-that, griefing, and kingmaking

**Problem in Laundromat.** Roll of 4 = move another player's garment (pure interference, no
gain to the mover). Coloring = ruin every other color in a machine. At 5–6 players, with an
open race-to-wash-10 victory condition, the last few days will be everybody using roll-4s and
Colorings on whoever is closest to winning.

**How bad is this reputationally.** In one survey cited by Skeleton Code Machine, **42% of
respondents named kingmaking the worst multiplayer design issue**
([Is kingmaking cursed?](https://www.skeletoncodemachine.com/p/is-kingmaking-cursed)).

**Standard mitigations and how well they actually work.**
Alex Jaffe's taxonomy, as relayed by Skeleton Code Machine, is the cleanest framework:

| Mitigation | Mechanism | How well it works |
|---|---|---|
| **Barriers** | restrict who can be targeted (adjacency, cost, once-per-game) | Reliable and cheap; costs some expressiveness |
| **Gates** | hide victory progress so nobody knows who to gang up on | Works, but only if progress is genuinely hidden (Puerto Rico, Ticket to Ride) |
| **Carrots** | reward 2nd/3rd place so no player is truly lame-duck | Works; needs a scoring game, poor fit for a binary race |
| **S'mores** | lean in — make the game about politics and story | Works only if the game promises that (Cosmic Encounter, Root, John Company) |

Sources: [University XP, "What is Kingmaking?"](https://www.universityxp.com/blog/2021/7/6/what-is-kingmaking) ·
[Skeleton Code Machine](https://www.skeletoncodemachine.com/p/is-kingmaking-cursed)

**Hidden progress vs. simultaneous action vs. limited attack frequency — which wins?**
The literature does not agree on one, but it does converge on this: **hidden progress attacks
the target-selection problem, simultaneity attacks the timing problem, and neither substitutes
for the other.** The runaway-leader essay in the Fantastic Factories design series argues
explicitly *for* the psychological route — obscure who's leading (Ticket to Ride, 7 Wonders)
rather than build systemic catch-up — because visible catch-up mechanics get gamed: in Power
Grid, "experienced players play around the catch-up mechanic to such a heavy extent that the
catch-up mechanic becomes the game"
([Catch Me If You Can](https://fantastic-factories.medium.com/catch-me-if-you-can-the-runaway-leader-and-catch-up-mechanics-53f0356c440d)).

For Laundromat specifically, **hidden progress is not available** — washed items are public
by nature — so the load-bearing mitigations must be **barriers** and **simultaneity**.

**What failed and why.**

- **Munchkin** is the canonical bad case and the failure is precisely Laundromat's shape (open
  race to a threshold + cheap interference): at level 9 the game "devolves into
  Whack-A-Mole: The Card Game, with players dumping stockpiled cards to block the leader and
  dragging out the endgame"; a 20-minute game "awkwardly stretches into two hours"
  ([Roll to Review](https://rolltoreview.com/munchkin-review/)). Its catch-up rule (charity)
  "rarely happens and if it does, the player receives mostly useless cards"
  ([Fantastic Factories](https://fantastic-factories.medium.com/catch-me-if-you-can-the-runaway-leader-and-catch-up-mechanics-53f0356c440d)).
- **Being forced to choose a victim is itself the problem.** "At higher player counts, players
  can feel targeted and unhappy. Some players can feel anxiety when forced to choose who to
  target with a take-that action"
  ([Mechanical Monolith, Player Elimination](http://blog.mechanicalmonolithgames.com/2022/04/game-design-player-elimination.html)).
  Laundromat's roll-4 *mandates* this choice — you rolled it, you must pick someone.
- **Trash Pandas** (a cute family raccoon game, i.e. Laundromat's tonal neighbour) already
  draws this complaint: "some children may dislike being repeatedly targeted for theft
  actions… these take-that elements can frustrate younger players who lack defensive options"
  ([Meeple Mountain](https://www.meeplemountain.com/reviews/trash-pandas/)). Cozy tone raises
  the cost of griefing, it does not lower it.

**What worked.**

- **Threat over execution.** Stonemaier's stated design line: aim for "tension and positive
  player interaction, not hostility"; "limit the potential for spite while still encouraging
  various forms of interaction"; Scythe "is more often about the threat of combat than combat
  itself"
  ([Stonemaier Games design writing](https://stonemaiergames.com/the-game-within-the-game-and-other-notes-for-gamers/),
  [design blog index](https://stonemaiergames.com/e-newsletter/blog/)).
- **Interference that also advances the interferer.** Coloretto's poisoning is a *placement*,
  which is also your turn's productive action; you are never spending a turn purely to hurt
  someone. This is the cleanest structural answer to kingmaking: if the attack has an
  opportunity cost that only pays off when you're competitive, lame ducks stop attacking.
- **Interference that hits everyone symmetrically.** Coloring, as written, hits *every* other
  color in the machine — this is actually the good version, because the attacker doesn't
  choose a victim. Roll-4 is the bad version.

**Recommendations.**

- **R3.1 — Delete or invert roll-4.** As written it is a mandatory, targeted, gain-free
  attack: the worst archetype in the literature. Cheapest fixes: (a) make it optional and
  give it a productive alternative ("move one garment *or* load 1 item"); (b) make it move
  *any* garment including your own, so it becomes a positioning tool rather than an attack;
  (c) restrict targeting by a barrier — only a player adjacent in seating order, or only a
  garment in a machine you also have items in.
- **R3.2 — Cap interference frequency near the end.** The Munchkin failure is specifically an
  *endgame* failure. A rule like "a player who has washed 8+ items cannot be targeted by
  roll-4" is crude but is the cheapest known fix and directly answers the whack-a-mole
  endgame.
- **R3.3 — Keep Coloring symmetric, never let it become targeted.** It is currently one of the
  better-designed pieces of the game. Do not add a "choose a player" clause.
- **R3.4 — Simultaneity is the highest-leverage anti-kingmaking tool available here**, since
  hidden progress is off the table. See R1.1; the same change buys you §1 and §3 at once.

---

## 4. Rotating power tokens

**Problem in Laundromat.** The key gives sole authority to switch machines on/off — which, per
§3, is the strongest single action in the game (turning a machine off protects its contents and
denies everyone else's reckoning; turning one on "detonates" it). It rotates strictly
round-robin, is free, and cannot be contested.

**Games that faced it.**

- **Sheriff of Nottingham** — the closest structural comparable: a rotating role with unique,
  strong, unilateral authority over everyone else's outcome. Critically, **the game's length is
  defined by the rotation**: it ends when everyone has been Sheriff an equal number of times
  (twice at 3–4 players, once at 5–6).
  [Wikipedia](https://en.wikipedia.org/wiki/Sheriff_of_Nottingham_(board_game)) ·
  [Geeky Hobbies review](https://www.geekyhobbies.com/sheriff-of-nottingham-board-game-review-and-rules/)
- **El Grande** — the King pawn is a hard spatial constraint (you may only place adjacent to
  the King's region; nothing enters or leaves it), and turn order is bought each round with
  single-use power cards whose value trades off against how many caballeros you mobilise.
  [Meeple Mountain](https://www.meeplemountain.com/reviews/el-grande/) ·
  [rules PDF](https://www.yucata.de/langnet/1/elgranderules.pdf) ·
  [I Slay the Dragon on auctions for turn order](https://islaythedragon.com/guides/whats-it-worth-to-ya-a-guide-to-auction-mechanics/)
- **Kingdomino** — the cleanest self-balancing version: taking the more valuable tile
  automatically pushes you later in next round's order. Advantage is *priced*, not *granted*.
  [Meeple Mountain](https://www.meeplemountain.com/reviews/kingdomino/)
- General survey of rotating vs. contested turn order (La Città rotates for fairness;
  Archipelago and Kemet let a player determine order):
  [Games Precipice, "Turn Order"](https://www.gamesprecipice.com/turn-order/) (note: TLS cert
  currently expired, reachable via cache) ·
  [BGDF, "Starting player and turn order"](https://www.bgdf.com/forum/archive/archive-game-creation/game-design/starting-player-and-turn-order) ·
  [BGG, "When should a game have a first-player token?"](https://boardgamegeek.com/thread/3714314/when-should-a-game-have-a-first-player-token)

**What worked.** Two viable shapes, and Laundromat has picked neither cleanly:

1. **Strict rotation + fixed game length that is a multiple of player count** (Sheriff of
   Nottingham). Fairness is guaranteed arithmetically.
2. **Contestable at a real, self-balancing cost** (Kingdomino, El Grande, Tzolk'in-style
   first-player markers). Fairness is guaranteed economically — you can have it if you pay for
   it, and paying for it hurts.

**What failed and why.** The failure mode is **strict rotation with a variable-length game**.
Laundromat ends the instant someone washes 10 items. Depending on when that happens, players
will have held a game-deciding power an unequal number of times, and seat order determines
who gets the last key. In a 6-player game ending on day 8, players 1–2 hold the key twice and
players 3–6 hold it once — a >2x difference in access to the game's strongest action, decided
by seating. This is a known and specific defect, not a matter of taste.

**Recommendations.**

- **R4.1 — Fix the fairness arithmetic.** Either (a) the game cannot end mid-rotation — if
  anyone completes their laundry, finish the current full rotation and resolve ties; or (b)
  make the key contestable rather than rotating.
- **R4.2 — Prefer contestable, priced access (Kingdomino model).** E.g. any player may claim
  the key by discarding a special item card, or by skipping their loading that day. This is
  better than round-robin here because it turns the key into a decision every day for
  everybody, instead of a thing that happens to you every N days.
- **R4.3 — If the key stays round-robin, reduce its power.** "No bonus roll" is not a
  meaningful counterweight to sole authority over machine state. Either let non-keyholders
  contest a switch (e.g. majority of players with items in that machine can veto), or limit
  the key to *turning machines on* (a positive-sum, everyone-can-see-it-coming action) and let
  turning off be available to anyone at a cost.
- **R4.4 — The key should be visible one step ahead.** Everyone should know at load time who
  will hold the key at reckoning. Currently the key passes after event resolution, which is
  fine — just make sure the rules text and the digital UI surface "keyholder today / keyholder
  tomorrow," because the entire loading decision depends on it.

---

## 5. Theme and tone

**Problem in Laundromat.** The theme is a genuine asset — "dark colors ruin light colors in
the wash" is a rule that needs no explanation to any adult, which is rare and valuable. The
risk is that the *rest* of the game (the die's action table, the key, the raccoon, the
special-item deck) is thematically arbitrary and drags the whole thing down to
window-dressing.

**The relevant framework.** Matthew Denton's five-level scale is the most useful published
articulation: games sit between Simulation and Extreme Abstraction, and theme "lands" when it
meaningfully connects to mechanics (his "Balanced" level) versus feeling pasted on when it is
window dressing (his "Abstraction" level, where he places most hobby games including Wingspan)
([The Five Levels of Theme in Board Games](https://finbargames.substack.com/p/the-five-levels-of-theme-in-board)).
Note he considers Patchwork and Power Grid to be games with an *internal narrative metaphor*
rather than a theme — which is precisely the register Laundromat should aim for.

**Games that faced it and worked.**

- **Wingspan** — the exemplar of theme-as-mnemonic: bird powers were chosen to resemble real
  bird behaviour, and reviewers repeatedly say "when a theme is really popping, it makes
  everything else make sense." But note the honest caveat: people play it for "the optimization
  puzzle, relaxed mood, and bright aesthetic," not ornithology
  ([Board Game Design Lab on theme](https://boardgamedesignlab.com/theme/),
  [Going Analog](https://www.goinganalogshow.com/article/71/how-wingspans-theme-helped-my-parents-spread-their-board-gaming-wings)).
- **Trash Pandas** — the direct tonal comparable (cute raccoon, family weight, push-your-luck).
  What reviewers praise is that *every* action maps to raccoon behaviour: rooting through
  trash = drawing, stashing = banking, raiding a rival's rubbish = stealing. "Plain
  old-fashioned fun," one-card player aid, 20 minutes
  ([Meeple Mountain](https://www.meeplemountain.com/reviews/trash-pandas/),
  [What's Eric Playing](https://whatsericplaying.com/2020/01/06/trash-pandas/),
  [The Family Gamers](https://www.thefamilygamers.com/trash-pandas-hot-garbage-or-good-garbage/)).
- **Patchwork** — mundane-domestic (quilting) treated as a pure spatial-economic metaphor;
  cited as an example of internal narrative without explicit theme
  ([Finbar Games](https://finbargames.substack.com/p/the-five-levels-of-theme-in-board)).

**What makes it land, concretely.** In every case above the mapping runs *from real-world
causal logic to rule*, and the rule is the one a layperson would guess. Wingspan's cards do
what the birds do. Trash Pandas' actions are what raccoons do. Laundromat's tier-1 rule (dark
taints light) is exactly this. Its tier-2 rule (light shoes wash while a dark shirt is sent
back) is exactly *not* this — it inverts the principle the player just learned, which is the
most expensive kind of rule because it costs the player their intuition permanently. The brief
already flags this as an OPEN question; the theme argument says resolve it toward intuition.

**What fails.** Themes fail when a mechanic requires the player to hold a rule in memory that
their real-world knowledge contradicts, and when named characters have no mechanical identity.
**Jimothy the raccoon with a spine issue** is currently an event card with a blank effect —
i.e. flavour with no system. That is the definition of pasted-on. Either give Jimothy a
mechanic that a player could *guess* from the description (a raccoon in a laundromat should
plausibly: climb into a machine and occupy a slot; drag one item out and leave it on the
floor; sit on a machine and stop it running) or cut him.

**Recommendations.**

- **R5.1 — Audit every rule against "would a layperson guess this?"** Keep the ones that pass
  (dark taints light, blankets take the whole machine, bedding needs two cycles, underwear
  washed separately, color catcher). Fix or cut the ones that don't (the tier-2 inversion; the
  die's action table, where "roll a 5, draw a special item" has no laundromat meaning).
- **R5.2 — Give Jimothy a guessable mechanic.** Best candidate: Jimothy climbs into a random
  machine and occupies it (blocks loading / counts as a foreign object) until someone spends
  an action to get him out. That is funny, thematic, non-targeted, and creates a contested
  space problem rather than a reset.
- **R5.3 — Reframe the die.** The die currently reads as "roll to see what kind of turn you
  get," which has no laundromat referent and is the single least thematic element. If it must
  stay, theme it: the die is how many machines are free, or how much change you have.
- **R5.4 — Lean into the tonal register that works for this weight**: 20-minute, one-page
  rules, high table-talk, cute art. Trash Pandas is the benchmark for what a cozy-mundane
  animal game is allowed to cost the player in rules overhead. Laundromat's current rules —
  4-tier precedence, three linen exceptions, crowding, machine state, key, two card decks —
  are heavier than the theme promises.

---

## Top 5 risks for Laundromat, ranked

**1. The modal reckoning is "nothing gets washed," and the game becomes a Deep Sea Adventure
death spiral.**
With no machine capacity limit, 3–6 players loading up to 3 items each, and a single dark shoe
voiding an entire machine for everyone else, the expected outcome most days is near-total
send-back. Bedding needs two clean washes on top of that. Deep Sea Adventure draws exactly this
complaint — "nothing but frustration… no one could make it back to the sub"
([Roll to Review](https://rolltoreview.com/deep-sea-adventure-review/)) — and it only has one
shared resource, not seven.
*Cheapest mitigation:* add machine capacity limits (R1.3) and guarantee a low-value safe
option (R1.4); playtest the expected number of items washed per day and target ≥1 per player.

**2. Munchkin endgame — the leader gets whacked and the game will not end.**
Progress is fully public (washed items on the table), the win condition is a visible threshold,
and interference is cheap and repeatable (roll-4 every ~6 rolls per player, plus Coloring, plus
the key). This is the exact configuration that turns Munchkin into "Whack-A-Mole: The Card
Game," stretching 20 minutes into two hours
([Roll to Review](https://rolltoreview.com/munchkin-review/)). Hidden victory progress — the
mitigation the literature most favours
([University XP](https://www.universityxp.com/blog/2021/7/6/what-is-kingmaking),
[Fantastic Factories](https://fantastic-factories.medium.com/catch-me-if-you-can-the-runaway-leader-and-catch-up-mechanics-53f0356c440d))
— is structurally unavailable here.
*Cheapest mitigation:* protect the leader from targeted attacks (R3.2) and make roll-4 optional
with a productive alternative (R3.1). A hard day cap with a tiebreak also caps the damage.

**3. The die removes agency at the moment it matters most (output randomness).**
Rolling 4, 5, or 6 means you load nothing — a tempo loss you did not choose. Rolling 1–3 tells
you *exactly* how many items you must load, before you have chosen which. This is textbook
output randomness, which players tolerate far worse than input randomness
([Skeleton Code Machine](https://www.skeletoncodemachine.com/p/input-output-randomness-part-1),
[Ludology GameTek 183](https://ludology.libsyn.com/gametek-classic-183-input-output-randomness)).
Combined with risk #1, players will feel that outcomes happen *to* them.
*Cheapest mitigation:* let the roll define a menu, not a mandate — after seeing the roll the
player chooses between loading N items and one of the other actions (R2.3).

**4. Roll-4 is a mandatory, targeted, gain-free attack — the worst-documented take-that shape.**
The mover gains nothing; they must pick a victim; the victim did nothing to invite it. Sources
specifically flag forced target selection as generating player anxiety at higher counts
([Mechanical Monolith](http://blog.mechanicalmonolithgames.com/2022/04/game-design-player-elimination.html)),
and Trash Pandas — same cozy-animal register — already gets complaints for exactly this
([Meeple Mountain](https://www.meeplemountain.com/reviews/trash-pandas/)). Contrast Coloretto,
where interference is a placement the victim must voluntarily accept and which "doesn't feel
too personal"
([What's Eric Playing](https://whatsericplaying.com/2016/10/23/coloretto/)).
*Cheapest mitigation:* make roll-4 move *any* garment including your own, or restrict it by a
barrier (adjacent seat / machine you're also in) — R3.1.

**5. The key is unequally distributed because the game length isn't a multiple of player count.**
Sole authority over machine state is the strongest action in the game and it rotates strictly,
but the game ends the moment someone finishes. Sheriff of Nottingham — the closest comparable
for a rotating unilateral-authority role — explicitly ends only when everyone has held it an
equal number of times
([Wikipedia](https://en.wikipedia.org/wiki/Sheriff_of_Nottingham_(board_game))). Laundromat
hands the first-seated players up to twice the access, decided by seating.
*Cheapest mitigation:* finish the current full rotation before the game ends (R4.1a). Better
long-term: make the key contestable at a self-balancing cost, Kingdomino-style (R4.2).

**Honourable mention (not a mechanical risk, a project risk):** *Dirty Laundry: Sabotage
Shedding Game* occupies this premise already. Play it or watch the
[rules walkthrough](https://rpggeek.com/video/385775/dirty-laundry-sabotage-shedding-game/dirty-laundry-instructional-walkthrough)
before investing further, and decide explicitly whether Laundromat's differentiator is
open-information tactics (recommended) or something else.
