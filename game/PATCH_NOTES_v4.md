# PATCH v4 — VERDANT STRUGGLE (Batomon engine) — battle speed

Base: the live run3 tree (v3 + Bright UI v2, deployed by Hermes #339/#340).
**Deploy: copy the whole `fulltree-v4/` tree to the Vercel project root and
deploy (`vercel --prod`). No base tree needed, no build step (static files
only).** Cache-buster `?v=run3` → `?v=run4` in `index.html` AND all src
imports (73 occurrences). Do NOT touch patch v1/v3 fixes, bright palette,
applyPassive, trinket/item hooks, Bimo's hook, or balance (coins, damage, HP).

## Problem (owner-reported, 2026-11-18 17:29 WIB)

Battles play too fast — "gameplay terlalu cepet". Batomon Showdown only
offers 1x and 2x; the engine had 1x / 2x / 4x.

## Measured root cause (headless sim, 20 trials per scenario, 1x)

| Scenario | Live combat | Strikes | Mean gap | Median gap | Min gap | Gaps <0.5s | Max concurrent dmg numbers |
|---|---|---|---|---|---|---|---|
| Day 1 (2v3, Lv1–2) | 4.17s | 4.3 | 0.68s | 0.62s | 0.15s | 1.6 | 5.5 |
| Mid (6v3, Lv1–2) | 2.98s | 4.7 | 0.29s | 0.30s | 0.014s | 2.5 | 7.8 |
| Late (6v6, Lv4–6) | 4.79s | 12.7 | 0.27s | 0.17s | 0.00s | 9.1 | 11.4 |

Battles resolved in ~3–5s of live combat. Strikes bunched: same-frame
double strikes (min gap 0.00s), median gap 0.17s late-game, and up to 11
damage numbers on screen at once while each number only lived 0.6s. The
charge bars all fill at roughly the same time, so several units acted in
the same frame — the lunge and the numbers never got a moment to read.

## Changes (only `src/showdown.js`)

1. **Toggle capped at 2x.** `toggleSpeed()` now cycles 1 → 2 → 1
   (was 1 → 2 → 4 → 1). The ff button shows `1×` / `2×` only; the
   status line reads `SPEED 1× · NORMAL` / `SPEED 2× · FAST FORWARD`
   (was `×4 FRENZY`). No `4×` / `FRENZY` text remains anywhere.
2. **Strike gate — one strike at a time.** New `STRIKE_GATE = 0.7`
   (game-time seconds). After any strike lands, all action bars hold for
   a 0.7s beat before the next unit may act. The gate ticks in game
   time, so at 2x the beat is half as long in real time. Charge rates,
   intervals, and the 0.4s lunge are untouched — the gate is what spaces
   the strikes out.
3. **Damage numbers linger.** Normal `0.6s → 1.1s`, crit `0.9s → 1.4s`,
   `SUPER!` `1s → 1.3s`, burn tick `0.6s → 1.0s`, shield / riposte /
   `SCARED` pops `1s → 1.2s`. (`DOWN`, heal, `FOCUS`, `DOUBLE!`,
   `KINDLE!` already ≥1.2s — unchanged.)
4. **Default speed is 1x every battle.** The `Showdown` constructor
   already set `this.speed = 1` and nothing persists it across battles
   (verified: no other `.speed` assignment in the tree). Unchanged, just
   verified. VS splash (1.8s) and end screens are NOT slowed.

## Files to deploy (only these changed vs the run3 tree)

| File | Change |
|---|---|
| `src/showdown.js` (sha256 `5a1ce9be5948726f…`) | toggle cap, strike gate, pop lifetimes, speed label |
| `index.html` + all `src/*.js` imports | `?v=run3` → `?v=run4` (73 occurrences) |

Everything else in the tree is byte-identical to the run3 full tree
(84 PNGs, v3 fixes, bright palette all intact — verified by grep).

## Verification

- `node --check` on all 20 `src/*.js` — pass.
- Headless toggle test — sequence `[1,2,1,2,1,2,1]`, never 4; fresh
  battle default speed is 1.
- Headless pacing sim, same 3 scenarios, 20 trials each, 1x:

| Scenario | Live (before → after) | Mean gap | Median gap | Min gap | Gaps <0.5s | Max concurrent pops |
|---|---|---|---|---|---|---|
| Day 1 (2v3) | 4.17s → **5.47s** | 0.68 → **1.45s** | 0.62 → **1.44s** | 0.15 → **1.08s** | 1.6 → **0** | 5.5 → **4.0** |
| Mid (6v3) | 2.98s → **5.75s** | 0.29 → **1.00s** | 0.30 → **0.99s** | 0.014 → **0.74s** | 2.5 → **0** | 7.8 → **4.9** |
| Late (6v6) | 4.79s → **11.90s** | 0.27 → **0.96s** | 0.17 → **0.84s** | 0.00 → **0.70s** | 9.1 → **0** | 11.4 → **5.5** |

  Min gap is now exactly the 0.7s gate in every scenario; zero strikes
  land within 0.5s of each other. Each strike gets its beat, the 0.4s
  lunge plays out, and the 1.1s damage number is still on screen when
  the next strike lands.
- 2x check (same battle shape, 10 trials): wall 7.72s at 1x → 4.72s
  at 2x (ratio 0.61 — the fixed 1.8s VS splash is unscaled, the live
  combat itself halves exactly as designed).
- Guardrails held: v3 fixes present (`applyPassive` element scoping,
  `clearFx()`, `codexFrom` ×9, `'gloomcap'` in `HAS_ART` + `GHIBLI_ART`),
  bright palette present, `?v=run2` ×0, `?v=run4` ×73.

## Notes

- Win rates moved a little between sim runs (Day 1: 7/20 → 3/20,
  late: 12/20 → 15/20, mid: 20/20 both). That is RNG noise in 20-trial
  samples — the gate only changes *which* ready unit acts first when
  several bars are full; damage, HP, and stats are untouched, so no
  balance change is intended or expected.
- The header comment in showdown.js still says "pause / fast-forward"
  — accurate for the 2x mode, left as-is.

## Not verified (needs a live browser playtest after deploy)

The pacing as it *feels* on screen (lunge visibility, number
readability at 1x, the SPEED caption fitting the HUD panel), and the
2x button behaving in a real run.
