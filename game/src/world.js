// world.js — the top-down exploration field: three zones, tile maps, walking,
// random encounters in tall grass, hidden clickable items and the mission markers.
import { TILE, ENCOUNTER_CHANCE, HIDDEN_ITEM_CHANCE, T } from './config.js';
import { WILD_TABLES, SPECIES, MISSIONS } from './data.js';
import { mulberry32, pickWeighted, roll, rint } from './random.js';

export { T };
const BLOCKING = new Set([T.ROCK, T.WATER, T.PILLAR]);

export const MAP_W = 40;
export const MAP_H = 26;

// ---------------------------------------------------------------- map generation
// Deterministic per zone: same seed always yields the same meadow, bluff and shrine.
function generateZone(id) {
  const rng = mulberry32({ moss: 1337, cliff: 4242, temple: 9090 }[id]);
  const grid = [];
  for (let y = 0; y < MAP_H; y++) {
    const row = [];
    for (let x = 0; x < MAP_W; x++) {
      const border = x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1;
      row.push(border ? T.ROCK : T.GROUND);
    }
    grid.push(row);
  }
  const blob = (cx, cy, r, tile) => {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        if (x <= 0 || y <= 0 || x >= MAP_W - 1 || y >= MAP_H - 1) continue;
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r * (0.6 + rng() * 0.5)) grid[y][x] = tile;
      }
  };
  const grassPatches = id === 'moss' ? 14 : id === 'cliff' ? 7 : 9;
  for (let i = 0; i < grassPatches; i++) blob(rint(3, MAP_W - 4, rng), rint(3, MAP_H - 4, rng), rint(2, 4, rng), T.GRASS);
  const rockPatches = id === 'cliff' ? 12 : id === 'temple' ? 6 : 4;
  for (let i = 0; i < rockPatches; i++) blob(rint(2, MAP_W - 3, rng), rint(2, MAP_H - 3, rng), rint(1, 3, rng), T.ROCK);
  if (id === 'moss') { blob(10, 8, 3, T.WATER); blob(28, 17, 2, T.WATER); }
  if (id === 'temple') for (let i = 0; i < 8; i++) grid[6 + (i % 4) * 5][8 + Math.floor(i / 4) * 20] = T.PILLAR;
  for (let i = 0; i < (id === 'moss' ? 26 : 12); i++) {
    const x = rint(1, MAP_W - 2, rng), y = rint(1, MAP_H - 2, rng);
    if (grid[y][x] === T.GROUND) grid[y][x] = T.FLOWER;
  }
  // walking path across the middle, and the zone exits punched into the border
  for (let x = 1; x < MAP_W - 1; x++) if (grid[13][x] === T.GRASS || grid[13][x] === T.FLOWER) grid[13][x] = T.PATH;
  if (id !== 'moss') grid[13][0] = T.EXIT_W;
  if (id !== 'temple') grid[13][MAP_W - 1] = T.EXIT_E;
  // keep spawn and boss tiles walkable
  grid[13][3] = T.PATH; grid[13][MAP_W - 4] = T.PATH;
  const boss = { moss: [20, 6], cliff: [24, 20], temple: [34, 13] }[id];
  grid[boss[1]][boss[0]] = T.BOSS;
  if (id === 'moss') grid[boss[1] + 1][boss[0]] = T.SPRING;
  return { grid, boss };
}

function zoneName(id) {
  return { moss: 'Moss Meadow', cliff: 'Cinder Bluff', temple: 'Gloom Shrine' }[id];
}

export class World {
  constructor() {
    this.zones = {};
    for (const id of ['moss', 'cliff', 'temple']) this.zones[id] = generateZone(id);
    this.zoneId = 'moss';
    this.px = 3; this.py = 13;
    this.steps = 0;
    this.items = [];            // hidden clickable sparkles {x,y,kind}
    this.moving = 0;            // seconds of step cooldown left
    this.bossDefeated = {};     // zoneId -> true once the mission is settled
    this.notice = null;         // transient banner text {text, t}
  }

  zone() { return this.zones[this.zoneId]; }
  tileAt(x, y) { const g = this.zone().grid; return g[y] && g[y][x] !== undefined ? g[y][x] : T.ROCK; }
  blocked(x, y) { return BLOCKING.has(this.tileAt(x, y)); }

  setNotice(text) { this.notice = { text, t: 2.6 }; }

  tryMove(dx, dy) {
    if (this.moving > 0) return;
    const nx = this.px + dx, ny = this.py + dy;
    const target = this.tileAt(nx, ny);
    if (target === T.EXIT_E) return this.changeZone(1);
    if (target === T.EXIT_W) return this.changeZone(-1);
    if (this.blocked(nx, ny)) return;
    this.px = nx; this.py = ny;
    this.moving = 0.13;
    this.steps += 1;
    this.onStep(target);
  }

  changeZone(dir) {
    const order = ['moss', 'cliff', 'temple'];
    const i = order.indexOf(this.zoneId) + dir;
    if (i < 0 || i >= order.length) return;
    this.zoneId = order[i];
    this.px = dir > 0 ? 3 : MAP_W - 4;
    this.py = 13;
    this.setNotice(zoneName(this.zoneId));
    this.spawnHiddenItem();
  }

  onStep(tile) {
    if (tile === T.BOSS) {
      const mission = MISSIONS.find((m) => m.zone === this.zoneId);
      if (mission && !this.bossDefeated[this.zoneId]) return { kind: 'boss', mission };
    }
    if (tile === T.GRASS) {
      if (roll(ENCOUNTER_CHANCE)) {
        const speciesId = pickWeighted(WILD_TABLES[this.zoneId]);
        const level = rint(2, 9, mulberry32(this.steps * 977 + this.px));
        return { kind: 'wild', speciesId, level };
      }
      if (roll(HIDDEN_ITEM_CHANCE)) this.spawnHiddenItem();
    }
    return null;
  }

  spawnHiddenItem() {
    if (this.items.length >= 4) return;
    const rng = mulberry32((this.steps + 1) * 613 + this.px * 31 + this.py * 7);
    for (let tries = 0; tries < 12; tries++) {
      const x = rint(2, MAP_W - 3, rng), y = rint(2, MAP_H - 3, rng);
      if (!this.blocked(x, y) && !(x === this.px && y === this.py)) {
        const kind = roll(0.55, rng) ? 'seedstone' : 'potion';
        this.items.push({ x, y, kind, bob: rng() * 6.28 });
        return;
      }
    }
  }

  // Mouse click on the field: collect a sparkle if it is visible and the ranger is close.
  clickAt(worldX, worldY, team) {
    const tx = Math.floor(worldX / TILE), ty = Math.floor(worldY / TILE);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.x === tx && it.y === ty) {
        const near = Math.max(Math.abs(it.x - this.px), Math.abs(it.y - this.py)) <= 3;
        if (!near) { this.setNotice('Too far — walk closer, then click the sparkle again.'); return null; }
        this.items.splice(i, 1);
        if (it.kind === 'seedstone') { team.seedstones += 2; this.setNotice('Found 2 Seedstones!'); }
        else { team.potions += 1; this.setNotice('Found a Mossdra Potion!'); }
        return { kind: 'pickup', item: it.kind };
      }
    }
    return null;
  }

  update(dt) {
    if (this.moving > 0) this.moving -= dt;
    if (this.notice) { this.notice.t -= dt; if (this.notice.t <= 0) this.notice = null; }
  }

  serialize() {
    return {
      zoneId: this.zoneId, px: this.px, py: this.py, steps: this.steps,
      items: this.items, bossDefeated: this.bossDefeated,
    };
  }

  static restore(data, world) {
    if (!data) return world;
    world.zoneId = data.zoneId ?? 'moss';
    world.px = data.px ?? 3; world.py = data.py ?? 13;
    world.steps = data.steps ?? 0;
    world.items = data.items ?? [];
    world.bossDefeated = data.bossDefeated ?? {};
    return world;
  }
}

export function wildSpeciesNames() { return Object.keys(SPECIES); }
