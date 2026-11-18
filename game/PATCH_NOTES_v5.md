# PATCH v5 — Batomon-style roomy arena + run3 playtest defects

**Version: `?v=run5`** (bumped in index.html + all src imports, 73 places; 0× run4 left)
**Base:** live run4 tree (v3 + bright UI v2 + v4 speed). Full tree, 107 files.
**Deploy:** unzip over the deploy tree, deploy as-is, verify `main.js?v=run5` live.
**Not touched:** v4 speed (2x cap, STRIKE_GATE 0.7s, damage-number linger), v3 fixes,
bright palette, applyPassive, trinket/item hooks, Bimo's hook, balance (coins/damage/HP).

## A. Battleground too roomy — owner: "battleground-nya kurang lega, harusnya mirip Batomon"

Canvas 1280×800. `src/showdown.js` `slotPos()` only; no sprite scale change needed.

| measurement | before (run4) | after (run5) |
|---|---|---|
| player columns x | 560 / 380 / 200 | 520 / 320 / 120 |
| enemy columns x | 720 / 900 / 1080 | 760 / 960 / 1160 |
| column step | 180 | 200 |
| rows y | 340 / 545 | 330 / 550 |
| middle clear gap (front sprites, 118px wide) | 42px | **122px** |
| column clear gap | 62px | **82px** |
| row clear gap (row-0 charge bar → row-1 ability) | ~36px | **44px** |
| floor band | y 260–600 | y 240–660 |

All 12 slots inside the canvas with boss-size (150px) margin; player-left /
foes-right facing unchanged; VS splash and end screens unchanged; strike cadence
and balance untouched.

## B. Run3 playtest defects (all verified live 17:38 WIB)

### B1. VS "YOUR SQUAD" / "WILD SQUAD" labels under bottom-row feet
`showdown.js` drawVS: label y 520 → **580**. Bottom-row units stand at y 480 with
feet/shadow to ~530; the label now clears them by ~28px.

### B2. "click to continue" over bottom-row trait/Lv labels
`showdown.js` drawEnd: prompt y `VIEW_H/2+62` (= 462) → **700**. That sat exactly on
the bottom-row Lv (~472) and ability (~458) nameplates. The bottom of the screen is
free during the 'end' phase (no action buttons then); HP/charge bars end ~629.

### B3. Gold-coin glyph renders as a black disc "●"
`run.js`: the `⬤` glyph (U+2B24) renders as a black disc in the game's monospace
ink font. Fixed everywhere a coin amount is drawn by using the real `coin_icon` PNG:
- top bar: coin icon already drawn, so the glyph is dropped — bare number now.
- shop item cost & monster cost: `drawSlice(coin_icon)` + number (was `⬤ ${cost}`).
- REROLL button: label is now text-only (`REROLL 3`); the coin icon is drawn
  just left of the centred label after the button panel.
- reward screen gain: coin icon + `+${gain}` (was `+⬤ ${gain}`).
Untouched on purpose: the `⬤` in `showdown.js` unit counters and the `●` in the
Codex "bound" indicator are decorative coloured bullets, not coin amounts.

### B4. Codex TYPE CHART clipped / overlapping text
`src/screens.js` drawCodex: species cells `cellW` 262 → **236**. The chart wedge
was only 132px wide (cx 1108): its multiplier columns ran off-canvas (last column
at x 1312) and the footer lines centred at cx+150 clipped past the right edge.
Now cx 1004, panel 236px wide: grid ends at cx+217, footers span cx+20..cx+216,
all centred on cx+118. Pre-existing and NOT in scope: the Codex species grid is
4 cols × 11 rows (41 creatures), so most rows are off-screen — same as before.

### B5. Day-7 anomaly — VICTORY overlay, then DEFEAT screen + heart lost
**Real bug, root cause found in code.** `drawReward` derived VICTORY/DEFEAT from
`r.trinkets.length`, not the actual outcome. `stageReward(won=true)` with an
exhausted 6-entry trinket pool (all 6 owned — normal by Day 7) yields `trinkets=[]`,
so a WON battle displayed "DEFEAT…" + "you lost a heart". No heart was actually
lost (`stageReward` on a win never touches hearts) — the display lied, the state
didn't. Fix (`run.js`): the reward now carries `won` (`run.reward.won`), and
`drawReward` derives title, subtitle and colour from `r.won`. This also fixes a
second latent bug: the old title colour keyed on `r.gain > 0`, and gain is 4 even
on a loss, so "DEFEAT…" was drawn green. Headless repro (win + pool exhausted)
passes: `won=true`, `trinkets=[]`, hearts unchanged.

### B6. Day-10 screen said "7 hearts" while 6 pink hearts shown
**Real bug, root cause found in code — and worse than the count.** `heartsRow` and
the champion text both read `run.hearts` in the same frame, so they cannot disagree
same-frame; the mismatch came from the sequence. `nextDay`'s champion branch fired
on ANY Day-10 exit including a Day-10 LOSS (`if (run.day >= 10 && !run.champion)`),
because `finishRunBattle` records a real Day-10 win in `run.champion` — on a win
champion was already true so the branch was skipped (day advanced to 11, champion
screen never shown), while on a loss it crowned the run "QUILT CHAMPION" with
"Day 10 cleared" and a hearts count from the wrong moment. Fix (`run.js`):
the champion branch is now gated on `run.champion && !run.championShown`
(new flag, init false in `makeRun`, kept in `serializeRun`); a Day-10 loss retries
Day 10 (day stays 10, fresh shop, no endless). The hearts text and hearts row now
agree by construction (both read `run.hearts` on the same reward). Headless tests:
Day-10 win → champion once; Day-10 loss → retry Day 10; endless Day 11 → Day 12.
(While fixing this, a self-review caught that `day < 10` gating would have frozen
endless progression at Day 11 — the day now advances whenever it isn't exactly 10.)

### B7. LEVEL UP banner never seen though units leveled up
**Trigger worked; the banner was effectively invisible.** `settleXp` popped one
"LEVEL UP!" per level EVENT — a unit jumping Lv1→Lv3 stacked two identical pops —
and each lived only 1.8s under the 55% end veil, positioned where overlay text sits.
Fix (`showdown.js` + `main.js` + `run.js`): one pop per unit at its final level,
life 3.0s; the list is recorded in `this.levelUps` (init in constructor),
`finishRunBattle` copies it to `run.reward.levelUps`, and `drawReward` announces
"★ LEVEL UP: <name> Lv<n> · …" at y=232 — clear of the hearts line (204) and the
NEXT DAY button (300). So: the trigger was fine, the rendering was the problem;
both are now fixed and the reward screen states it in plain text.

## Files touched
- `src/showdown.js` — arena slotPos + floor band, VS label y, click-to-continue y,
  settleXp levelUps (one pop/unit, 3.0s), levelUps init.
- `src/run.js` — coin glyph → coin PNG (top bar, 2 shop costs, reroll, reward gain),
  `stageReward` carries `won`, `drawReward` verdict/subtitle/colour from `r.won`
  + level-ups line, `nextDay` champion gating + `championShown` (makeRun/serializeRun).
- `src/screens.js` — Codex TYPE CHART: cellW 262→236, footer/icon centres cx+150→cx+118.
- `src/main.js` — `finishRunBattle` passes `b.levelUps` to `run.reward`.
- `index.html` + all `src/*` imports — `?v=run4` → `?v=run5` (73 places).

## Verification (headless, node 24)
- `node --check` on all 20 `src/*.js` files — pass.
- 45/45 checks in `/tmp/v5-verify.mjs` — pass, including:
  - arena: all 12 slots in-bounds (boss margin), middle gap 122px, column gap 82px,
    row gap 44px; VS label clears feet by 28px; click-to-continue clears bars by 71px.
  - `?v=run5` ×73, `?v=run4` ×0; no FRENZY/4×; STRIKE_GATE 0.7s; toggleSpeed 1→2→1.
  - v3 fixes intact: applyPassive element scoping, clearFx (4 call sites), codexFrom
    (9 sites), gloomcap in HAS_ART + GHIBLI_ART.
  - B5 repro: win + exhausted trinket pool → `won=true`, no heart lost.
  - B6: Day-10 win → champion once; Day-10 loss → retry; endless Day 11 → 12.
  - B7: settleXp records one level-up per unit at final level, 3.0s pops.
  - TYPE CHART: panel 236px, grid inside panel, longest footer inside panel.
- **Not verified live** (no browser in this session): the arena must be eyeballed
  on the live build — check the 122px middle gap reads spacious, VS labels sit
  clear of feet, the coin PNG renders in shop/reroll/reward, the TYPE CHART fits,
  and play a Day-7+ run to see the VICTORY/DEFEAT verdict and LEVEL UP line.
  Also unverified live: the LEVEL UP banner's in-battle pop position (y-112) with
  the widened rows.
