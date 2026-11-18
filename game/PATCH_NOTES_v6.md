# PATCH v6 — rebase onto Hermes's run5 (trinkets) + trainer-select + run4 defects

**Base:** Muse v5 tree (run4 + v4 speed + v5 arena + 7 run3-defect fixes, `?v=run5`)
**Merged:** Hermes run5, commit `e6a7e59` — all 10 approved trinkets + `?v=run5`
(`run5-trinket.patch`, sha256 `60a253d6bd397f0f08029b6444b32b0e77a1e56649479f4df81141e6b1e561db`,
verified before applying; reference tree `run5-tree.zip`,
sha256 `b7b64ca7c3285a6773d78f7b6e618c07fddd01042afe3a3c9a310220238eb01e`)
**Merge order:** trinkets first, arena second. **Version:** `?v=run6` in 73 places, 0× run5/run4.
**Deploy:** full tree as-is (`vercel --prod`), `?v=run6` already bumped everywhere.

## Why a rebase, not a plain v5 send

Hermes deployed his own run5 live (commit e6a7e59) with the 10-trinket engine
changes while Muse's v5 was still built on run4. Sending v5 as-is would have
wiped his trinket work. This tree = Hermes run5 + Muse v5, both sides kept.

The patch itself would not `git apply` cleanly: every hunk's context carried
`?v=run4`, but the v5 tree was already at `?v=run5` (73 places). The three
substantive hunks were applied by hand with byte-identical code; the
`?v` hunks were already satisfied. Verified by diffing the merged files
against Hermes's reference tree: every remaining difference is accounted for
below (v5 changes, v6 changes, `?v=run6`).

## 1. Trinkets — all 10, from Hermes run5 (unchanged)

- **Storm Needle** `{multicast,1,target:'leftmost'}` — multicast now lands on
  the leftmost alive ally when the trinket carries `target:'leftmost'`
  (was random). `showdown.js` `trinketFx()`.
- **Shadow Spool** `{dread,3}` — each enemy KO gives player Gloom allies
  +3 flat damage per hit for the rest of the battle (`dreadBonus`, added in
  `strike()`, granted in `faint()`, reset in `finishRunBattle()`).
- **Riposte Charm** `{counter,50}` — a player monster that takes a hit always
  counters for 50% of the damage taken (`counterPct` in `trinketFx()`,
  counter block in `strike()`). No chance roll, unlike the `riposte` ability.
- **Lucky Stitch** `{lucky_item,25}` — 25% roll after a win (`stageReward()`)
  sets `luckyPending`; the next shop gets one bonus item spliced in
  (`shopFor()`), flag persisted in `serializeRun()`/`restoreRun()`.
  Note: the built-in `BUILTIN_SHOP` has monsters only — the bonus item only
  appears once Manus's `shop.json` lands with item rows.
- **Woolly Charm** `{post_battle_heal,2}` — replaces the between-battle full
  heal with +2 HP (`finishRunBattle()` in `main.js`); chip damage persists
  across battles, by design. Board does NOT full-heal while holding it.

## 2. Trainer-select layout (Manus #351, REQQDATA1 blocker)

Live run5 `drawTrainerSelect()` laid cards in one row with a fixed width sized
for 3, so trainers 4–6 fell off-canvas. Fixed with an adaptive grid
(`run.js`): 3 per row; when a second row is needed the cards shrink
(320×290 instead of 320×330) and the grid starts at y=130, so 6 cards fit in
800px (row 2 ends at y=734, right edge x=1156). The 3-trainer layout is
byte-identical to before (330px cards at y=160). Generic for 6+ trainers, so
it works with the 3 placeholders now and with 6 rows when Manus's
`trainers.json` lands (approved Raka/Sari/Bimo rows untouched).

## 3. Run4-playtest defects

- **Speed status line barely legible** (run4 playtest): pale green text on a
  translucent pale pill, baseline y=54 overlapping the pause/ff buttons.
  Pill is now 260×62 (was 240×50), status on its own line at y=66 in dark
  ink `#3b2c17` (paused: dark amber `#b25e00`). (`showdown.js`
  `drawShowdownHud()`; HP-bar panels start at y=66 but sit at x≤456 /
  x≥824, clear of the centre pill at x 510–770.)
- **BATTLE button '✕'**: the label was `BATTLE ⚔` — the ⚔ glyph renders as
  a tofu/✕-like mark in the canvas monospace font. Label is now plain
  `BATTLE`. (The `🔒 LOCKED` label was not flagged; left alone.)
- **Full-board click with no feedback**: `buy()` already returned
  `'board full (6)'` and `main.js` stored it in `run._msg` — but nothing
  ever drew `run._msg`. `drawShop()` now renders it in red at y=630, and the
  empty-board hint only shows when there is no message (same line, no
  overlap). Message text is now `'board full (max 6)'`.

## Untouched (guardrails)

v4 speed (toggle 1→2→1, `STRIKE_GATE` 0.7s, damage-number linger 1.1s),
v5 arena geometry (middle gap 122px, columns 200px, rows 330/550), v3 fixes
(`applyPassive` element scoping, `clearFx` ×4, `codexFrom` ×9, Gloomcap
wire-in), bright palette, balance. Card-art-v2 PNGs NOT wired (art batch
still running — separate follow-up).

## Verification (36/36 headless checks, `/tmp/v6-verify.mjs`)

- `node --check` on all 20 `src/*.js` — pass.
- `?v=run6` ×73 / run5 ×0 / run4 ×0.
- Live tests of the real merged code (stubbed imports): Lucky Stitch bonus
  item spliced into the shop + flag consumed; 25% roll sets `luckyPending`;
  `serializeRun` persists it; Storm Needle multicast lands on leftmost
  (slot 0); Riposte `counterPct` = 50; Shadow Spool +3 DREAD to a Gloom ally
  on enemy KO; Woolly +2 HP (chips persist, no full heal) vs full heal
  without it; Day-10 win sets `champion` and opens the champion screen once;
  Day-10 loss retries Day 10; endless Day 11 → Day 12.
- Diff vs Hermes's reference run5 tree: the only differences in
  `main.js`/`run.js`/`showdown.js` are the v5 changes, the v6 changes above,
  and `?v=run6` — all trinket logic is byte-identical to Hermes's run5.
- **Not verified live (needs browser playtest after deploy):** 6-trainer
  grid rendering, speed-pill legibility on screen, BATTLE label, the
  'board full' message, and the new trinket semantics in a real run.
