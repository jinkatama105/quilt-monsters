// render.js — scene drawing on the main canvas: the camera-followed top-down
// field, the battle stage with creature portraits, hit flashes and particles.
// Also hosts the optional chroma-key PNG creature loader: if game/assets/creatures/
// later gains <species>_{idle,attack,defeat}.png files on black backgrounds, enabling
// it (?pngart=1 or localStorage vs.pngart=1) replaces the procedural portraits for
// those poses. The black pixels are keyed to transparency at threshold 24. The game
// runs at full fidelity without the folder or the flag — nothing is fetched unless
// the flag is on, so no 404 noise in a normal run.
import { VIEW_W, VIEW_H, TILE, PALETTE, ELEMENT_COLORS } from './config.js';
import { MAP_W, MAP_H, T } from './world.js';
import { drawTile, drawRanger, drawCreature, drawSparkle } from './art.js';
import { SPECIES } from './data.js';

// ------------------------------------------------------------ chroma-key PNG loader
const pngCache = new Map();        // "species:pose" -> keyed canvas | false (tried & missing)
const pending  = new Set();        // keys currently loading
let chromaEnabled = false;
try {
  chromaEnabled = new URLSearchParams(location.search).has('pngart') ||
    localStorage.getItem('vs.pngart') === '1';
} catch (e) { /* blocked storage: procedural art only, which is fine */ }

/** Black -> transparent at threshold; returns an offscreen canvas. */
function keyChroma(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);
  const data = cx.getImageData(0, 0, c.width, c.height);
  const px = data.data, THRESH = 24;
  for (let i = 0; i < px.length; i += 4) {
    const lum = px[i] + px[i + 1] + px[i + 2];
    if (lum <= THRESH * 3) { px[i + 3] = 0; }
    else if (lum < THRESH * 6) { px[i + 3] = Math.round(255 * (lum / (THRESH * 6) - 0.5)); } // soft edge
  }
  cx.putImageData(data, 0, 0);
  return c;
}

/** Kick a silent load for species+pose if the flag is on. onerror just records false. */
function requestPng(speciesId, pose) {
  if (!chromaEnabled) return;
  const key = speciesId + ':' + pose;
  if (pngCache.has(key) || pending.has(key)) return;
  pending.add(key);
  const img = new Image();
  img.onload = () => { pending.delete(key); try { pngCache.set(key, keyChroma(img)); } catch (e) { pngCache.set(key, false); } };
  img.onerror = () => { pending.delete(key); pngCache.set(key, false); };
  img.src = `assets/creatures/${speciesId}_${pose}.png`;
}

/** Draw the keyed PNG if we have one; true when it drew. */
function drawPngCreature(ctx, speciesId, pose, cxp, cyp, scale = 1) {
  requestPng(speciesId, pose);
  const sprite = pngCache.get(speciesId + ':' + pose);
  if (!sprite) return false;
  ctx.save();
  ctx.translate(cxp, cyp);
  ctx.scale(scale, scale);
  ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
  ctx.restore();
  return true;
}

export class Particles {
  constructor() { this.list = []; }
  spawn(x, y, color, n = 12, speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      this.list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0.5 + Math.random() * 0.4, color, r: 2 + Math.random() * 4 });
    }
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 340 * dt;
      if (p.t <= 0) this.list.splice(i, 1);
    }
  }
  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.t * 2));
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- field scene
export function drawField(ctx, world, t) {
  const camX = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, world.px * TILE + TILE / 2 - VIEW_W / 2));
  const camY = Math.max(0, Math.min(MAP_H * TILE - VIEW_H, world.py * TILE + TILE / 2 - VIEW_H / 2));
  ctx.save();
  ctx.translate(-Math.round(camX), -Math.round(camY));
  const x0 = Math.floor(camX / TILE), y0 = Math.floor(camY / TILE);
  const x1 = Math.min(MAP_W - 1, x0 + Math.ceil(VIEW_W / TILE) + 1);
  const y1 = Math.min(MAP_H - 1, y0 + Math.ceil(VIEW_H / TILE) + 1);
  const grid = world.zone().grid;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      drawTile(ctx, grid[y][x], x * TILE, y * TILE, world.zoneId, x, y, t);
  // hidden sparkle items
  for (const it of world.items) {
    const bob = Math.sin(t * 3 + it.bob) * 4;
    drawSparkle(ctx, it.x * TILE + TILE / 2, it.y * TILE + 12 + bob, t + it.bob);
  }
  // ranger
  const walking = world.moving > 0.02;
  drawRanger(ctx, world.px * TILE + TILE / 2, world.py * TILE + TILE / 2 - 6, 1, walking, t);
  ctx.restore();
  // vignette keeps the scene readable under HUD panels
  const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// ---------------------------------------------------------------- battle stage
export function battleAnchors() {
  return { player: { x: 320, y: 560 }, enemy: { x: 950, y: 300 } };
}

export function drawBattle(ctx, battle, t, particles) {
  const enemySp = SPECIES[battle.enemy.species];
  const playerSp = SPECIES[battle.player.species];
  const ec = ELEMENT_COLORS[enemySp.element], pc = ELEMENT_COLORS[playerSp.element];

  // stage backdrop blends the two elements
  const bg = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  bg.addColorStop(0, mixHex('#10151c', ec.dark));
  bg.addColorStop(1, mixHex('#0d1310', pc.dark));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // ground ellipses
  const anchors = battleAnchors();
  for (const [a, c] of [[anchors.enemy, ec], [anchors.player, pc]]) {
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.beginPath(); ctx.ellipse(a.x, a.y + 90, 150, 40, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = c.main; ctx.globalAlpha = 0.35; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(a.x, a.y + 90, 150, 40, 0, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // drifting element motes
  for (let i = 0; i < 10; i++) {
    const mx = (i * 137 + t * 20 * (1 + i % 3)) % VIEW_W;
    const my = (i * 89 + Math.sin(t + i) * 30) % 400 + 60;
    ctx.fillStyle = i % 2 ? ec.glow : pc.glow;
    ctx.globalAlpha = 0.16;
    ctx.beginPath(); ctx.arc(mx, my, 3, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  const fx = battle.fx;
  const shake = (who) => fx && fx.target === who && fx.kind === 'hit' ? Math.sin(fx.t * 60) * 6 : 0;
  const poseOf = (who) => (battle.enemy.hp <= 0 && who === 'enemy') || (battle.player.hp <= 0 && who === 'player') ? 'defeat'
    : fx && fx.target === who && fx.kind === 'attack' ? 'attack'
    : fx && fx.target === who && (fx.kind === 'hit' || fx.kind === 'miss') ? 'hurt' : 'idle';
  const drawOne = (sp, a, who) => {
    const pose = poseOf(who);
    // optional chroma-keyed PNG art overrides procedural for idle/attack/defeat poses
    if (pose === 'idle' || pose === 'attack' || pose === 'defeat') {
      if (drawPngCreature(ctx, sp, pose, a.x, a.y)) return;
    }
    drawCreature(ctx, sp, a.x, a.y, t, pose);
  };

  // enemy portrait
  ctx.save(); ctx.translate(shake('enemy'), 0);
  drawOne(battle.enemy.species, anchors.enemy, 'enemy');
  ctx.restore();
  // player portrait
  ctx.save(); ctx.translate(shake('player'), 0);
  drawOne(battle.player.species, anchors.player, 'player');
  ctx.restore();

  // capture swirl while a seedstone works
  if (fx && fx.kind === 'capture') {
    ctx.strokeStyle = ELEMENT_COLORS.Verdant.main; ctx.lineWidth = 5;
    const r = 60 + fx.t * 60;
    ctx.beginPath(); ctx.arc(anchors.enemy.x, anchors.enemy.y, r, fx.t * 12, fx.t * 12 + 4); ctx.stroke();
  }

  particles.draw(ctx);
}

function mixHex(a, b) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa >> 16) + (pb >> 16)) >> 1, g = (((pa >> 8) & 255) + ((pb >> 8) & 255)) >> 1, bl = ((pa & 255) + (pb & 255)) >> 1;
  return `rgb(${r},${g},${bl})`;
}
