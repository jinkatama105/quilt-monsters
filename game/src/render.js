// render.js — scene drawing on the main canvas: the camera-followed top-down
// field, the battle stage with creature portraits, hit flashes and particles.
// Also hosts the optional chroma-key PNG creature loader: if game/assets/creatures/
// later gains <species>_{idle,attack,defeat}.png files on black backgrounds, enabling
// it (?pngart=1 or localStorage vs.pngart=1) replaces the procedural portraits for
// those poses. The black pixels are keyed to transparency at threshold 24. The game
// runs at full fidelity without the folder or the flag — nothing is fetched unless
// the flag is on, so no 404 noise in a normal run.
import { VIEW_W, VIEW_H, TILE, STEP_TIME, PALETTE, ELEMENT_COLORS } from './config.js?v=16';
import { MAPS, NPCS, PLAYER_SHEET, image, drawSheet } from './world.js?v=16';
import { drawRanger, drawCreature, drawSparkle } from './art.js?v=16';
import { SPECIES } from './data.js?v=16';
import { battleBg, drawBattleBg } from './bg.js?v=16';

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

// Ghibli RGBA portraits (assets/world/ghibli-<species>-512.png). No chroma key —
// these ship with real alpha. Falls back to procedural when a file is missing.
const monsterCache = new Map();
// assets that actually ship (makefun roster loop adds the rest later); prevents 404 noise
const GHIBLI_ART = new Set(['cindermot','duskfin','emberling','embersnail','frostcap','gelundra','gloomling','magmoth','mossbeak','nocturne','stormpup','thornback','verdanom','voltip','peblite']); // tidrel & gloomcap: no art yet (Muse) -> procedural fallback
function drawGhibliCreature(ctx, speciesId, cxp, cyp, pose, isPlayer) {
  if (!GHIBLI_ART.has(speciesId)) return false;
  let img = monsterCache.get(speciesId);
  if (img === undefined) {
    img = new Image();
    img.onerror = () => monsterCache.set(speciesId, false);
    img.onload = () => monsterCache.set(speciesId, img);
    img.src = `assets/world/ghibli-${speciesId}-512.png`;
    monsterCache.set(speciesId, img);
  }
  if (!img || img === false || !img.naturalWidth) return false;
  const size = 200;
  ctx.save();
  ctx.translate(cxp, cyp);
  if (pose === 'attack') ctx.translate(isPlayer ? 14 : -14, 0);
  if (pose === 'defeat') { ctx.globalAlpha = 0.5; ctx.translate(0, 24); }
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(0, size * 0.42, size * 0.42, 16, 0, 0, 7); ctx.fill();
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
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
// drawField: authored PNG map under a camera, NPCs + player as walk sheets.
// smoothPos: eased interpolation between tiles — px/py are the logical target,
// fromPx/fromPy the step start; prevents the teleport-feel at high step rates.
function smoothPos(world) {
  if (!(world.moving > 0) || world.fromPx === undefined) return { x: world.px, y: world.py };
  const p = 1 - Math.max(0, Math.min(1, world.moving / STEP_TIME)); // 0..1 step progress
  const e = p * p * (3 - 2 * p);                                    // smoothstep
  return { x: world.fromPx + (world.px - world.fromPx) * e, y: world.fromPy + (world.py - world.fromPy) * e };
}

export function drawField(ctx, world, t) {
  const { w: MW, h: MH } = world.dims();
  const p = smoothPos(world);
  const camX = Math.max(0, Math.min(MW * TILE - VIEW_W, p.x * TILE + TILE / 2 - VIEW_W / 2));
  const camY = Math.max(0, Math.min(MH * TILE - VIEW_H, p.y * TILE + TILE / 2 - VIEW_H / 2));
  ctx.save();
  ctx.translate(-Math.round(camX), -Math.round(camY));
  const map = image(MAPS[world.zoneId].map);
  if (map && map.naturalWidth) ctx.drawImage(map, 0, 0, MW * TILE, MH * TILE);
  else { ctx.fillStyle = '#20351f'; ctx.fillRect(camX, camY, VIEW_W, VIEW_H); }  // shortcut: map still loading
  // hidden sparkle items
  for (const it of world.items) {
    const bob = Math.sin(t * 3 + it.bob) * 4;
    drawSparkle(ctx, it.x * TILE + TILE / 2, it.y * TILE + 12 + bob, t + it.bob);
  }
  // NPCs: static facing-down frame with a soft idle bob
  for (const n of (NPCS[world.zoneId] || [])) {
    const cx = n.x * TILE + TILE / 2, gy = n.y * TILE + TILE - 2;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(cx, gy, 14, 5, 0, 0, 7); ctx.fill();
    if (!drawSheet(ctx, n.sheet, 0, Math.floor(t * 2 + n.x) % 2 === 0 ? 0 : 2, cx, gy, TILE * 1.7)) {
      drawRanger(ctx, cx, gy - TILE * 0.8, 0, false, t + n.x);   // procedural fallback
    }
  }
  // ranger — position interpolated, walk frame follows step progress so the
  // foot plants at each tile arrival (frame from the global timer slipped).
  const walking = world.moving > 0.02;
  const prog = walking ? 1 - Math.max(0, Math.min(1, world.moving / STEP_TIME)) : 0;
  const frame = walking ? (1 + Math.floor(prog * 2) % 2) : 0; // contact|passing|contact across one step; idle = contact
  const cx = p.x * TILE + TILE / 2, gy = p.y * TILE + TILE - 2;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(cx, gy, 15, 6, 0, 0, 7); ctx.fill();
  if (!drawSheet(ctx, PLAYER_SHEET, world.dir, frame, cx, gy, TILE * 1.9)) {
    drawRanger(ctx, cx, gy - TILE * 0.8, world.dir, walking, t);
  }
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

  // zone backdrop (assets/battle/<zone>.png) when available, else element blend
  const zoneId = battle._zone;
  if (zoneId) battleBg(zoneId);
  if (zoneId && drawBattleBg(ctx, zoneId, VIEW_W, VIEW_H)) {
    // fallthrough: painted below still decorates with ground ellipses
  } else {
  const bg = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  bg.addColorStop(0, mixHex('#10151c', ec.dark));
  bg.addColorStop(1, mixHex('#0d1310', pc.dark));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

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
      if (drawGhibliCreature(ctx, sp, a.x, a.y, pose, who === 'player')) return;
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
