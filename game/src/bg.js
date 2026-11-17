// bg.js — battle backdrop per zone. If art/<zone>.png exists it is drawn as the
// full-viewport background (dimmed slightly so sprites pop); otherwise the caller
// keeps its procedural gradient. Loading is lazy + cached, non-blocking.
const cache = {};

const BG_BY_ZONE = { cave: 'cliff', interior: 'temple' }; // else default moss; assets/battle/<id>.png
export function battleBg(zoneId) {
  const id = BG_BY_ZONE[zoneId] || 'moss';
  if (cache[id] !== undefined) return cache[id].img;
  const img = new Image();
  img.onload = () => { cache[id] = { img, ok: true }; };
  img.onerror = () => { cache[id] = { img, ok: false }; };
  img.src = `assets/battle/${id}.png`;
  cache[id] = { img, ok: false };
  return null;
}

export function drawBattleBg(ctx, zoneId, w, h) {
  const entry = cache[BG_BY_ZONE[zoneId] || 'moss']; // same key battleBg wrote — was cache[zoneId], never matched
  if (!entry || !entry.ok) return false;
  ctx.drawImage(entry.img, 0, 0, w, h);
  ctx.fillStyle = 'rgba(8,10,14,0.30)';
  ctx.fillRect(0, 0, w, h);
  return true;
}
