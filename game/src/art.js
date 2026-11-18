// art.js — every visual in the game, drawn procedurally with canvas code:
// creature portraits (one function per species), the field tileset, item icons,
// particles. pos: 'idle' | 'defeat' | 'hurt'. All silhouettes are thick,
// caricatural and share one family colour per element.
import { ELEMENT_COLORS, TILE, T } from './config.js?v=run10';
export { T } from './config.js?v=run10';

function bodyGrad(ctx, cx, cy, r, color) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.15, cx, cy, r * 1.25);
  g.addColorStop(0, color.glow);
  g.addColorStop(0.55, color.main);
  g.addColorStop(1, color.dark);
  return g;
}

function outline(ctx, lw = 5) {
  ctx.lineWidth = lw;
  ctx.strokeStyle = 'rgba(8,10,8,.92)';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function eye(ctx, x, y, r, color, angry = 0) {
  ctx.save();
  ctx.fillStyle = '#0a0c0a';
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.1, 0, 0, 7); ctx.fill();
  ctx.fillStyle = color.glow;
  ctx.shadowColor = color.main; ctx.shadowBlur = r * 3;
  ctx.beginPath(); ctx.arc(x, y - r * 0.15, r * 0.55, 0, 7); ctx.fill();
  ctx.shadowBlur = 0;
  if (angry) {
    ctx.strokeStyle = '#0a0c0a'; ctx.lineWidth = r * 0.7;
    ctx.beginPath(); ctx.moveTo(x - r, y - r * 1.4 - angry * 2); ctx.lineTo(x + r * 0.8, y - r * 0.6); ctx.stroke();
  }
  ctx.restore();
}

const sway = (t) => Math.sin(t * 2.2);

// ---------------------------------------------------------------- species
// Each draw function paints inside a ~220x220 box centred on (cx, cy).

export function drawEmberling(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Ember) {
  const s = pos === 'defeat' ? 0.86 : 1, droop = pos === 'defeat' ? 16 : 0;
  ctx.save(); ctx.translate(cx, cy + droop); ctx.scale(s, s);
  // tail flame
  ctx.fillStyle = color.main;
  ctx.beginPath();
  const fl = 10 + sway(t) * 4;
  ctx.moveTo(58, 22); ctx.quadraticCurveTo(92 + fl, 4, 84, -34 - fl);
  ctx.quadraticCurveTo(70, -6, 52, 6); ctx.closePath(); ctx.fill();
  outline(ctx, 4); ctx.stroke();
  ctx.fillStyle = color.glow;
  ctx.beginPath(); ctx.moveTo(62, 16); ctx.quadraticCurveTo(80, 2, 76, -20); ctx.quadraticCurveTo(66, -2, 56, 6); ctx.closePath(); ctx.fill();
  // body
  ctx.fillStyle = bodyGrad(ctx, 0, 20, 60, color);
  ctx.beginPath(); ctx.ellipse(0, 24, 52, 40, 0, 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  // head
  ctx.fillStyle = bodyGrad(ctx, 0, -28, 50, color);
  ctx.beginPath(); ctx.arc(-4, -26, 38 + sway(t), 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  // ears
  for (const dir of [-1, 1]) {
    ctx.fillStyle = color.dark;
    ctx.beginPath(); ctx.moveTo(-4 + dir * 22, -52); ctx.lineTo(-4 + dir * 40, -84 + droop); ctx.lineTo(-4 + dir * 4, -60); ctx.closePath();
    ctx.fillStyle = color.main; ctx.fill(); outline(ctx, 4); ctx.stroke();
  }
  eye(ctx, -20, -28, 8, color, pos === 'hurt' ? 1 : 0);
  eye(ctx, 12, -28, 8, color, pos === 'hurt' ? 1 : 0);
  // snout + ember freckles
  ctx.strokeStyle = '#0a0c0a'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(-4, -12, 8, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.fillStyle = color.glow;
  for (const [fx, fy] of [[-30, -8], [16, -4], [-8, 6]]) { ctx.beginPath(); ctx.arc(fx, fy + droop * 0.4, 3, 0, 7); ctx.fill(); }
  ctx.restore();
}

export function drawVerdanom(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Verdant) {
  const droop = pos === 'defeat' ? 18 : 0;
  ctx.save(); ctx.translate(cx, cy + droop);
  // trunk body
  ctx.fillStyle = bodyGrad(ctx, 0, 20, 70, { main: '#4f8f4a', glow: '#a8d59b', dark: '#1c5e2c' });
  ctx.beginPath();
  ctx.moveTo(-30, 66); ctx.quadraticCurveTo(-42, 10, -24, -18);
  ctx.quadraticCurveTo(0, -34, 24, -18); ctx.quadraticCurveTo(42, 10, 30, 66);
  ctx.closePath(); ctx.fill(); outline(ctx); ctx.stroke();
  // root feet
  for (const dir of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(dir * 26, 66, 16, 8, dir * 0.3, 0, 7); ctx.fill(); ctx.stroke();
  }
  // canopy
  const w = sway(t) * 3;
  ctx.fillStyle = bodyGrad(ctx, 0, -48, 60, color);
  ctx.beginPath(); ctx.arc(-30 + w, -44, 26, 0, 7); ctx.arc(0 + w, -60 - droop * 0.4, 32, 0, 7); ctx.arc(30 + w, -44, 26, 0, 7);
  ctx.fill(); outline(ctx); ctx.stroke();
  eye(ctx, -14, 0, 8, color, pos === 'hurt' ? 1 : 0);
  eye(ctx, 14, 0, 8, color, pos === 'hurt' ? 1 : 0);
  // moss beard
  ctx.strokeStyle = color.main; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-6, 16); ctx.quadraticCurveTo(0, 30 + droop, 8, 16); ctx.stroke();
  ctx.restore();
}

export function drawVoltip(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Volt) {
  const buzz = pos === 'defeat' ? 0 : sway(t * 2) * 2;
  ctx.save(); ctx.translate(cx, cy + (pos === 'defeat' ? 16 : 0));
  // wings
  ctx.fillStyle = 'rgba(210,235,255,.75)';
  for (const dir of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(dir * 46, -18 + buzz, 22, 10, dir * (0.5 - buzz * 0.02), 0, 7); ctx.fill();
    outline(ctx, 3); ctx.stroke();
  }
  // seed-bot body
  ctx.fillStyle = bodyGrad(ctx, 0, 6, 56, color);
  ctx.beginPath(); ctx.ellipse(0, 8, 40, 46, 0, 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  // seam + antenna
  ctx.strokeStyle = color.dark; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-36, 12); ctx.lineTo(36, 12); ctx.stroke();
  ctx.strokeStyle = '#0a0c0a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, -38); ctx.quadraticCurveTo(6, -58, 0, -66 + buzz); ctx.stroke();
  ctx.fillStyle = color.glow; ctx.shadowColor = color.main; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(0, -70 + buzz, 6, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  eye(ctx, -14, -12, 8, { main: '#7fc4ff', glow: '#e8f6ff', dark: '#1a4d78' }, pos === 'hurt' ? 1 : 0);
  eye(ctx, 14, -12, 8, { main: '#7fc4ff', glow: '#e8f6ff', dark: '#1a4d78' }, pos === 'hurt' ? 1 : 0);
  // bolt mark
  ctx.fillStyle = '#0a0c0a';
  ctx.beginPath(); ctx.moveTo(-6, 20); ctx.lineTo(4, 20); ctx.lineTo(0, 30); ctx.lineTo(8, 30); ctx.lineTo(-4, 46); ctx.lineTo(0, 34); ctx.lineTo(-6, 34); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawTidrel(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Tide) {
  const droop = pos === 'defeat' ? 14 : 0;
  ctx.save(); ctx.translate(cx, cy + droop);
  // bubbles trailing
  ctx.fillStyle = 'rgba(213,242,251,.7)';
  for (let i = 0; i < 4; i++) {
    const b = (t * 20 + i * 14) % 60;
    ctx.beginPath(); ctx.arc(52 + i * 8 - b * 0.3, 30 - b, 4 + i, 0, 7); ctx.fill();
  }
  // tail fin
  ctx.fillStyle = color.main;
  ctx.beginPath(); ctx.moveTo(34, 26); ctx.quadraticCurveTo(70, 10 + sway(t) * 6, 78, -18);
  ctx.quadraticCurveTo(56, 6, 36, 6); ctx.closePath(); ctx.fill(); outline(ctx, 4); ctx.stroke();
  // body
  ctx.fillStyle = bodyGrad(ctx, 0, 14, 60, color);
  ctx.beginPath(); ctx.ellipse(0, 18, 44, 32, -0.15, 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  // head crest
  ctx.fillStyle = color.glow;
  ctx.beginPath(); ctx.moveTo(-40, -8); ctx.quadraticCurveTo(-56, -44 - sway(t) * 3, -18, -34);
  ctx.quadraticCurveTo(-34, -22, -30, -6); ctx.closePath(); ctx.fill(); outline(ctx, 4); ctx.stroke();
  ctx.fillStyle = bodyGrad(ctx, -14, -6, 40, color);
  ctx.beginPath(); ctx.arc(-14, -4, 28, 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  eye(ctx, -22, -8, 7, color, pos === 'hurt' ? 1 : 0);
  eye(ctx, -2, -8, 7, color, pos === 'hurt' ? 1 : 0);
  // belly
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.ellipse(-2, 26, 26, 14, 0, 0, 7); ctx.fill();
  ctx.restore();
}

export function drawGloomcap(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Gloom) {
  const droop = pos === 'defeat' ? 16 : 0;
  ctx.save(); ctx.translate(cx, cy + droop);
  // stalk
  ctx.fillStyle = bodyGrad(ctx, 0, 30, 50, { main: '#cbb8d8', glow: '#efe4f6', dark: '#5c4a66' });
  ctx.beginPath();
  ctx.moveTo(-16, 64); ctx.quadraticCurveTo(-10, 20, -14, 2);
  ctx.quadraticCurveTo(0, -6, 14, 2); ctx.quadraticCurveTo(10, 20, 16, 64);
  ctx.closePath(); ctx.fill(); outline(ctx); ctx.stroke();
  // cap
  const pulse = sway(t) * 2;
  ctx.fillStyle = bodyGrad(ctx, 0, -20, 70, color);
  ctx.beginPath(); ctx.arc(0, -14 + pulse, 52 + pulse, Math.PI, 0); ctx.quadraticCurveTo(30, 10, 0, 8); ctx.quadraticCurveTo(-30, 10, -52 - pulse, -14 + pulse);
  ctx.closePath(); ctx.fill(); outline(ctx); ctx.stroke();
  // glowing spots
  ctx.shadowColor = color.main; ctx.shadowBlur = 14;
  ctx.fillStyle = color.glow;
  for (const [sx, sy, sr] of [[-24, -26, 6], [4, -38, 8], [28, -20, 5]]) {
    ctx.beginPath(); ctx.arc(sx, sy + pulse, sr, 0, 7); ctx.fill();
  }
  ctx.shadowBlur = 0;
  eye(ctx, -10, 18, 6, color, pos === 'hurt' ? 1 : 0);
  eye(ctx, 10, 18, 6, color, pos === 'hurt' ? 1 : 0);
  ctx.restore();
}

export function drawMagmoth(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Ember) {
  const flap = pos === 'defeat' ? 0 : sway(t * 1.6) * 10;
  ctx.save(); ctx.translate(cx, cy + (pos === 'defeat' ? 20 : 0));
  // wings (four, moth-like)
  for (const dir of [-1, 1]) {
    ctx.fillStyle = color.main;
    ctx.beginPath();
    ctx.moveTo(dir * 14, -20);
    ctx.quadraticCurveTo(dir * 96, -70 - flap, dir * 110, -10 - flap * 0.5);
    ctx.quadraticCurveTo(dir * 70, 4, dir * 16, 8); ctx.closePath(); ctx.fill(); outline(ctx, 5); ctx.stroke();
    ctx.fillStyle = color.glow;
    ctx.beginPath(); ctx.arc(dir * 72, -34 - flap * 0.7, 10, 0, 7); ctx.fill();
    ctx.fillStyle = color.dark;
    ctx.beginPath(); ctx.arc(dir * 88, -20 - flap * 0.5, 6, 0, 7); ctx.fill();
  }
  // furry body
  ctx.fillStyle = bodyGrad(ctx, 0, 14, 60, { main: '#e8a468', glow: '#ffe3bd', dark: '#7a3a18' });
  ctx.beginPath(); ctx.ellipse(0, 20, 34, 44, 0, 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  // head with curled proboscis
  ctx.fillStyle = bodyGrad(ctx, 0, -34, 44, color);
  ctx.beginPath(); ctx.arc(0, -36, 28, 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  ctx.strokeStyle = color.glow; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, -58 + sway(t) * 2, 10, 0.4, Math.PI * 1.8); ctx.stroke();
  // antennae plumes
  for (const dir of [-1, 1]) {
    ctx.strokeStyle = '#0a0c0a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(dir * 10, -56); ctx.quadraticCurveTo(dir * 30, -78, dir * 44, -70 - flap * 0.2); ctx.stroke();
    ctx.fillStyle = color.main;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(dir * (18 + i * 10), -62 - i * 3 - flap * 0.1, 5, 0, 7); ctx.fill(); }
  }
  eye(ctx, -12, -38, 9, color, 1);
  eye(ctx, 12, -38, 9, color, 1);
  ctx.restore();
}

export function drawGelundra(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Tide) {
  const droop = pos === 'defeat' ? 18 : 0;
  ctx.save(); ctx.translate(cx, cy + droop);
  // ice slab body — a sleeping giant of the spring
  ctx.fillStyle = bodyGrad(ctx, 0, 10, 80, color);
  ctx.beginPath();
  ctx.moveTo(-64, 62); ctx.lineTo(-52, -30); ctx.lineTo(-20, -58 - sway(t) * 2);
  ctx.lineTo(24, -52); ctx.lineTo(56, -18); ctx.lineTo(64, 62); ctx.closePath();
  ctx.fill(); outline(ctx, 6); ctx.stroke();
  // frost shards on the back
  ctx.fillStyle = color.glow;
  for (const [sx, sy] of [[-40, -34], [-8, -56], [26, -48]]) {
    ctx.beginPath(); ctx.moveTo(sx - 8, sy); ctx.lineTo(sx, sy - 26 - sway(t) * 2); ctx.lineTo(sx + 8, sy); ctx.closePath();
    ctx.fill(); outline(ctx, 4); ctx.stroke();
  }
  // closed, sleeping eyes (or bright when hurt)
  if (pos === 'defeat') {
    ctx.strokeStyle = '#0a0c0a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-30, 2); ctx.lineTo(-14, 10); ctx.moveTo(-14, 2); ctx.lineTo(-30, 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, 2); ctx.lineTo(30, 10); ctx.moveTo(30, 2); ctx.lineTo(14, 10); ctx.stroke();
  } else {
    eye(ctx, -22, 4, 10, color, pos === 'hurt' ? 1 : 0);
    eye(ctx, 22, 4, 10, color, pos === 'hurt' ? 1 : 0);
  }
  // mouth line
  ctx.strokeStyle = '#0a0c0a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-12, 34); ctx.quadraticCurveTo(0, 40 + sway(t) * 1.5, 12, 34); ctx.stroke();
  // drips
  ctx.fillStyle = 'rgba(213,242,251,.8)';
  const d = (t * 24) % 30;
  ctx.beginPath(); ctx.ellipse(-40, 60 + d * 0.3, 3, 5, 0, 0, 7); ctx.fill();
  ctx.restore();
}

export function drawNocturne(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Gloom) {
  const rise = pos === 'defeat' ? 24 : sway(t) * 6;
  ctx.save(); ctx.translate(cx, cy + rise);
  // trailing shadow cloak
  const g = ctx.createLinearGradient(0, -60, 0, 80);
  g.addColorStop(0, color.main); g.addColorStop(0.7, '#1a0a2e'); g.addColorStop(1, 'rgba(10,5,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-50, -30);
  ctx.quadraticCurveTo(-70, 30, -40 + sway(t * 1.4) * 8, 78);
  ctx.quadraticCurveTo(-14, 58, 0, 84);
  ctx.quadraticCurveTo(14, 58, 40 - sway(t * 1.2) * 8, 78);
  ctx.quadraticCurveTo(70, 30, 50, -30);
  ctx.quadraticCurveTo(0, -66, -50, -30);
  ctx.closePath(); ctx.fill(); outline(ctx, 5); ctx.stroke();
  // crescent head-mask
  ctx.fillStyle = bodyGrad(ctx, 0, -34, 56, { main: '#e6dcf5', glow: '#ffffff', dark: '#9b86c2' });
  ctx.beginPath(); ctx.arc(0, -36, 34, 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  ctx.fillStyle = '#1a0a2e';
  ctx.beginPath(); ctx.arc(14, -40, 26, 0, 7); ctx.fill();
  // caged shadows (its keepsakes)
  ctx.fillStyle = 'rgba(160,95,224,.5)';
  for (const [sx, sy, sr] of [[-26, 18, 8], [22, 26, 6], [-4, 40, 7]]) {
    ctx.beginPath(); ctx.arc(sx + sway(t + sx) * 2, sy, sr, 0, 7); ctx.fill();
    ctx.strokeStyle = '#0a0c0a'; ctx.lineWidth = 3; ctx.stroke();
  }
  // the one glowing eye
  ctx.fillStyle = color.main; ctx.shadowColor = color.glow; ctx.shadowBlur = 22;
  ctx.beginPath(); ctx.arc(-8, -38, 7, 0, 7); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-8, -38, 3, 0, 7); ctx.fill();
  if (pos === 'defeat') {
    ctx.strokeStyle = '#0a0c0a'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-40, -60); ctx.lineTo(20, -14); ctx.stroke();
  }
  ctx.restore();
}

export const SPECIES_ART = {
  emberling: drawEmberling, verdanom: drawVerdanom, voltip: drawVoltip,
  tidrel: drawTidrel, gloomcap: drawGloomcap,
  magmoth: drawMagmoth, gelundra: drawGelundra, nocturne: drawNocturne,
  cindermot: drawCindermot, embersnail: drawEmbersnail, mossbeak: drawMossbeak,
  thornback: drawThornback, stormpup: drawStormpup, peblite: drawPeblite,
  frostcap: drawFrostcap, duskfin: drawDuskfin, gloomling: drawGloomling,
};

// ---------------------------------------------------------------- juniors (nine common wilds)
export function drawCindermot(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Ember) {
  const hover = pos === 'defeat' ? 24 : Math.sin(t * 4) * 6;
  ctx.save(); ctx.translate(cx, cy - hover);
  // ember trail behind the spark-mote
  ctx.fillStyle = color.dark; ctx.globalAlpha = 0.5;
  for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(-i * 14, i * 5, 7 - i * 1.6, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = bodyGrad(ctx, 0, 0, 46, color);
  ctx.beginPath(); ctx.arc(0, 0, 20 + sway(t), 0, 7); ctx.fill(); outline(ctx, 4); ctx.stroke();
  // wings of flame
  for (const dir of [-1, 1]) {
    ctx.fillStyle = color.glow; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.ellipse(dir * 20, -14, 14, 6, dir * (0.7 + sway(t) * 0.2), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  eye(ctx, -7, -3, 5.5, color, 0); eye(ctx, 7, -3, 5.5, color, 0);
  ctx.restore();
}
export function drawEmbersnail(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Ember) {
  const droop = pos === 'defeat' ? 12 : 0;
  ctx.save(); ctx.translate(cx, cy + droop);
  // smouldering shell (spiral)
  ctx.fillStyle = bodyGrad(ctx, 8, -12, 66, color);
  ctx.beginPath(); ctx.arc(8, -12, 40 + droop * 0.2, 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  ctx.strokeStyle = color.dark; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(8, -12, 26, sway(t) * 0.3, sway(t) * 0.3 + 5.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(8, -12, 13, -sway(t) * 0.3, -sway(t) * 0.3 + 4.4); ctx.stroke();
  // smoke from shell vent
  ctx.fillStyle = 'rgba(220,220,220,.35)';
  for (let i = 0; i < 3; i++) { const s = (t * 20 + i * 14) % 42; ctx.beginPath(); ctx.arc(8 + Math.sin(s * 0.2) * 5, -56 - s, 4 + s * 0.12, 0, 7); ctx.fill(); }
  // foot + head
  ctx.fillStyle = bodyGrad(ctx, -26, 26, 44, { main: '#f0d9b8', glow: '#fff3dd', dark: '#b08d5c' });
  ctx.beginPath(); ctx.ellipse(-6, 30, 44, 12, 0, 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-40, 18 - droop, 14, 18, -0.3, 0, 7); ctx.fill(); ctx.stroke();
  eye(ctx, -44, 12 - droop, 5.5, color, 0);
  ctx.restore();
}
export function drawMossbeak(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Verdant) {
  const hop = pos === 'defeat' ? 14 : Math.abs(Math.sin(t * 3)) * 4;
  ctx.save(); ctx.translate(cx, cy - hop);
  // round body
  ctx.fillStyle = bodyGrad(ctx, 0, 8, 60, { main: '#7fa05b', glow: '#d7e8a8', dark: '#3c5930' });
  ctx.beginPath(); ctx.arc(0, 10, 40, 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  // leaf crest
  ctx.fillStyle = color.main;
  for (const [a, w] of [[-0.5, 12], [-0.1, 15], [0.35, 11]]) {
    ctx.beginPath(); ctx.ellipse(Math.cos(a - 1.6) * 34, -24 + Math.sin(a) * 6, w, 6, a, 0, 7); ctx.fill(); outline(ctx, 3); ctx.stroke();
  }
  // beak + feet
  ctx.fillStyle = '#e8b34b';
  ctx.beginPath(); ctx.moveTo(30, 6); ctx.lineTo(52, 12); ctx.lineTo(30, 18); ctx.closePath(); ctx.fill(); outline(ctx, 3); ctx.stroke();
  ctx.strokeStyle = '#e8b34b'; ctx.lineWidth = 4;
  for (const dir of [-10, 10]) { ctx.beginPath(); ctx.moveTo(dir, 46); ctx.lineTo(dir, 56 - hop); ctx.stroke(); }
  eye(ctx, 12, 0, 7, color, pos === 'hurt' ? 1 : 0);
  if (pos === 'defeat') { ctx.strokeStyle = '#0a0c0a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, -20); ctx.lineTo(-8, -8); ctx.moveTo(-8, -20); ctx.lineTo(-20, -8); ctx.stroke(); }
  ctx.restore();
}
export function drawThornback(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Verdant) {
  const droop = pos === 'defeat' ? 12 : 0;
  ctx.save(); ctx.translate(cx, cy + droop);
  // low bramble shell
  ctx.fillStyle = bodyGrad(ctx, 0, 16, 66, color);
  ctx.beginPath(); ctx.ellipse(0, 20, 52, 30, 0, 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  // thorns along the ridge
  ctx.fillStyle = '#d8e3b0';
  for (let i = -3; i <= 3; i++) {
    const tx = i * 14, ty = 20 - Math.sqrt(Math.max(0, 1 - (tx / 52) ** 2)) * 30;
    ctx.beginPath(); ctx.moveTo(tx - 5, ty); ctx.lineTo(tx, ty - 18 - (pos === 'hurt' ? 4 : 0)); ctx.lineTo(tx + 5, ty); ctx.closePath(); ctx.fill(); outline(ctx, 3); ctx.stroke();
  }
  // peeking face
  eye(ctx, -34, 18, 6, color, 0); eye(ctx, -20, 18, 6, color, 0);
  ctx.fillStyle = '#0a0c0a'; ctx.beginPath(); ctx.arc(-27, 30, 4, 0, 7); ctx.fill();
  ctx.restore();
}
export function drawStormpup(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Volt) {
  const bounce = pos === 'defeat' ? 16 : Math.abs(Math.sin(t * 5)) * 5;
  ctx.save(); ctx.translate(cx, cy - bounce);
  // body + curled tail of static
  ctx.fillStyle = bodyGrad(ctx, 0, 14, 60, { main: '#9fb4d8', glow: '#eaf2ff', dark: '#43567c' });
  ctx.beginPath(); ctx.ellipse(4, 20, 44, 30, 0, 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  ctx.strokeStyle = color.main; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-38, 8); ctx.quadraticCurveTo(-58, -10, -46 + sway(t) * 4, -26); ctx.stroke();
  // head + ears
  ctx.fillStyle = bodyGrad(ctx, 30, -8, 50, { main: '#9fb4d8', glow: '#eaf2ff', dark: '#43567c' });
  ctx.beginPath(); ctx.arc(30, -8, 26, 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  for (const d of [-1, 1]) {
    ctx.fillStyle = color.dark;
    ctx.beginPath(); ctx.moveTo(24 + d * 12, -28); ctx.lineTo(24 + d * 20, -52 + bounce); ctx.lineTo(24 + d * 2, -32); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  eye(ctx, 26, -10, 6.5, color, pos === 'hurt' ? 1 : 0); eye(ctx, 42, -10, 6.5, color, pos === 'hurt' ? 1 : 0);
  // spark collar
  ctx.fillStyle = color.glow; ctx.shadowColor = color.main; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(14, 14, 4, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  ctx.restore();
}
export function drawPeblite(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Volt) {
  const wobble = pos === 'defeat' ? 0 : sway(t) * 0.06;
  ctx.save(); ctx.translate(cx, cy + (pos === 'defeat' ? 16 : 0)); ctx.rotate(wobble);
  // pebble body
  ctx.fillStyle = bodyGrad(ctx, 0, 8, 60, { main: '#8d97a5', glow: '#dfe6ef', dark: '#3d444d' });
  ctx.beginPath(); ctx.ellipse(0, 10, 42, 36, 0.15, 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  // crack seams glowing static
  ctx.strokeStyle = color.main; ctx.lineWidth = 3.5; ctx.shadowColor = color.glow; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.moveTo(-18, -8); ctx.lineTo(-4, 6); ctx.lineTo(-10, 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, -12); ctx.lineTo(22, 4); ctx.stroke();
  ctx.shadowBlur = 0;
  // stubby legs
  ctx.fillStyle = '#5a626d';
  for (const dir of [-14, 14]) { ctx.beginPath(); ctx.ellipse(dir, 46, 9, 5, 0, 0, 7); ctx.fill(); }
  eye(ctx, -10, -2, 6.5, color, pos === 'hurt' ? 1 : 0); eye(ctx, 12, -4, 6.5, color, pos === 'hurt' ? 1 : 0);
  ctx.restore();
}
export function drawFrostcap(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Tide) {
  const droop = pos === 'defeat' ? 14 : 0;
  ctx.save(); ctx.translate(cx, cy + droop);
  // stem
  ctx.fillStyle = bodyGrad(ctx, 0, 24, 46, { main: '#eef6f8', glow: '#ffffff', dark: '#b8ccd4' });
  ctx.beginPath(); ctx.moveTo(-14, 46); ctx.quadraticCurveTo(-10, 10, -12, 2); ctx.lineTo(12, 2); ctx.quadraticCurveTo(10, 10, 14, 46); ctx.closePath(); ctx.fill(); outline(ctx); ctx.stroke();
  // icy cap
  ctx.fillStyle = bodyGrad(ctx, 0, -14, 66, color);
  ctx.beginPath(); ctx.ellipse(0, -12, 42, 26 + droop * 0.3, 0, Math.PI, 7); ctx.quadraticCurveTo(0, 12 - droop, -42, -12); ctx.fill(); outline(ctx); ctx.stroke();
  // frost speckles
  ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.85;
  for (const [fx, fy] of [[-20, -20], [6, -28], [22, -14], [-6, -10]]) { ctx.beginPath(); ctx.arc(fx, fy, 3, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  eye(ctx, -9, 18, 5.5, color, 0); eye(ctx, 9, 18, 5.5, color, 0);
  // cold tear
  const tp = (t * 26) % 30;
  ctx.fillStyle = color.glow; ctx.beginPath(); ctx.arc(-9, 26 + tp, 2.5, 0, 7); ctx.fill();
  ctx.restore();
}
export function drawDuskfin(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Tide) {
  const swim = pos === 'defeat' ? 18 : Math.sin(t * 3) * 5;
  ctx.save(); ctx.translate(cx, cy + swim);
  // crescent body
  ctx.fillStyle = bodyGrad(ctx, 0, 6, 60, { main: '#5a86b8', glow: '#bcd9f2', dark: '#243c5c' });
  ctx.beginPath(); ctx.ellipse(4, 6, 46, 24, -0.12, 0, 7); ctx.fill(); outline(ctx); ctx.stroke();
  // dusk tail-fin
  ctx.fillStyle = color.main;
  ctx.beginPath(); ctx.moveTo(-38, 6); ctx.quadraticCurveTo(-64, -20 + sway(t) * 6, -70, 4); ctx.quadraticCurveTo(-64, 26, -38, 12); ctx.closePath(); ctx.fill(); outline(ctx, 4); ctx.stroke();
  // dorsal fin
  ctx.beginPath(); ctx.moveTo(-2, -16); ctx.quadraticCurveTo(14, -40 - (pos === 'defeat' ? 0 : sway(t) * 4), 26, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
  eye(ctx, 30, 0, 7, color, pos === 'hurt' ? 1 : 0);
  // bubble trail
  ctx.fillStyle = 'rgba(220,240,255,.6)';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(48 + i * 8, -6 - ((t * 18 + i * 9) % 22), 2.5 + i, 0, 7); ctx.fill(); }
  ctx.restore();
}
export function drawGloomling(ctx, cx, cy, t, pos, color = ELEMENT_COLORS.Gloom) {
  const creep = pos === 'defeat' ? 20 : sway(t * 1.5) * 4;
  ctx.save(); ctx.translate(cx, cy);
  // amorphous shadow blob with wobbling base
  ctx.fillStyle = bodyGrad(ctx, 0, 4, 56, { main: '#3a2c50', glow: '#8f6fc0', dark: '#14101f' });
  ctx.beginPath();
  ctx.moveTo(-34, 34);
  ctx.quadraticCurveTo(-40 + creep, 0, -18, -22);
  ctx.quadraticCurveTo(0, -38 - creep * 0.4, 18, -22);
  ctx.quadraticCurveTo(40 + creep, 0, 34, 34);
  for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(20 - i * 18 + Math.sin(t * 4 + i) * 4, 44, -14 - i * 8, 34);
  ctx.closePath(); ctx.fill(); outline(ctx); ctx.stroke();
  eye(ctx, -11, -6, 7, color, 0); eye(ctx, 11, -6, 7, color, 0);
  // tiny mushroom-cap it fell from
  ctx.fillStyle = color.dark;
  ctx.beginPath(); ctx.ellipse(0, -30, 16, 7, sway(t) * 0.1, Math.PI, 7); ctx.fill(); outline(ctx, 3); ctx.stroke();
  if (pos === 'defeat') { ctx.strokeStyle = '#cfd4e8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-18, 30); ctx.lineTo(-10, 40); ctx.moveTo(12, 34); ctx.lineTo(20, 42); ctx.stroke(); }
  ctx.restore();
}

export function drawCreature(ctx, speciesId, cx, cy, t, pos) {
  if (drawQuilt(ctx, speciesId, cx, cy, pos, 160, t)) return;
  const fn = SPECIES_ART[speciesId] || drawGloomcap;
  fn(ctx, cx, cy, t, pos);
}

// ---------------------------------------------------------------- Quilt Edition (Monspec1)
// Muse statics + Manus 4x4 animation sheets. Returns true if it drew something.
const quiltCache = new Map();
const QUILT_STATIC = new Set(['embercub','cinderwing','leaflet','thornbloom','sparklet','voltail','tidepup','bubblet','gloomoth','shadewhisp']);
const QUILT_SHEET = new Set(['pyrelamb','ashwing','mosskip','brambletusk','zipfinch','thunderhare','brinebell','moonseal','duskowl','shadehare']);
const SHEET_ROW = { idle: 0, attack: 1, hurt: 1, skill: 2, defeat: 3 };
function loadImg(key, src) {
  let img = quiltCache.get(key);
  if (img === undefined) {
    img = new Image();
    img.onerror = () => quiltCache.set(key, false);
    img.onload = () => quiltCache.set(key, img);
    img.src = src;
    quiltCache.set(key, img);
  }
  return img;
}
export function loadQuiltImg(key, src) { return loadImg(key, src); }
export function drawQuilt(ctx, speciesId, cx, cy, pose, size, t = 0, flip = false) {
  const rowMap = SHEET_ROW[pose] ?? (pose === 'defeat' ? 3 : 0);
  if (QUILT_SHEET.has(speciesId)) {
    const img = loadImg('sheet:' + speciesId, `assets/quilt/${speciesId}-sheet.png`);
    if (!img || img === false || !img.naturalWidth) return false;
    const cell = img.naturalWidth / 4;
    const frame = pose === 'idle' ? Math.floor(t * 6) % 4 : Math.floor(t * 12) % 4;
    ctx.save(); ctx.translate(cx, cy);
    if (flip) ctx.scale(-1, 1);
    if (pose === 'defeat') { ctx.globalAlpha = 0.45; ctx.translate(0, size * 0.12); }
    ctx.drawImage(img, frame * cell, rowMap * cell, cell, cell, -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }
  if (QUILT_STATIC.has(speciesId)) {
    const poseKey = pose === 'attack' || pose === 'hurt' ? `${speciesId}-atk` : speciesId;
    const img = loadImg('q:' + poseKey, `assets/quilt/${poseKey}.png`);
    if (!img || img === false || !img.naturalWidth) return false;
    ctx.save(); ctx.translate(cx, cy);
    if (flip) ctx.scale(-1, 1);
    if (pose === 'defeat') { ctx.globalAlpha = 0.45; ctx.translate(0, size * 0.12); }
    const bob = pose === 'idle' ? Math.sin(t * 3) * size * 0.02 : 0;
    ctx.drawImage(img, -size / 2, -size / 2 + bob, size, size);
    ctx.restore();
    return true;
  }
  return false;
}
export { QUILT_STATIC, QUILT_SHEET };

// ---------------------------------------------------------------- player ranger (field avatar)
export function drawRanger(ctx, cx, cy, dir, walking, t) {
  ctx.save(); ctx.translate(cx, cy);
  const bob = walking ? Math.abs(Math.sin(t * 12)) * 3 : 0;
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0, 16, 12, 5, 0, 0, 7); ctx.fill();
  ctx.translate(0, -bob);
  // cloak
  ctx.fillStyle = '#3b5a47'; outline(ctx, 3);
  ctx.beginPath(); ctx.moveTo(-10, 14); ctx.quadraticCurveTo(-12, -6, 0, -10); ctx.quadraticCurveTo(12, -6, 10, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  // satchel + head
  ctx.fillStyle = '#8a6b3f'; ctx.beginPath(); ctx.arc(dir > 0 ? 10 : -10, 6, 5, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8d5b0'; ctx.beginPath(); ctx.arc(0, -14, 7, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(dir * 3 - 2, -15, 1.6, 0, 7); ctx.arc(dir * 3 + 3, -15, 1.6, 0, 7); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- tileset
export function drawTile(ctx, tile, x, y, zone, tx, ty, t) {
  const P = zonePalette(zone);
  ctx.fillStyle = P.ground; ctx.fillRect(x, y, TILE, TILE);
  switch (tile) {
    case T.GRASS: {
      ctx.fillStyle = P.grassDark; ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = P.grass; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const gx = x + 4 + i * 8 + ((tx * 7 + ty * 13 + i) % 5);
        const swayA = Math.sin(t * 2 + gx * 0.1) * 2;
        ctx.beginPath(); ctx.moveTo(gx, y + TILE - 4);
        ctx.quadraticCurveTo(gx + swayA, y + 18, gx + swayA * 1.6, y + 8 + (i % 3) * 5);
        ctx.stroke();
      }
      break;
    }
    case T.ROCK: {
      ctx.fillStyle = P.ground; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = P.rock;
      ctx.beginPath(); ctx.moveTo(x + 3, y + TILE); ctx.lineTo(x + 6, y + 10); ctx.lineTo(x + 18, y + 3);
      ctx.lineTo(x + 34, y + 9); ctx.lineTo(x + 37, y + TILE); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = P.rockLit; ctx.fillRect(x + 10, y + 8, 8, 4);
      break;
    }
    case T.WATER: {
      const w = Math.sin(t * 2 + x * 0.05 + y * 0.07) * 3;
      ctx.fillStyle = P.water; ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = P.waterLit; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x + 4, y + 14 + w); ctx.quadraticCurveTo(x + 20, y + 8 + w, x + 36, y + 16 + w); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 8, y + 30 - w); ctx.quadraticCurveTo(x + 22, y + 24 - w, x + 34, y + 32 - w); ctx.stroke();
      break;
    }
    case T.PATH:
      ctx.fillStyle = P.path; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,.14)';
      ctx.fillRect(x + ((tx * 31 + ty * 17) % 20), y + ((tx * 13 + ty * 29) % 20), 6, 4);
      break;
    case T.FLOWER: {
      ctx.fillStyle = P.ground; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = P.grassDark; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = P.grass; ctx.fillRect(x + 2, y + 26, 3, 10);
      const pulse = 1 + Math.sin(t * 3 + tx) * 0.1;
      ctx.fillStyle = P.flower;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + t * 0.4;
        ctx.beginPath(); ctx.arc(x + 20 + Math.cos(a) * 6 * pulse, y + 18 + Math.sin(a) * 6 * pulse, 4, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(x + 20, y + 18, 3.5, 0, 7); ctx.fill();
      break;
    }
    case T.PILLAR: {
      ctx.fillStyle = P.ground; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = P.rock; ctx.fillRect(x + 8, y, 24, TILE);
      ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3; ctx.strokeRect(x + 8, y, 24, TILE);
      ctx.fillStyle = P.accent; ctx.fillRect(x + 14, y + 6, 12, 4);
      break;
    }
    case T.SPRING: {
      ctx.fillStyle = P.water; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#eafcff';
      const r = (t * 14) % 18;
      ctx.beginPath(); ctx.arc(x + 20, y + 20, r, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(234,252,255,.7)'; ctx.stroke();
      break;
    }
    case T.BOSS: {
      ctx.fillStyle = P.grassDark; ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = P.accent; ctx.lineWidth = 3;
      ctx.save(); ctx.translate(x + 20, y + 20); ctx.rotate(t * 0.8);
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(12, 0); ctx.lineTo(0, 14); ctx.lineTo(-12, 0); ctx.closePath(); ctx.stroke();
      ctx.restore();
      break;
    }
    default: {
      // plain ground speckle
      ctx.fillStyle = 'rgba(0,0,0,.08)';
      ctx.fillRect(x + ((tx * 37 + ty * 11) % 30), y + ((tx * 17 + ty * 23) % 30), 5, 3);
    }
  }
  if (tile === T.EXIT_E || tile === T.EXIT_W) {
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#e8f2e4'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
    ctx.fillText(tile === T.EXIT_E ? '»' : '«', x + TILE / 2, y + TILE / 2 + 8);
  }
}

function zonePalette(zoneId) {
  if (zoneId === 'cliff') return { ground: '#3a2116', grassDark: '#4d2b16', grass: '#e8763c', rock: '#5a3222', rockLit: '#7c4a2e', water: '#35617a', waterLit: '#7fb6cc', path: '#5c4634', flower: '#ffb057', accent: '#ff8a3c' };
  if (zoneId === 'temple') return { ground: '#241536', grassDark: '#2f1b45', grass: '#8a5fd0', rock: '#3d2a55', rockLit: '#57406e', water: '#2a2a55', waterLit: '#6f6fc0', path: '#38274d', flower: '#c9a2ff', accent: '#a05fe0' };
  return { ground: '#22422b', grassDark: '#2a5232', grass: '#5fd36a', rock: '#41563f', rockLit: '#5d7355', water: '#2b7091', waterLit: '#7cc6e0', path: '#4a5c40', flower: '#a8e6ff', accent: '#5fd36a' };
}

export function zonePaletteOf(zoneId) { return zonePalette(zoneId); }

// ---------------------------------------------------------------- item icons + particles
export function drawSeedstoneIcon(ctx, x, y, s, t) {
  ctx.save(); ctx.translate(x, y);
  const pulse = 1 + Math.sin(t * 3) * 0.08;
  ctx.scale(s / 24 * pulse, s / 24 * pulse);
  const g = ctx.createRadialGradient(-4, -6, 2, 0, 0, 14);
  g.addColorStop(0, '#d7ffd0'); g.addColorStop(0.6, '#5fd36a'); g.addColorStop(1, '#1c5e2c');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 2, 11, 0, 7); ctx.fill();
  ctx.strokeStyle = '#0a0c0a'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = '#eaffea'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(8, -18, 6, -10); ctx.stroke();
  ctx.restore();
}

export function drawPotionIcon(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24);
  ctx.fillStyle = '#cfe8c8';
  ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(8, -10); ctx.lineTo(6, -2);
  ctx.quadraticCurveTo(12, 8, 0, 12); ctx.quadraticCurveTo(-12, 8, -6, -2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#0a0c0a'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#57d27a';
  ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(0, 4, 6, 0); ctx.lineTo(5, 8); ctx.quadraticCurveTo(0, 12, -5, 8); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawSparkle(ctx, x, y, t) {
  const pulse = 0.7 + Math.abs(Math.sin(t * 4)) * 0.5;
  ctx.save(); ctx.translate(x, y); ctx.rotate(t);
  ctx.fillStyle = 'rgba(255,250,200,.95)'; ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 14 * pulse;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * 10 * pulse, Math.sin(a) * 10 * pulse);
    ctx.lineTo(Math.cos(a + Math.PI / 4) * 3, Math.sin(a + Math.PI / 4) * 3);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
