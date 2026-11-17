// random.js — tiny seeded RNG so debug/replay states are reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = mulberry32((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);

export function pickWeighted(pairs, rng = rand) {
  let total = 0;
  for (const [, w] of pairs) total += w;
  let r = rng() * total;
  for (const [val, w] of pairs) { r -= w; if (r <= 0) return val; }
  return pairs[pairs.length - 1][0];
}

export const roll = (chance, rng = rand) => rng() < chance;
export const rint = (lo, hi, rng = rand) => lo + Math.floor(rng() * (hi - lo + 1));
