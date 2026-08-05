# Laundromat — Simulation Run 1 (archived raw output)

**Archived:** 2026-08-03. Preserved verbatim from `sim/out/*.txt`.

## Provenance and caveats — READ BEFORE USING THESE NUMBERS

- Run against **brief v5 rules**, NOT current (v7). Specifically this run had:
  - machine count 3/3/4/4 (v7: `players + 1`)
  - capacity 4 flat (v7: `players + 1`)
  - Gang as a **total board wipe** (v7: permanently destroys one machine, once)
  - Electricity as a one-day reckoning skip (v7: switches every machine OFF)
  - **Jimothy fright rule ACTIVE** — 19-32% of his departures are by fright.
    v7 deletes fright entirely, so squat lengths here are **underestimates**.
  - Animal control as a special item (v7: an event card)
  - the key-rotation-completion victory rule (v7: deleted)
- `occ.txt` (section 4, occupancy verification) **failed to produce output** — it contains
  only a multiprocessing warning. Occupancy figures below come from `cont.txt` instead.
- The run **never produced `design/balance-report.md`**; the agent died twice. These are
  raw section dumps, not an analysed report.
- `NAIVEKEY` is a deliberately weak keyholder policy. Its long games were later diagnosed
  as an "OFF-drift deadlock" — the keyholder repeatedly switching machines off and jamming
  the board. Earlier length figures quoted in conversation (median 42 days at 6 players)
  came from this policy and are **not representative of competent play**.

---

## Raw: sim/out/main.txt

```

## 1. GAME LENGTH (days)

| policy | P | mean | +/-95% | median | p10 | p90 | p99 | max | >40d | capped | ext.days |
|---|---|---|---|---|---|---|---|---|---|---|---|
| RANDOM | 3 | 39.4 | 0.20 | 39 | 27 | 54 | 69 | 90 | 42.5% | 0 | 1.0 |
| RANDOM | 4 | 45.7 | 0.21 | 44 | 32 | 60 | 76 | 104 | 60.1% | 0 | 1.5 |
| RANDOM | 5 | 44.1 | 0.21 | 45 | 30 | 60 | 75 | 95 | 52.8% | 0 | 2.0 |
| RANDOM | 6 | 48.9 | 0.22 | 48 | 36 | 66 | 78 | 108 | 78.8% | 0 | 2.5 |
| GREEDY | 3 | 12.6 | 0.05 | 12 | 9 | 15 | 21 | 33 | 0.0% | 0 | 1.0 |
| GREEDY | 4 | 15.4 | 0.06 | 16 | 12 | 20 | 24 | 32 | 0.0% | 0 | 1.5 |
| GREEDY | 5 | 15.3 | 0.06 | 15 | 10 | 20 | 25 | 30 | 0.0% | 0 | 2.0 |
| GREEDY | 6 | 17.7 | 0.07 | 18 | 12 | 24 | 24 | 36 | 0.0% | 0 | 2.5 |
| CAUTIOUS | 3 | 12.8 | 0.05 | 12 | 9 | 15 | 21 | 33 | 0.0% | 0 | 1.0 |
| CAUTIOUS | 4 | 15.9 | 0.06 | 16 | 12 | 20 | 24 | 32 | 0.0% | 0 | 1.5 |
| CAUTIOUS | 5 | 15.6 | 0.06 | 15 | 10 | 20 | 25 | 30 | 0.0% | 0 | 2.0 |
| CAUTIOUS | 6 | 18.3 | 0.07 | 18 | 12 | 24 | 30 | 36 | 0.0% | 0 | 2.5 |
| NAIVEKEY | 3 | 27.7 | 0.43 | 18 | 12 | 69 | 108 | 168 | 19.9% | 0 | 1.0 |
| NAIVEKEY | 4 | 44.2 | 0.45 | 40 | 16 | 80 | 104 | 144 | 48.1% | 0 | 1.5 |
| NAIVEKEY | 5 | 38.1 | 0.37 | 35 | 15 | 70 | 90 | 125 | 38.5% | 0 | 2.0 |
| NAIVEKEY | 6 | 44.4 | 0.33 | 42 | 18 | 72 | 90 | 120 | 58.7% | 0 | 2.5 |


### Estimated table time (minutes). A day costs 60-90s PER PLAYER,
### so one day = P x 60..90 seconds.

| policy | P | mean @60s | mean @90s | median @75s | p90 @60s | p90 @90s |
|---|---|---|---|---|---|---|
| RANDOM | 3 | 118 | 177 | 146 | 162 | 243 |
| RANDOM | 4 | 183 | 274 | 220 | 240 | 360 |
| RANDOM | 5 | 221 | 331 | 281 | 300 | 450 |
| RANDOM | 6 | 293 | 440 | 360 | 396 | 594 |
| GREEDY | 3 | 38 | 57 | 45 | 45 | 68 |
| GREEDY | 4 | 62 | 93 | 80 | 80 | 120 |
| GREEDY | 5 | 77 | 115 | 94 | 100 | 150 |
| GREEDY | 6 | 106 | 160 | 135 | 144 | 216 |
| CAUTIOUS | 3 | 38 | 57 | 45 | 45 | 68 |
| CAUTIOUS | 4 | 64 | 95 | 80 | 80 | 120 |
| CAUTIOUS | 5 | 78 | 117 | 94 | 100 | 150 |
| CAUTIOUS | 6 | 110 | 165 | 135 | 144 | 216 |
| NAIVEKEY | 3 | 83 | 125 | 68 | 207 | 310 |
| NAIVEKEY | 4 | 177 | 265 | 200 | 320 | 480 |
| NAIVEKEY | 5 | 190 | 286 | 219 | 350 | 525 |
| NAIVEKEY | 6 | 267 | 400 | 315 | 432 | 648 |


## 3. WASH THROUGHPUT

| policy | P | L (loads/pl/day) | wash ev/pl/day | items clean/day | dead reck % (non-empty) | dead reck % (all ON) | player-days w/ 0 washes % | items washed per non-empty reckoning |
|---|---|---|---|---|---|---|---|---|
| RANDOM | 3 | 0.55 | 0.24 | 0.66 | 14.0 | 57.1 | 78.2 | 0:14% 1:78% 2:7% 3:1% 4:0% |
| RANDOM | 4 | 0.55 | 0.20 | 0.71 | 15.6 | 54.3 | 82.1 | 0:16% 1:74% 2:8% 3:1% 4:0% |
| RANDOM | 5 | 0.56 | 0.20 | 0.89 | 15.3 | 57.5 | 82.2 | 0:16% 1:75% 2:8% 3:1% 4:0% |
| RANDOM | 6 | 0.56 | 0.17 | 0.93 | 16.4 | 56.6 | 84.4 | 0:17% 1:73% 2:9% 3:1% 4:0% |
| GREEDY | 3 | 1.22 | 0.83 | 2.28 | 4.4 | 27.8 | 41.2 | 0:5% 1:71% 2:18% 3:5% 4:2% |
| GREEDY | 4 | 1.13 | 0.66 | 2.42 | 3.4 | 29.1 | 51.4 | 0:4% 1:63% 2:22% 3:8% 4:4% |
| GREEDY | 5 | 1.17 | 0.66 | 3.05 | 3.7 | 32.3 | 52.1 | 0:4% 1:64% 2:21% 3:7% 4:4% |
| GREEDY | 6 | 1.09 | 0.56 | 3.12 | 3.1 | 34.6 | 58.0 | 0:3% 1:59% 2:23% 3:9% 4:6% |
| CAUTIOUS | 3 | 1.21 | 0.81 | 2.25 | 4.3 | 27.7 | 41.8 | 0:5% 1:73% 2:16% 3:5% 4:2% |
| CAUTIOUS | 4 | 1.11 | 0.64 | 2.35 | 3.2 | 29.1 | 52.5 | 0:3% 1:67% 2:18% 3:8% 4:4% |
| CAUTIOUS | 5 | 1.16 | 0.65 | 2.98 | 3.4 | 32.2 | 53.0 | 0:4% 1:68% 2:17% 3:7% 4:4% |
| CAUTIOUS | 6 | 1.07 | 0.54 | 3.01 | 2.8 | 34.6 | 59.4 | 0:3% 1:65% 2:18% 3:9% 4:6% |
| NAIVEKEY | 3 | 0.82 | 0.55 | 1.53 | 2.5 | 25.8 | 59.2 | 0:3% 1:66% 2:21% 3:7% 4:3% |
| NAIVEKEY | 4 | 0.46 | 0.29 | 1.10 | 0.9 | 28.4 | 77.0 | 0:1% 1:56% 2:23% 3:12% 4:8% |
| NAIVEKEY | 5 | 0.52 | 0.31 | 1.46 | 0.9 | 30.9 | 75.7 | 0:1% 1:56% 2:23% 3:11% 4:9% |
| NAIVEKEY | 6 | 0.35 | 0.22 | 1.25 | 0.4 | 33.9 | 82.1 | 0:1% 1:49% 2:24% 3:13% 4:12% |

```

## Raw: sim/out/occ.txt

```

## 4. OCCUPANCY -- verifying the designer's arithmetic

/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/multiprocessing/resource_tracker.py:216: UserWarning: resource_tracker: There appear to be 5 leaked semaphore objects to clean up at shutdown
  warnings.warn('resource_tracker: There appear to be %d '
```

## Raw: sim/out/cont.txt

```

## 5. CONTENTION

| policy | P | reckonings where crowding fires | machine-days at capacity | load offers with a full machine | board-lock offers | items/reckoning sent back BY ANOTHER PLAYER | share of send-backs that are interference | occupancy |
|---|---|---|---|---|---|---|---|---|
| RANDOM | 3 | 0.4% | 6.4% | 12.5% | 2.11% | 0.275 | 23.8% | 1.01 |
| RANDOM | 4 | 0.9% | 9.9% | 18.5% | 3.77% | 0.426 | 25.3% | 1.20 |
| RANDOM | 5 | 0.8% | 8.6% | 20.9% | 1.87% | 0.420 | 23.8% | 1.11 |
| RANDOM | 6 | 1.1% | 11.5% | 26.2% | 3.08% | 0.540 | 23.8% | 1.24 |
| GREEDY | 3 | 0.0% | 5.6% | 6.9% | 0.82% | 0.355 | 46.1% | 1.12 |
| GREEDY | 4 | 0.0% | 9.0% | 13.0% | 1.18% | 0.541 | 36.8% | 0.87 |
| GREEDY | 5 | 0.0% | 9.8% | 18.7% | 0.46% | 0.561 | 34.1% | 0.89 |
| GREEDY | 6 | 0.0% | 10.3% | 21.4% | 0.58% | 0.656 | 29.3% | 0.72 |
| CAUTIOUS | 3 | 0.0% | 5.4% | 6.7% | 0.75% | 0.361 | 46.6% | 1.09 |
| CAUTIOUS | 4 | 0.0% | 8.2% | 12.1% | 1.00% | 0.544 | 37.1% | 0.82 |
| CAUTIOUS | 5 | 0.0% | 8.8% | 17.3% | 0.35% | 0.576 | 34.8% | 0.83 |
| CAUTIOUS | 6 | 0.0% | 8.7% | 19.2% | 0.38% | 0.669 | 30.4% | 0.65 |


## 6. THE KEY AND SEAT ORDER

| policy | P | fair share | win % by seat (1..P) | max seat edge (pp) | chi-sq p-ish |
|---|---|---|---|---|---|
| RANDOM | 3 | 33.3% | 35.2 33.3 31.5 | 1.88 | X2=25.1 SIGNIFICANT |
| RANDOM | 4 | 25.0% | 26.6 25.4 24.7 23.2 | 1.64 | X2=29.9 SIGNIFICANT |
| RANDOM | 5 | 20.0% | 21.6 19.8 20.8 19.5 18.4 | 1.55 | X2=34.6 SIGNIFICANT |
| RANDOM | 6 | 16.7% | 18.1 16.6 16.4 16.9 16.2 15.9 | 1.40 | X2=20.8 SIGNIFICANT |
| GREEDY | 3 | 33.3% | 38.4 32.2 29.3 | 5.09 | X2=155.4 SIGNIFICANT |
| GREEDY | 4 | 25.0% | 26.4 24.3 25.1 24.2 | 1.41 | X2=15.3 SIGNIFICANT |
| GREEDY | 5 | 20.0% | 21.4 19.8 19.3 19.6 19.9 | 1.38 | X2=15.6 SIGNIFICANT |
| GREEDY | 6 | 16.7% | 16.4 15.9 16.1 17.1 17.7 16.9 | 1.00 | X2=16.3 SIGNIFICANT |
| CAUTIOUS | 3 | 33.3% | 38.0 32.2 29.7 | 4.72 | X2=131.5 SIGNIFICANT |
| CAUTIOUS | 4 | 25.0% | 26.6 24.3 24.9 24.3 | 1.55 | X2=16.5 SIGNIFICANT |
| CAUTIOUS | 5 | 20.0% | 20.6 19.6 19.8 19.8 20.2 | 0.62 | X2=4.0 ns |
| CAUTIOUS | 6 | 16.7% | 17.4 15.2 15.8 17.2 17.0 17.4 | 0.70 | X2=31.0 SIGNIFICANT |


### Win rate vs number of key-holds (key-holds are equal by construction when the rotation rule is on, so this tests the rule's effect directly)

| P | mean days WITH rotation rule | mean days WITHOUT | games w/ unequal key access (no rule) | winner held the most keys (no rule) | chance baseline |
|---|---|---|---|---|---|
| 3 | 27.7 | 26.7 | 67.0% | 42.1% | 33.3% |
| 4 | 44.2 | 42.7 | 74.8% | 41.9% | 25.0% |
| 5 | 38.1 | 36.1 | 80.3% | 44.5% | 20.0% |
| 6 | 44.4 | 42.0 | 83.3% | 42.7% | 16.7% |

```

## Raw: sim/out/jim.txt

```

## 8. JIMOTHY

| P | M | Jimothy uptime (% of days) | effective machines | mean squat (days) | median | p90 | p99 | max | counter READY on arrival | how he leaves |
|---|---|---|---|---|---|---|---|---|---|---|
| 3 | 3 | 28.9% | 2.71 | 2.54 | 2 | 4 | 7 | 15 | 61.2% | Animal control 40% Snack 7% fright 32% game_end 6% relocate 16% |
| 4 | 3 | 28.9% | 2.71 | 2.27 | 2 | 3 | 6 | 12 | 77.2% | Animal control 54% Snack 5% fright 25% game_end 3% relocate 13% |
| 5 | 4 | 30.7% | 3.69 | 2.15 | 2 | 3 | 5 | 11 | 79.0% | Animal control 56% Snack 6% fright 23% game_end 3% relocate 12% |
| 6 | 4 | 31.0% | 3.69 | 2.07 | 2 | 2 | 4 | 9 | 84.8% | Animal control 64% Snack 5% fright 19% game_end 2% relocate 9% |


### Dead cards and event pressure

| P | days with an event | days with a Gang | items destroyed per Gang | days with an Electricity | player-days holding a dead Snack | player-days holding a dead Animal control |
|---|---|---|---|---|---|---|
| 3 | 39.3% | 11.0% | 3.01 | 12.4% | 17.7% | 10.4% |
| 4 | 49.7% | 14.1% | 2.85 | 15.5% | 25.2% | 13.7% |
| 5 | 58.0% | 16.5% | 4.08 | 17.9% | 21.0% | 11.8% |
| 6 | 65.3% | 18.9% | 3.60 | 20.0% | 22.1% | 13.1% |


### Special item usage

| P | Coloring | Color catcher | Bleach | Wash net | Handwash basket | Snack | Animal control | items ruined per Coloring | basket usage split |
|---|---|---|---|---|---|---|---|---|---|
| 3 | 1.01 | 0.13 | 0.39 | 0.23 | 9.85 | 0.73 | 5.58 | 0.59 | bedding 28% hand 72% hostage 0% machine 0% |
| 4 | 1.14 | 0.15 | 0.40 | 0.18 | 18.26 | 0.86 | 9.17 | 0.57 | bedding 24% hand 75% hostage 0% machine 0% |
| 5 | 1.58 | 0.22 | 0.62 | 0.26 | 20.88 | 1.23 | 9.87 | 0.63 | bedding 26% hand 74% hostage 0% machine 0% |
| 6 | 1.73 | 0.23 | 0.61 | 0.20 | 28.29 | 1.34 | 12.17 | 0.61 | bedding 25% hand 75% hostage 0% machine 0% |

```

## Raw: sim/out/skew.txt

```

## THE RIGHT TAIL -- what makes a long game long

### P=3  (n=12000, mean 27.7, median 18, p90 69, max 168)

| feature | corr with game length |
|---|---|
| baskets played | 0.919 |
| realized L | -0.896 |
| occupancy | -0.856 |
| wash events / player-day | -0.824 |
| dead-reckoning rate | -0.280 |
| event-day fraction | 0.261 |
| interference / reckoning | 0.253 |
| winner's underwear in hand | 0.091 |
| winner's bedding in hand | 0.061 |
| min underwear across players | 0.039 |
| min (bedding+underwear) | 0.039 |
| winner's dark items | -0.020 |
| crowding rate | 0.018 |
| winner's shoes in hand | 0.012 |
| min bedding across players | 0.006 |
| Jimothy uptime | -0.004 |

Bottom quartile (<= 12 days) vs top quartile (>= 30 days):

| feature | short games | long games |
|---|---|---|
| realized L | 1.178 | 0.245 |
| occupancy | 1.523 | 0.340 |
| dead-reckoning rate | 0.028 | 0.007 |
| wash events / player-day | 0.879 | 0.158 |
| Jimothy uptime | 0.243 | 0.284 |
| crowding rate | 0.000 | 0.000 |
| baskets played | 0.962 | 9.600 |
| min (bedding+underwear) | 1.721 | 1.850 |
| winner's bedding in hand | 1.078 | 1.230 |

### P=4  (n=12000, mean 44.2, median 40, p90 80, max 144)

| feature | corr with game length |
|---|---|
| baskets played | 0.919 |
| realized L | -0.893 |
| occupancy | -0.876 |
| wash events / player-day | -0.846 |
| event-day fraction | 0.360 |
| dead-reckoning rate | -0.303 |
| winner's underwear in hand | 0.192 |
| interference / reckoning | 0.142 |
| min underwear across players | 0.067 |
| winner's bedding in hand | 0.061 |
| min (bedding+underwear) | 0.050 |
| Jimothy uptime | -0.049 |
| winner's dark items | -0.039 |
| winner's shoes in hand | -0.025 |
| min bedding across players | 0.012 |
| crowding rate | -0.006 |

Bottom quartile (<= 20 days) vs top quartile (>= 64 days):

| feature | short games | long games |
|---|---|---|
| realized L | 0.918 | 0.107 |
| occupancy | 1.714 | 0.184 |
| dead-reckoning rate | 0.018 | 0.001 |
| wash events / player-day | 0.581 | 0.101 |
| Jimothy uptime | 0.286 | 0.277 |
| crowding rate | 0.000 | 0.000 |
| baskets played | 2.067 | 20.698 |
| min (bedding+underwear) | 1.577 | 1.681 |
| winner's bedding in hand | 1.142 | 1.254 |


### Length ordering across player counts vs occupancy (GREEDY)

| P | M | realized L | predicted occ = L*P/M | measured occ | wash ev/pl/day | mean days | median | p90 |
|---|---|---|---|---|---|---|---|---|
| 6 | 4 | 0.35 | 0.53 | 0.72 | 0.22 | 44.4 | 42 | 72 |
| 4 | 3 | 0.46 | 0.61 | 0.87 | 0.29 | 44.2 | 40 | 80 |
| 5 | 4 | 0.52 | 0.65 | 0.89 | 0.31 | 38.1 | 35 | 70 |
| 3 | 3 | 0.82 | 0.82 | 1.12 | 0.55 | 27.7 | 18 | 69 |

```

