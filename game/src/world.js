// world.js — the top-down exploration field built from the authored Ghibli maps:
// pre-rendered map PNGs + collision grids (mapdata.js) + warp seams from the
// world manifest. Zones: town, route, forest, cave, interior. Tall zones keep
// random encounters, invisible boss markers keep the three Tribus missions,
// NPCs block their tile and answer Enter.
import { TILE, ENCOUNTER_CHANCE, HIDDEN_ITEM_CHANCE, STEP_TIME } from './config.js?v=run2';
import { WILD_TABLES, MISSIONS } from './data.js?v=run2';
import { GRIDS } from './mapdata.js?v=run2';
import { mulberry32, pickWeighted, roll, rint } from './random.js?v=run2';

export { T } from './config.js?v=run2';

const ZDEF = {
  town:     { map: 'ghibli-map-town.png',      encounter: false, name: 'Verdant Town' },
  route:    { map: 'ghibli-map-route1.png',    encounter: true,  wild: 'moss',  name: 'Route 1' },
  forest:   { map: 'ghibli-map-forest.png',    encounter: true,  wild: 'moss',  name: 'Whisper Forest' },
  cave:     { map: 'ghibli-map-cave.png',      encounter: true,  wild: 'cliff', name: 'Cinder Cave' },
  interior: { map: 'ghibli-map-interior.png', encounter: false, name: 'Home' },
};
export const MAPS = ZDEF;   // render.js reads .map per zone

// two-way seams (world_manifest warps): [from zone, tx, ty, to zone, px, py]
const WARP_LIST = [
  ['town', 14, 19, 'route', 14, 1],   ['town', 15, 19, 'route', 15, 1],
  ['route', 14, 0, 'town', 14, 18],   ['route', 15, 0, 'town', 15, 18],
  ['route', 28, 14, 'forest', 1, 14], ['route', 29, 14, 'forest', 1, 15],
  ['forest', 0, 14, 'route', 28, 13], ['forest', 0, 15, 'route', 29, 13],
  ['forest', 28, 14, 'cave', 1, 14],  ['forest', 29, 14, 'cave', 1, 15],
  ['cave', 0, 14, 'forest', 27, 14],  ['cave', 0, 15, 'forest', 27, 15],
  ['cave', 24, 14, 'forest', 27, 14], ['cave', 24, 15, 'forest', 27, 15],
  ['interior', 7, 11, 'town', 5, 7],  ['interior', 8, 11, 'town', 5, 7],
];

// interact doors: blocked tiles that warp (to) or say something (locked)
const DOORS = {
  town: [
    { x: 5, y: 6, to: 'interior', px: 7, py: 10, label: 'You step inside your house.' },
    { x: 24, y: 6, locked: 'The lab is locked for now.' },
    { x: 15, y: 15, locked: 'Closed up tight. Talk to the shopkeeper outside.' },
  ],
};

// shortcut: boss/heal markers hand-placed on walkable grass; re-check coords
// against the collision grids if the maps are ever re-drawn.
const MARKERS = {
  forest: { boss: [27, 6], mission: 'gelundra', heal: [4, 19] },
  cave:   { boss: [23, 20], mission: 'magmoth' },
  interior: { heal: [3, 3] },
};
const EXTRA_BOSS = { cave: { x: 20, y: 4, mission: 'nocturne' } };

export const NPCS = {
  town: [
    { id: 'villager_male',   x: 5, y: 7, sheet: 'villager_male_128x256.png',   lines: ['Beautiful morning in town, eh?', 'The tall grass on Route 1 is crawling with critters.'] },
    { id: 'villager_female', x: 24, y: 7, sheet: 'villager_female_128x256.png', lines: ['The healer keeps a spring in the forest — your team will thank you.', 'Careful near the cave mouth.'] },
    { id: 'kid',             x: 20, y: 9, sheet: 'kid_128x256.png',             lines: ["One day I'll catch a Voltip!", 'You look like a real ranger!'] },
    { id: 'shopkeeper',      x: 13, y: 16, sheet: 'shopkeeper_128x256.png', shop: true, lines: ['Welcome! A potion for 2 Seedstones.', 'Come again!'] },
    { id: 'rival',           x: 9, y: 9, sheet: 'rival_128x256.png',         lines: ['Heh. Still walking around on foot?', 'The cave is no place for a rookie.'] },
    { id: 'officer',         x: 14, y: 16, sheet: 'officer_128x256.png',        lines: ['Stick to the path near the exits, kid.'] },
  ],
  route: [
    { id: 'lab_assistant', x: 18, y: 2, sheet: 'lab_assistant_128x256.png', lines: ['Weaken wild creatures first, then throw a Seedstone.', 'Tall grass hides sparkles too — click them!'] },
  ],
  cave: [
    { id: 'gym_leader', x: 22, y: 22, sheet: 'gym_leader_128x256.png', lines: ['Magmoth guards this depth. Show me your resolve.', 'Hmph. The Bluff remembers you.'] },
  ],
};

export const PLAYER_SHEET = 'player_boy_128x256.png';

// walk-sheet frames are 32px logical (384x1024 file, 12x4): dir row, frame column
export function drawSheet(ctx, file, dir, frame, cx, groundY, height, flipX = false) {
  const img = image(file);
  if (!img || !img.naturalWidth) return false;
  // cell size from filename (<w>x<h>); Muse sheets are 4x4 of 128x256 => 384x1024
  const m = file.match(/(\d+)x(\d+)\.png/);
  const fw = m ? +m[1] : img.naturalWidth / 12, fh = m ? +m[2] : img.naturalHeight / 4;
  const w = height * (fw / fh);
  ctx.save();
  ctx.translate(cx, groundY);
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(img, Math.round(frame * fw), dir * fh, fw, fh, -w / 2, -height, w, height);
  ctx.restore();
  return true;
}

const imgCache = {};
export function image(file) {
  if (imgCache[file] !== undefined) return imgCache[file];
  const img = new Image();
  img.onerror = () => { imgCache[file] = false; };
  img.src = `assets/world/${file}`;
  imgCache[file] = img;
  return img;
}

export class World {
  constructor() {
    this.grids = {};
    for (const z of Object.keys(ZDEF)) this.grids[z] = GRIDS[z].map(r => r.slice());
    for (const [z, list] of Object.entries(DOORS))
      for (const d of list) this.grids[z][d.y][d.x] = 1;
    for (const [z, list] of Object.entries(NPCS))
      for (const n of list) this.grids[z][n.y][n.x] = 1;
    this.warps = {};
    for (const w of WARP_LIST) this.warps[`${w[0]},${w[1]},${w[2]}`] = { zone: w[3], px: w[4], py: w[5] };
    this.zoneId = 'town';
    this.px = 7; this.py = 18;
    this.dir = 0; this.animT = 0;
    this.steps = 0;
    this.items = [];
    this.moving = 0;
    this.warpCd = 0;
    this.bossDefeated = {};
    this.notice = null;
  }

  dims(zone = this.zoneId) { const g = this.grids[zone]; return { w: g[0].length, h: g.length }; }
  tileAt(x, y, zone = this.zoneId) { const g = this.grids[zone]; return (g[y] && g[y][x] !== undefined) ? g[y][x] : 1; }
  blocked(x, y) { return this.tileAt(x, y) === 1; }
  setNotice(text) { this.notice = { text, t: 3.2 }; }
  doorAt(x, y) { return (DOORS[this.zoneId] || []).find(d => d.x === x && d.y === y); }
  npcAt(x, y) { return (NPCS[this.zoneId] || []).find(n => n.x === x && n.y === y); }

  tryMove(dx, dy) {
    if (this.moving > 0) return null;
    this.dir = dy > 0 ? 0 : dy < 0 ? 1 : dx < 0 ? 2 : 3;
    const nx = this.px + dx, ny = this.py + dy;
    const wp = this.warps[`${this.zoneId},${nx},${ny}`];
    if (wp && this.warpCd <= 0) { this.warpTo(wp); return null; }
    if (this.blocked(nx, ny)) return null;
    this.fromPx = this.px; this.fromPy = this.py;   // interpolation anchor for smooth steps
    this.px = nx; this.py = ny;
    this.moving = STEP_TIME;
    this.steps += 1;
    return this.onStep();
  }

  warpTo(wp) {
    this.zoneId = wp.zone; this.px = wp.px; this.py = wp.py;
    this.fromPx = wp.px; this.fromPy = wp.py;
    this.moving = 0;
    this.warpCd = 0.4;
    this.items = [];
    this.setNotice(ZDEF[wp.zone].name);
  }

  interact() {
    const facing = [[0, 1], [0, -1], [-1, 0], [1, 0]][this.dir];
    for (const [dx, dy] of [facing, [0, 0]]) {
      const x = this.px + dx, y = this.py + dy;
      const npc = this.npcAt(x, y);
      if (npc) return { kind: 'talk', npc };
      const door = this.doorAt(x, y);
      if (door) {
        if (door.to) { this.warpTo({ zone: door.to, px: door.px, py: door.py }); this.setNotice(door.label); }
        else this.setNotice(door.locked);
        return null;
      }
    }
    return null;
  }

  onStep() {
    const m = MARKERS[this.zoneId];
    if (m && m.boss && m.boss[0] === this.px && m.boss[1] === this.py) {
      const mission = MISSIONS.find(mi => mi.key === m.mission);
      if (mission && !this.bossDefeated[mission.zone]) return { kind: 'boss', mission };
    }
    const ex = EXTRA_BOSS[this.zoneId];
    if (ex && ex.x === this.px && ex.y === this.py) {
      const mission = MISSIONS.find(mi => mi.key === ex.mission);
      if (mission && !this.bossDefeated[mission.zone]) return { kind: 'boss', mission };
    }
    if (m && m.heal && m.heal[0] === this.px && m.heal[1] === this.py) return { kind: 'heal' };
    const z = ZDEF[this.zoneId];
    if (z.encounter) {
      if (roll(ENCOUNTER_CHANCE)) {
        const speciesId = pickWeighted(WILD_TABLES[z.wild]);
        const level = rint(2, 12, mulberry32(this.steps * 977 + this.px));
        return { kind: 'wild', speciesId, level };
      }
      if (roll(HIDDEN_ITEM_CHANCE)) this.spawnHiddenItem();
    }
    return null;
  }

  spawnHiddenItem() {
    if (this.items.length >= 4) return;
    const rng = mulberry32((this.steps + 1) * 613 + this.px * 31 + this.py * 7);
    const { w, h } = this.dims();
    for (let tries = 0; tries < 12; tries++) {
      const x = rint(1, w - 2, rng), y = rint(1, h - 2, rng);
      if (!this.blocked(x, y) && !(x === this.px && y === this.py)) {
        const kind = roll(0.55, rng) ? 'seedstone' : 'potion';
        this.items.push({ x, y, kind, bob: rng() * 6.28 });
        return;
      }
    }
  }

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
    if (this.fromPx === undefined) { this.fromPx = this.px; this.fromPy = this.py; }
    if (this.warpCd > 0) this.warpCd -= dt;
    this.animT += dt;
    if (this.notice) { this.notice.t -= dt; if (this.notice.t <= 0) this.notice = null; }
  }

  serialize() {
    return {
      zoneId: this.zoneId, px: this.px, py: this.py, dir: this.dir, steps: this.steps,
      items: this.items, bossDefeated: this.bossDefeated,
    };
  }

  static restore(data, world) {
    if (!data) return world;
    world.zoneId = ZDEF[data.zoneId] ? data.zoneId : 'town';
    world.px = data.px ?? 7; world.py = data.py ?? 18;
    world.dir = data.dir ?? 0;
    world.steps = data.steps ?? 0;
    world.items = Array.isArray(data.items) ? data.items.filter(it => !world.blocked(it.x, it.y)) : [];
    world.bossDefeated = data.bossDefeated ?? {};
    return world;
  }
}
