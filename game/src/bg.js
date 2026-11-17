// bg.js — battle backdrop per zone. If art/<zone>.png exists it is drawn as the
// full-viewport background (dimmed slightly so sprites pop); otherwise the caller
// keeps its procedural gradient. Loading is lazy + cached, non-blocking.
const cache = {};

export function battleBg(zoneId) {
  if (cache[zoneId] !== undefined) return cache[zoneId].img;
  const img = new Image();
  img.onload = () => { cache[zoneId] = { img, ok: true }; };
  img.onerror = () => { cache[zoneId] = { img, ok: false }; };
  img.src = `assets/battle/${zoneId}.png`;
  cache[zoneId] = { img, ok: false };
  return null;
}

export function drawBattleBg(ctx, zoneId, w, h) {
  const entry = cache[zoneId];
  if (!entry || !entry.ok) return false;
  ctx.drawImage(entry.img, 0, 0, w, h);
  ctx.fillStyle = 'rgba(8,10,14,0.30)';
  ctx.fillRect(0, 0, w, h);
  return true;
}
