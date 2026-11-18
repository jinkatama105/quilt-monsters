# PATCH v3 — VERDANT STRUGGLE (Batomon engine)

Base: current live code, `?v=run2` (patch v1, deployed by Hermes #333).
**Deploy: copy the files under "Files to deploy" below, then bump the cache-buster
`?v=run2` → `?v=run3` in `index.html` (Hermes does the bump at deploy time — the
patch itself does NOT change it).** Do NOT touch patch v1 fixes, trinket/item hook
implementations, or Bimo's `on` hook.

## Files to deploy (only these)

| File | Change |
|---|---|
| `src/run.js` (sha256 `d19c702b…e2c31`) | `applyPassive()` element-target fix (fix 3) + text overlaps: rank, trainer sprite, board sprite, trinket card (fix 5) |
| `src/showdown.js` (sha256 `f608f401…6693`) | `clearFx()` on all 3 end transitions (fix 4); `HAS_ART` += `gloomcap` (fix 7); LEVEL UP! spawn y−112 (fix 5d) |
| `src/render.js` (sha256 `73008a7b…ce6`) | `GHIBLI_ART` += `gloomcap`, comment fixed (fix 7) |
| `src/main.js` (sha256 `db5a9094…12d0`) | Codex origin tracking `state.codexFrom` (fix 6) |
| `assets/world/ghibli-frostcap-512.png` (sha256 `4b56de67…c5d`) | Replaced — regenerated solid sprite (fix 1) |
| `assets/world/ghibli-gloomcap-512.png` (sha256 `c5640f52…b3`) | NEW — detailed sprite (fix 2; wired in by fix 7) |

`work/` holds the raw generations + backdrop-composite previews — scratch only,
do NOT deploy. `index.html` and all other `src/*.js` in this folder are the
unmodified live base, included for reference only.

---

## Fix 1 — Frostcap ghost (owner-reported, playtest-confirmed)

**Root cause: the ASSET, not the engine.** Battle/VS use `unitArt` (showdown.js)
→ `assets/world/ghibli-frostcap-512.png`. The engine applies NO alpha to living
battle sprites (only the `defeat` pose sets `globalAlpha 0.45`). The old PNG
itself was broken: alpha map shows the cap's right half and the WHOLE body/face
region fully transparent (alpha=0, RGB 0,0,0 — the pixels are gone, nothing to
un-blend or recover). It was a bad key-out of a pale ice mushroom on white: the
cream body got keyed out with the background. Numbers: mean alpha 88.6/255,
only 60,633 opaque px of 207,360. Shop/board cards were solid because they use
the procedural `drawFrostcap` (art.js), not the PNG.

**Fix:** regenerated the sprite (Ghibli watercolour, same design as the card:
blue cap with white dots + snowflakes, cream-white stem, one big dark eye, pink
blush, tiny smile, dark outline) on solid magenta `#FF00FF`, keyed out with the
proven MONSPEC1 pipeline — soft alpha ramp (distance 30–90 to magenta) +
despill (r−g>40 and b−g>40: pull r/b 75% toward g) + pinhole fill
(neighbour-median, iterated to zero). Cropped to the figure, resized 512×512.

**Verified (this patch):** 0 magenta pixels left; mean alpha 158.5 (was 88.6);
159,913 fully opaque px (was 60,633); 0 pinholes inside the figure bbox;
visually confirmed solid over a dark battle backdrop (preview in `work/`).

## Fix 2 — Gloomcap placeholder

**Root cause: asset missing.** `assets/world/ghibli-gloomcap-512.png` was a 404
live, so battle/VS fell back to the flat procedural `drawGloomcap` (art.js:160)
— a simplified faceless purple mushroom — while cards show the detailed
mushroom with face and white dots.

**Fix:** new detailed Ghibli watercolour PNG matching the card art (deep purple
cap, glowing pale-lavender spots, cream stalk, two dark eyes, dark outline),
same magenta key-out pipeline as fix 1. **Verified:** 0 magenta pixels left;
mean alpha 163.4; 164,781 fully opaque px; 0 pinholes; visually confirmed solid
over a dark backdrop (preview in `work/`).

**Wire-in DONE in this delivery (fix 7 below):** `'gloomcap'` added to
`HAS_ART` (showdown.js:18) and `GHIBLI_ART` (render.js:70). `unitArt()` loads
`assets/world/ghibli-gloomcap-512.png` for battle/VS and `drawGhibliCreature()`
uses it on the field — the new PNG is live as soon as this patch deploys.

## Fix 3 — `applyPassive()` cannot express element targets (unblocks Manus's trainers.json)

**Root cause.** `applyPassive()` (run.js:245) only recognised LOWERCASE element
keys — `{ fire:'Ember', grass:'Verdant', electric:'Volt', water:'Tide',
ghost:'Gloom' }[e.target]`. An element NAME as `target` (`'Ember'`, `'Verdant'`,
…) looked up to `undefined`, so the element filter was silently skipped and
the effect applied to the WHOLE board. `{type:'burn', amount:3, target:'Ember'}`
would have given +3 Burn to every monster, not just Ember ones. Same for a
board position: `target:'leftmost'` also fell through to the whole board — so
Bimo's approved passive would have multicasted EVERY monster instead of just
the leftmost. (The `on:'victory'` / `on:'battleStart'` dispatch itself was fine
and is untouched.)

**Fix (run.js, `applyPassive` only).** `target` is now matched case-insensitively:
- Element name → all board monsters of that element:
  `Ember`, `Verdant`, `Volt`, `Tide`, `Gloom` (any case).
- Legacy lowercase keys still work: `fire`, `grass`, `electric`, `water`,
  `ghost` (the built-in placeholder trainers use these — unchanged).
- Board position → `leftmost` = board[0], `rightmost` = last monster,
  `all` = whole board. Anything unrecognised falls back to the whole board
  (previous behaviour). Unknown species ids are now guarded (`sp && …`)
  instead of throwing.
- `on` handling, effect types (`atk`/`spd`/`shield`/`burn`/`extra_cast`),
  and the `victory`-requires-win gate are all unchanged. Bimo's hook
  (`on:'battleStart'` + `extra_cast`, consumed by showdown `strike()`) is
  untouched — it now correctly scopes to the leftmost monster, which is what
  the approved passive says.

**Exact shape Manus should use in `data/trainers.json`** (replaces the
placeholder trainers via `loadData()`):

```json
[
  { "id": "raka", "name": "Raka", "element": "Ember",
    "passive": { "on": "victory",
      "effect": { "type": "burn", "amount": 3, "target": "Ember", "permanent": true } },
    "text": "On Victory: your Ember monsters gain +3 Burn permanently." },
  { "id": "sari", "name": "Sari", "element": "Verdant",
    "passive": { "on": "victory",
      "effect": { "type": "shield", "amount": 4, "target": "Verdant", "permanent": true } },
    "text": "On Victory: your Verdant monsters gain +4 Shield permanently." },
  { "id": "bimo", "name": "Bimo", "element": "Volt",
    "passive": { "on": "battleStart",
      "effect": { "type": "extra_cast", "amount": 1, "target": "leftmost" } },
    "text": "On Battle Start: your leftmost monster casts again after the normal cast phase." }
]
```

Notes for Manus: `target` accepts the element NAME (`Ember` etc., any case) or
the old lowercase keys (`fire` etc.) — both work. `permanent: true` is carried
on the effect object but the engine applies the buff immediately to board
stats, same as before. `shop.json` / `trinkets.json` shapes are unaffected by
this change.

**Verified (this patch):** `node --check src/run.js` passes. Headless behaviour
test (extracted `applyPassive`, stubbed `SPECIES`/`TRAINERS_BY_ID`) — 14/14
pass: Raka burns only Ember; Sari shields only Verdant; legacy `'fire'` still
maps to Ember; lowercase `'ember'` matches; Bimo multicasts ONLY board[0];
Bimo does not fire on `victory`; victory passive does not fire on a loss;
unknown target falls back to whole board; empty board + `leftmost` returns
null without crashing; element with no board match returns null; `rightmost`
scopes to the last monster.

## Confirmed, NOT re-fixed — Manus #331 empty-board item gap

Already fixed in patch v1 and verified live. The guard is present in this
base: `shopFor()` never offers board-targeted items while the board is empty
(run.js:76-79, `base.filter(s => !needsBoardTarget(s))`), plus a belt-and-braces
`buy()` guard (run.js:105, returns `'needs a monster on the board'` if the
board was emptied after the shop was generated). No change in v3.

## By design, NOT a bug — trinket choices shrink after wins

`BUILTIN_TRINKETS` has only 6 entries (run.js:34). `stageReward()` offers up to
3 distinct UNOWNED trinkets; after Day 2 (own 1) the pool is 5 → 3 choices,
after Day 5 (own ~4) → 2, after Day 6 (own 5) → 1 — exactly the playtest
observation (3→2→1). No-repeat rule is intentional. The real fix is Manus's
10-trinket `trinkets.json`: `loadData()` replaces the table when it lands
(run.js:292). No code change in v3.

---

## Fix 4 — Attack highlight freeze (round 2)

**Root cause.** `Showdown.update()` ticks `u.fx`/`u.skillFx` only while
`phase === 'live'`; once the battle ends the update returns early, so a
skill-burst disc (pale, up to ~300px, e.g. riposte) sat frozen behind a unit
under the victory/defeat veil — the "white background" the owner saw under the
Riposte. The draw side (`if (u.skillFx) … drawImage`) renders it whenever the
field is set, frozen or not.

**Fix (showdown.js).** New `clearFx()` method nulls `u.fx`/`u.skillFx` for
every unit, called at all three places `phase` becomes `'end'`: win/loss in
`update()`, `tryCapture()` (caught), `tryFlee()` (fled). `pops` (damage
numbers, LEVEL UP!) and `koFx` keep ticking — they are updated before the
phase check, so the end screen still shows fading numbers and the KO settle.

**Verified:** headless code-path check 23/23 (see Verification summary) —
`clearFx()` exists and nulls both fields; all 3 end transitions call it.

## Fix 5 — Text overlaps (round 2)

All five, in `run.js` unless noted (geometry checked headlessly — figure
extent is the 160px `drawCreature` box, text glyph tops estimated from font
size):

- **(a) 'Rookie' rank** (top bar, run.js:382): was `14px #6d5b3c` on sage —
  now `bold 14px #3b2c17` (INK), same as the DAY/coins text.
- **(b) Board-card 'Lv'** (run.js:486): sprite was `scale 0.7` at
  `(b.x+52, b.y+60)` — feet reached y+116, over the Lv line (baseline y+112,
  glyph tops ~y+103). Now `scale 0.6`, recentered to `(b.x+74, b.y+50)`
  (74 = card centre): feet end at ~y+98, 5px clear.
- **(c) Trainer names** (run.js:421): sprite was `scale 1.5` at y+120 —
  240px tall, reaching y+240 over the name (baseline y+220, glyph tops
  ~y+204). Now `scale 1.2`, recentered at y+100: feet end at ~y+200
  (incl. idle bob), ~4px clear.
- **(d) 'LEVEL UP!' banner** (showdown.js:281, in `settleXp()`): spawned at
  y−84, overlapping the trait/Lv nameplate (ability text band ~y−96..−87
  for a 118px unit). Now spawned at y−112: pop glyphs end at −112, 16px
  above the ability text. (Boss units, 150px: ~4px transient graze at spawn
  only — the pop rises away immediately.)
- **(e) Trinket-card text** (`drawTrinketRow`, run.js): card h 96→100 and
  the text inset — clip rect `(x+10, y+38, w−20, h−44)` →
  `(x+12, y+40, w−24, h−50)`, wrap width `w−28`→`w−32`, name/text x +14→+16.
  Text now ends at y+90, 10px clear of the bottom border (was 6px). Card
  bottom (y+760) still fits VIEW_H 800. No line-count change for any
  built-in trinket text (max 2 lines at the new width).

**Verified:** headless geometry checks 23/23 — each clearance recomputed from
the literal numbers now in the source.

## Fix 6 — Codex nav bug (round 2)

**Root cause.** The Codex close handler (main.js, `case 'codex'`) guessed the
return mode: `state.battle ? 'battle' : (state.road && ROAD ? 'road' : 'field')`.
Opened from the shop (`updateRun`, mode `'run'`), `state.battle` is null and
there is no road, so it returned `'field'` — the Leafpine overworld, with a
different party. The run survived in `state.run`, but the player was dumped
out of the shop.

**Fix (main.js).** `state.codexFrom` (declared `null` in the state object)
is recorded at every codex-open site — field (C key + HUD button), road (C),
run/shop (C), classic battle (C), showdown (C + CODEX button) — 7 sites.
Close returns to `state.codexFrom` and clears it; the old guess remains as
the fallback for the one unrecorded open (`?debug=codex`, which has no
origin by design).

**Verified:** headless code-path check 23/23 — 7/7 open sites record an
origin covering field/road/run/battle; close reads `codexFrom` first.

## Fix 7 — Gloomcap wire-in (round 2, REQUIRED)

`'gloomcap'` added to `HAS_ART` (showdown.js:18) and to `GHIBLI_ART`
(render.js:70); the render.js comment now reads "tidrel: no art yet" only.
`unitArt()` (battle/VS) and `drawGhibliCreature()` (field) both load
`assets/world/ghibli-gloomcap-512.png` on a set hit, so the detailed PNG
from fix 2 is actually used after deploy. Frostcap was already in both sets.

**Verified:** headless check 23/23 — both sets contain `'gloomcap'`, comment
fixed, loader path confirmed.

## Verification summary (this delivery)

- `node --check` on all 20 `src/*.js` — pass.
- `applyPassive` headless behaviour test — 14/14 pass (see fix 3, unchanged).
- Frostcap PNG: 0 magenta px, mean alpha 158.5, 159,913 opaque px, 0 pinholes,
  visual check over dark backdrop — pass.
- Gloomcap PNG: 0 magenta px, mean alpha 163.4, 164,781 opaque px, 0 pinholes,
  visual check over dark backdrop — pass.
- **Round 2 headless check (`/tmp/v3-verify.js`) — 23/23 pass:**
  `HAS_ART`/`GHIBLI_ART` contain `'gloomcap'`; `clearFx()` nulls both fields
  and is called at all 3 `'end'` transitions; rank is bold INK; board-sprite
  feet (98) clear Lv glyph tops (~103); trainer-sprite feet (~200) clear name
  glyph tops (~204); LEVEL UP! bottom (−112) sits above ability text (~−96);
  trinket clip ends 10px clear of the border; 7/7 codex-open sites record an
  origin (field/road/run/battle); close returns to `codexFrom`; `applyPassive`
  fix intact; no cache-buster change.
- NOT verified (needs a live browser playtest after deploy): Frostcap/Gloomcap
  in an actual battle frame; `trainers.json` end-to-end with Manus's real file
  (only stub-tested); the 4 round-2 items above as rendered on screen.
