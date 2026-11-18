# PATCH v8 — Hermes run7 + 3 playtest fixes, `?v=run8`

**Base:** Hermes's run7 tree — GitHub `jinkatama105/quilt-monsters` @
`3fe0104` (`3fe01042581e37dee5eb7e5bcd13b55072a0d566`, "screens: refresh
run/shop/end/pause/vs shots; game: run7 trinket notes", 2026-11-18T12:06:21Z),
deployed live as `?v=run7` by Hermes #358/#360.
**Version:** `?v=run8` ×74 in `index.html` + `src`, 0× run7/run6/run5/run4 in code.
**Deploy:** full tree as-is (`vercel --prod`), `?v=run8`.

## Why a new version number

Hermes's run7 is already live under `?v=run7`. The merged build has new
content (the 3 playtest fixes), so it must not share the version string —
otherwise browsers can keep serving the un-fixed run7. `?v=run8` is always
the merged build (run7 trinkets + 3 fixes).

## How the base was obtained

`git clone https://github.com/jinkatama105/quilt-monsters.git` fails from this
machine: `error: RPC failed; HTTP 403` on the smart-HTTP ref listing
(twice, plus `git ls-remote`). The repo is **public** (GitHub API:
`private: false`, default branch `master`), so this is a transport-level
403, not an auth/private-repo failure. The base was therefore fetched as
the codeload tarball for commit `3fe0104` (71,192,710 B, HTTP 200) and
the commit SHA + message + date were verified against the GitHub API.
The deployed game tree is the repo's `game/` subtree — that is what this
directory contains. Repo-root scaffolding (`main.ts`, `serve.ts`, test
scripts, `vendor/`, `screenshots/`, root `assets/anim` + `assets/portraits`)
is not part of the deployed game and is excluded, exactly as in v6/v7.

## Base verification (before merging — all markers found, none missing)

- `?v=run7` ×73 in code + 1 in `index.html` (74 total after the v7
  comment; see relabel), 0× any other version.
- `BUILTIN_TRINKETS`: exactly the 10 approved ids with #299 semantics —
  golden_thimble {income,8}, arcade_buttons {reroll_free,5}, swift_spool
  {column_spd,0.15}, ember_feather {burn_on_cast,2}, storm_needle
  {multicast,1,target:'leftmost'}, patchwork_shield {shield,6},
  shadow_spool {dread,3}, riposte_charm {counter,50}, lucky_stitch
  {lucky_item,25}, woolly_charm {post_battle_heal,2}. Old 6-entry pool
  (`fools_gold`, `arcade_coins`, `speed_crest`, `thimble`,
  `ember_thread`, `double_needle`) is gone.
- All 10 effect hooks present: column_spd / burn_on_cast / multicast /
  shield / dread / counter in `showdown.js`, income / reroll_free /
  lucky_item in `run.js`, post_battle_heal in `main.js`.
- Trinket chip-row scaling + ellipsize present (`run.js`: chips shrink,
  labels truncated with `.`).
- v5 arena survives: `slotPos` player 520/320/120, foes 760/960/1160,
  rows 330/550, 122px clear between front sprites.
- v6 speed pill survives: status on its own line y=66, 1×↔2× only.
- v6 defect fixes survive: `board full (max 6)`, VS labels y=580,
  click-to-continue y=700, `coin_icon` PNG, LEVEL UP banner,
  `championShown` gating, `reward.won` flag.

## What changed — Hermes run7 delta over v6 (kept byte-identical)

The run7 base differs from v6 in `src` only by (a) the `?v=run6` →
`?v=run7` import rewrites and (b) exactly 3 hunks, all in `run.js`:

1. `BUILTIN_TRINKETS`: old 6 ids → the 10 approved ids/effects above.
2. Lucky Stitch handling generalized: id check →
   `lucky_item` type with value-driven 25% roll.
3. Trinket chip row: fixed 112px chips → shrink-to-fit
   (`w = min(112, floor((avail − (n−1)·6)/n))`) + label ellipsize.

Assets also differ from v6 (Hermes's tree carries newer quilt/Ghibli PNGs);
they are kept as-is — the merge touches code only.

## What changed — 3 playtest fixes ported from fulltree-v7

Ported hunk-by-hunk from v7 (diff v7-vs-v6, version strings stripped).
No whole files were copied; Hermes's delta was not touched.

### 1. Codex TYPE CHART clips — FIXED (`src/screens.js`)
- **What was wrong:** "Verdant" rendered as "Verda", the rightmost
  multiplier column and the footer "Seedstones bind creatures" (trailing
  "s") were cut.
- **Root causes (measured, not guessed):**
  (a) The row label was `att.slice(0, 5)` — "Verdant" was *truncated to
  "Verda" by code*, not by the panel. Full names are used now.
  (b) The other two symptoms were a **stale cache**: the playtest browser
  kept serving Hermes's trainer-only run6 under the same `?v=run6` key,
  whose chart wedge was the old 132px one (cx 1108, last column at x 1312,
  off-canvas). The `?v=run7`/`?v=run8` relabels break that cache identity.
- **Fix:** full element names in the label; multiplier columns re-derived
  from measured widths with the real canvas font (DejaVu Sans Mono):
  "Verdant ▸" @11px = 59.6px, "×2"/"×½" @11px = 13.2px, footer @12px =
  180.5px. Layout in the 236px panel (cx 1004): pad 16 | label 59.6 |
  gap 10.4 | 5 cols @30px, first at cx+86, last text ends cx+219.2
  (16.8px margin) | footer centred at cx+118 (27.8px margins).

### 2. "Rookie" rank label clipped by the DAY tab — FIXED (`src/run.js`)
- **What was wrong:** the tab's bottom edge cut across the top of "Rookie"
  on every screen.
- **Root cause (measured):** DAY tab spans y 12–56, opaque to its bottom
  edge. Rank baseline was y=68; DejaVu Sans Mono Bold 14px puts the "k"
  ascender top at baseline−12, i.e. y=56 — exactly the tab's bottom edge.
- **Fix:** rank baseline 68 → 74. Now the "k" top is y=62 (6px clear of
  the tab) and the rank's ink bottom (74) sits ~7px above the shop
  subtitle's ink top (~81). Clear on both sides in every phase.

### 3. Codex monster grid overflows — FIXED (`src/screens.js`, `src/main.js`)
- **What was wrong:** the 6th row was cut off at the bottom and the
  "‹ BACK (C)" button overlapped the 5th row of cards.
- **Root cause (measured):** the Codex holds **42 species**; 4 columns ×
  133px rows = 11 rows, grid bottom y=1559 — 759px past the 800px
  viewport. Row 5 spans y 640–761, BACK spans y 734–778, so they
  overlapped by 27px.
- **Fix:** pagination — 4 rows (16 species) per page, 3 pages (16/16/10),
  card geometry untouched (cellW 236, cellH 133, gy 108). Grid bottom is
  now y=628, BACK clear by 106px. "‹ PREV" / "NEXT ›" buttons at y
  662–706 (34px clear of the grid, 28px clear of BACK) with a
  "PAGE n / 3" label between them; the out-of-range end is dimmed
  (alpha 0.45) and its click is a no-op. Page persists across opens
  (dex-style). Clicks are routed in `main.js` via the edge-triggered
  `input.inRect`, so holding the mouse cannot flip more than one page.
  New exports: `codexPageCount`, `codexGetPage`, `codexSetPage`
  (clamps), `codexNavRects`.

## Merge report — conflicts: none

- All three fix sites in the run7 base matched v6 byte-for-byte, so the
  v7 hunks applied exactly: `screens.js` (Codex), `run.js` rank line,
  `main.js` codex-case nav block + the `screens.js` import addition
  (`codexNavRects, codexGetPage, codexSetPage, codexPageCount`).
- Overlap check on the two shared files: Hermes's `run.js` hunks sit at
  ~line 31 (pool), ~337 (lucky_item), ~545 (chip row); the rank fix is
  at ~line 415 — no overlap. Hermes's `main.js` hunks are the import
  block and ~line 783; the nav fix is at ~line 221 — no overlap.
  `showdown.js` needed no fix, so Hermes's engine handling there is
  untouched.
- Proof: after the merge, `diff -ru fulltree-v7/src fulltree-v8/src`
  shows **only** Hermes's 3 `run.js` hunks. The 3 fixes are present in
  v8 byte-identical to v7.

## Verification (123/123 headless checks, rebuilt `/tmp/v8-verify/verify.mjs`)

The v7 verify script was lost when /tmp was cleared, so the suite was
rebuilt for run8 with the same coverage (recording-stub ctx, real
`config.js` / `data.js`, live `run.js` / `showdown.js` execution;
`main.js` is verified by source + diff because it touches
`document`/`location` at import time).

- `node --check` on all 20 `src/*.js` — pass.
- `?v=run8` ×74 / run7 ×0 / run6 ×0 / run5 ×0 / run4 ×0 (index.html + src).
- **Pre-ship check (a) — 10-trinket offer:** 200 simulated wins all
  offer exactly 3 distinct pool trinkets; the union of offered ids is
  all 10. Storm Needle's pool entry carries `target: 'leftmost'`;
  Woolly Charm carries `post_battle_heal: 2`. Live hook tests:
  Storm Needle multicasts the slot-0 unit only; Patchwork Shield +6 on
  the front monster; Ember Feather `burnOnCast` 2; Riposte Charm
  `counterPct` 50; Swift Spool front-col `intervalMult` 0.85; Shadow
  Spool enemy KO gives the Gloom ally +3 `dreadBonus`; Golden Thimble
  day income 8+8=16; Arcade Buttons 5 free rerolls.
- **Pre-ship check (b) — chip row at N=10 on the 1280px canvas:**
  all 10 chips drawn, step 107 (w 101 + gap 6), first chip at x=201,
  last chip right edge **1259** (21px inside the canvas), every label
  fully on-canvas.
- **3 fixes, live:** Codex render test on all 3 pages — 16/16/10 cards,
  "Verdant ▸" in full, no "Verda ▸", all chart texts inside panel
  1004..1240, 25 multiplier cells per page, footer present, BACK clear
  of the grid, PREV/NEXT + `PAGE n / 3` correct, no text outside the
  1280×800 viewport, grid bottom ≤ 628; `codexSetPage` clamps 99 → 2
  and −5 → 0. Rookie drawn at (24, 74). BATTLE label plain, no ✕.
- **No regressions:** v5 arena slot coordinates exact; speed 1→2→1
  only; board-full returns `'board full (max 6)'`; trainer grid fits 3
  in one row and 6 in two rows; champion gating (real Day-10 win opens
  champion once, Day-10 loss retries Day 10); exhausted trinket pool
  still reports `reward.won === true`.
- **Sprites:** Frostcap mean alpha 158.4, Gloomcap 163.2 — solid, not
  ghosts (v3 fix intact in Hermes's tree).
- `fulltree-v6/` and `fulltree-v7/` untouched (0 files modified during
  this merge; verified by mtime).
