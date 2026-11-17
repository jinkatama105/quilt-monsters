// art.js — every visual in the game, drawn procedurally with canvas code:
// creature portraits (one function per species), the field tileset, item icons,
// particles. pos: 'idle' | 'defeat' | 'hurt'. All silhouettes are thick,
// caricatural and share one family colour per element.
import { ELEMENT_COLORS, TILE, T } from './config.js';
export { T } from './config.js';

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
};

export function drawCreature(ctx, speciesId, cx, cy, t, pos) {
  const fn = SPECIES_ART[speciesId] || drawGloomcap;
  fn(ctx, cx, cy, t, pos);
}

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
