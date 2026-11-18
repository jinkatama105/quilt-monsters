// bg.js — battle backdrop per zone. Quilt Edition: painted village/forest PNGs
// drawn full-viewport behind battles (dimmed slightly so sprites pop).
// Loading is lazy + cached, non-blocking; drawBattleBg self-primes the load
// because battle mode never calls battleBg() (that is why the arena was
// black: the cache was empty, so every battle fell back to the dark gradient).
const cache = {};

// zone -> backdrop: wild battles use the forest quilt, built arenas the village quilt
const BG_BY_ZONE = { cliff: 'village', temple: 'village', cave: 'village', interior: 'village' }; // else default forest
const BG_FILE = { forest: 'assets/battle_bg_forest.png', village: 'assets/battle_bg_village.png' };

export function battleBg(zoneId) {
  const id = BG_BY_ZONE[zoneId] || 'forest';
  if (cache[id] !== undefined) return cache[id].img;
  const img = new Image();
  img.onload = () => { cache[id] = { img, ok: true }; };
  img.onerror = () => { cache[id] = { img, ok: false }; };
  img.src = BG_FILE[id];
  cache[id] = { img, ok: false };
  return null;
}

export function drawBattleBg(ctx, zoneId, w, h) {
  const id = BG_BY_ZONE[zoneId] || 'forest';
  if (cache[id] === undefined) battleBg(zoneId); // self-prime: battle mode never calls battleBg
  const entry = cache[id];
  if (!entry || !entry.ok) return false;
  ctx.drawImage(entry.img, 0, 0, w, h);
  ctx.fillStyle = 'rgba(91,70,54,0.15)';
  ctx.fillRect(0, 0, w, h);
  return true;
}
