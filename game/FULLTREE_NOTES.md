# FULL TREE — VERDANT STRUGGLE (Batomon engine) — patch v3 + Bright UI v2

Deploy this whole tree as-is. No base tree needed, no build step (static files only).

## What this is

- **Base:** the live run2 build (patch v1, deployed by Hermes #333), downloaded
  byte-exact from https://quilt-monsters.vercel.app on 2026-11-18.
- **+ Patch v3** (see `PATCH_NOTES_v3.md`): Frostcap solid regen, Gloomcap detailed
  PNG + wire-in, attack-highlight cleared on end screens, 5 text overlaps fixed,
  Codex close returns to origin, `applyPassive()` element-target scoping.
- **+ Bright UI v2:** bright palette applied to the code (see below) + the 8 bright
  UI panels from `batomon-ui-bright-pack.zip`.
- **Cache-buster:** `?v=run2` → `?v=run3` everywhere (index.html + all src imports,
  73 occurrences). Live is run2, so run3 is next.

## Deploy

Copy the whole tree to the Vercel project root and deploy (`vercel --prod`).
Verify live: `src/main.js?v=run3` in the page source, bright cream panels,
Frostcap solid in battle, Gloomcap detailed in battle.

## Contents

- `index.html` (cache-buster `?v=run3`)
- `src/` — 20 JS modules, all `node --check` clean
- `assets/` — 84 PNGs, every file the JS references (verified by inventory check):
  `assets/ui/` 16 (incl. the 8 bright panels), `assets/world/` 30 (5 maps,
  9 walk sheets, 16 Ghibli species PNGs), `assets/quilt/` 35 (10 sheets,
  10 statics + 10 atk poses, 5 skill FX), `assets/` 3 (2 battle bgs, title hero)
- `PATCH_NOTES_v3.md` — patch v3 details + exact `trainers.json` shape for Manus

## Bright palette applied (spec: `bright-palette-patch.md`)

73 substitutions across config.js, hud.js, run.js, showdown.js, bg.js,
screens.js, road.js, main.js — every one verified present before replacing.
Run.js v1 text colours (INK `#3b2c17` / INK_SUB `#6d5b3c`) verified present,
not re-applied.

## Notes / discrepancies found while building this tree

1. **Bright pack has NO battle backgrounds.** Muse #334 said
   `batomon-ui-bright-pack.zip` contains battle_bg_forest/village.png — it does
   not (8 UI PNGs + manifest only). The live battle bgs are already the
   Hermes-verified quilt v1 files (sha256 `6455b2ac…`, `1e38d9e9…`) and are kept
   as-is in this tree. No bright battle-bg variant exists.
2. **`vs_frame.png` is not referenced by the engine** (no call site in any
   src file). It ships in the bright pack and is included here anyway.
3. **`data/*.json` (trainers/shop/trinkets/monsters) 404 live** — Manus has not
   delivered them yet. Not included; the engine falls back to built-ins
   (`loadData()` handles missing files). Add them under `data/` when they land.
4. **Spec correction:** hud.js hpBar/XP track is `#0a0f0a`, not `#0a0f0d` as
   the spec says. Both tracks changed to `#e7dcc0` using the real value.
5. **One fix beyond the spec:** `drawOver()` (RUN OVER screen) sub-line was
   pale teal `#9fd8c8` on the now-cream full-screen panel — unreadable. The
   spec changed only the title. Fixed to INK_SUB `#6d5b3c`, matching
   `drawReward()`'s sub-line in the same role. Revert with one sed if unwanted.
6. **Intentionally left dark (per spec):** VS-card backdrop `#0b0f0d`
   (showdown.js), pause/fled/end-screen colours, trinket stroke fallback
   `#8ef2a0`, road progress bar `#4a7d4e`, `draft.js` (dead screens — the
   road-node/draft loop was deleted), `EL_COLOR` fallback. All read fine on
   their dark backgrounds or are unreachable.
7. **`assets/ui/*.png?v=quilt4` query left as-is** (same as live). The bright
   PNGs replace file contents at the same URLs; if a browser shows stale v1
   panels, hard-refresh — the `?v=run3` JS bump does not bust image URLs.
8. **`message_log.png` is included as served live.** Its HUD01 QA BLOCKED
   status (needs a clean 24px clear border) is a design note from Manus, not
   a missing file — the engine falls back to the procedural panel if it 404s.

## Verification (this tree, 2026-11-18)

- `node --check` on all 20 `src/*.js` — pass.
- Inventory check: every asset referenced in the JS exists in the tree
  (84 files); only `vs_frame.png` is unreferenced (see note 2).
- Bright values present: `#fff6dc`, `#241a12`, `#5b4636`, `#ffc93c`,
  `#7ec8e3`, `#e7dcc0`, `#2e9e4f`, `#e85d4a`, `#d99a16`, `#2e9e8f`,
  `#dff3fb`/`#fff3c4`, `#fdf3d0`, `#f7ead0`, `rgba(91,70,54,0.15)`.
- v3 fixes present: `applyPassive` element scoping (`elemMatch`), `clearFx()`
  at all 3 end transitions, `codexFrom` (9 sites), `'gloomcap'` in `HAS_ART`
  + `GHIBLI_ART`.
- `?v=run3` everywhere (73×), `?v=run2` 0×.
- NOT verified (needs a live browser playtest after deploy): Frostcap/Gloomcap
  in an actual battle frame, the bright panels as rendered, `trainers.json`
  end-to-end with Manus's real file.
