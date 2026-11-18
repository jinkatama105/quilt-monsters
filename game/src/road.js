// road.js — THE QUILT ROAD: node-map roguelite overworld (Stitchbound-style).
// Replaces free-walking field as the run shell: pick a glowing patch -> the
// node's event fires (showdown battle, rest, loot, peddler, boss). Map is
// seeded so it survives autosave/restore.
import { VIEW_W, VIEW_H } from './config.js?v=run6';
import { mulberry32, pickWeighted } from './random.js?v=run6';
import { WILD_TABLES, MISSIONS } from './data.js?v=run6';
import { panel, roundRect } from './hud.js?v=run6';

const COLS = 10, ROWS = 3;
const NODE_W = 84, NODE_H = 68;
const MAP_X = 150, MAP_Y = 210, MAP_W = 980, MAP_H = 420;
const SPOOLS_MAX = 5;

const TYPE_STYLE = {
  night:   { bg: '#5da85f', ic: '✦', desc: 'NIGHT — fight the pests; take a notion' },
  elite:   { bg: '#c04545', ic: '✖', desc: 'ELITE NIGHT — a Tribus waits; big notion' },
  tea:     { bg: '#4a9aa3', ic: '☕', desc: 'TEA & REST — the kettle mends the squad' },
  box:     { bg: '#e09a24', ic: '☐', desc: 'SEWING BOX — loot: thread and seedstones' },
  peddler: { bg: '#c975a4', ic: '◍', desc: 'PEDDLER — trade notions for seedstones' },
  mystery: { bg: '#7a93d6', ic: '?', desc: 'MYSTERY — a quiet stitch, who knows what it pulls' },
  boss:    { bg: '#8a55b0', ic: '♛', desc: 'BOSS — bind the Tribus of this stretch' },
};

export function zoneForCol(c) { return c < 4 ? 'moss' : c < 7 ? 'cliff' : 'temple'; }
export function roadMusic(road) { return zoneForCol(road.nodes[road.at[0]] ? road.nodes[road.at[0]].col : 0); }

export function makeRoad(seed) {
  const rng = mulberry32(seed >>> 0);
  const nodes = []; // {col,row,type,done,edges:[idx]}
  const idx = (c, r) => c * ROWS + r;
  const rollType = (c) => {
    const table = c === 0 ? [['night', 1]] : [
      ['night', 5], ['elite', c >= 2 ? 2 : 0.4], ['tea', 2], ['box', 1.5], ['peddler', 1.2], ['mystery', 1],
    ];
    return pickWeighted(table, rng);
  };
  for (let c = 0; c < COLS; c++) {
    const open = c === 0 ? [1] : c === COLS - 1 ? [1] : [0, 1, 2].filter(() => c < 2 || rng() < 0.75);
    const rows = c === 0 || c === COLS - 1 ? [1] : (open.length ? open : [1]);
    for (const r of rows) nodes[idx(c, r)] = { col: c, row: r, type: c === COLS - 1 ? 'boss' : rollType(c), done: false, edges: [] };
  }
  // stitch edges col -> col+1 (each node links to 1-2 open rows ahead)
  for (let c = 0; c < COLS - 1; c++) {
    for (let r = 0; r < ROWS; r++) {
      const n = nodes[idx(c, r)]; if (!n) continue;
      const ahead = [];
      for (let dr = -1; dr <= 1; dr++) {
        const m = nodes[idx(c + 1, r + dr)];
        if (m && (c + 1 !== COLS - 1 || r + dr === 1)) ahead.push(idx(c + 1, r + dr));
      }
      // guarantee reachability of the boss: middle row of col COLS-2 always links to it
      if (!ahead.length) { const m = nodes[idx(c + 1, 1)]; if (m) ahead.push(idx(c + 1, 1)); }
      n.edges = ahead.slice(0, 2);
    }
  }
  // ensure every col has >=1 node and boss reachable: if col c lost all rows (rare), force middle
  for (let c = 1; c < COLS; c++) if (!nodes[idx(c, 1)]) nodes[idx(c, 1)] = { col: c, row: 1, type: c === COLS - 1 ? 'boss' : 'night', done: false, edges: [] };
  // relink: any node with no edges to next col gets the middle of next col
  for (let c = 0; c < COLS - 1; c++) for (let r = 0; r < ROWS; r++) {
    const n = nodes[idx(c, r)]; if (!n) continue;
    n.edges = (n.edges || []).filter((e) => nodes[e]);
    if (!n.edges.length) n.edges = [idx(c + 1, 1)];
  }
  // plant the 3 Tribus bosses at cols 3 / 6 / 9 (elite-flavoured nodes on middle row where possible)
  const tribus = MISSIONS.map((m) => m.key);
  [3, 6].forEach((c, i) => { const n = nodes[idx(c, 1)] || nodes[idx(c, 0)]; if (n && n.type !== 'boss') { n.type = 'boss'; n.bossKey = tribus[i]; } });
  const finalBoss = nodes[idx(COLS - 1, 1)]; finalBoss.bossKey = tribus[2]; // nocturne
  return {
    seed: seed >>> 0, nodes, col: 0, at: [idx(0, 1)],
    spools: SPOOLS_MAX, notions: 0,
  };
}

export function roadFrontier(road) {
  const out = [];
  for (const i of road.at) for (const e of road.nodes[i].edges) if (!out.includes(e)) out.push(e);
  return out.sort((a, b) => road.nodes[a].row - road.nodes[b].row);
}

export function nodeRect(i, road) {
  const n = road.nodes[i];
  const x = MAP_X + 30 + n.col * ((MAP_W - 80) / (COLS - 1)) - NODE_W / 2;
  const y = MAP_Y + 40 + n.row * ((MAP_H - 110) / (ROWS - 1)) - NODE_H / 2;
  return { x, y, w: NODE_W, h: NODE_H };
}

// what entering a node triggers (main.js executes it)
export function roadEnter(road, nodeIdx) {
  const n = road.nodes[nodeIdx];
  const zone = zoneForCol(n.col);
  const lv = 3 + n.col * 2;
  if (n.type === 'night' || n.type === 'elite') {
    const species = pickWeighted(WILD_TABLES[zone]);
    return { kind: 'battle', nodeIdx, enemyId: n.type === 'elite' && n.bossKey ? n.bossKey : species, level: n.type === 'elite' ? lv + 3 : lv, elite: n.type === 'elite' };
  }
  if (n.type === 'boss') return { kind: 'battle', nodeIdx, enemyId: n.bossKey, level: 8 + n.col, elite: true, boss: true };
  return { kind: n.type, nodeIdx };
}

export function roadDone(road, nodeIdx, won) {
  const n = road.nodes[nodeIdx];
  if (won) {
    n.done = true; road.at = [nodeIdx];
    if (n.type === 'night') road.notions += 1;
    if (n.type === 'elite') road.notions += 2;
    if (n.type === 'boss') road.notions += 3;
    return n.type === 'boss' && n.bossKey === 'nocturne'; // true = run won
  }
  road.spools -= 1; // lost node stays on the frontier — retry burns a spool
  return false;
}

export function roadInstant(road, nodeIdx, team) {
  // non-battle nodes resolve immediately; returns a notice string
  const n = road.nodes[nodeIdx]; n.done = true; road.at = [nodeIdx];
  if (n.type === 'tea') { team.healPartyFull(); return 'Tea and a warm spring — the squad is fully mended.'; }
  if (n.type === 'box') { const st = 1 + (road.nodes[nodeIdx].col % 2); team.seedstones += st; if (road.spools < SPOOLS_MAX) road.spools += 1; return `Sewing box: +${st} seedstones, +1 thread spool.`; }
  if (n.type === 'peddler') {
    if (road.notions >= 2) { road.notions -= 2; team.seedstones += 3; team.potions += 1; return 'The peddler takes 2 notions: +3 seedstones, +1 potion.'; }
    return 'The peddler wants 2 notions. You hold none worth trading.';
  }
  if (n.type === 'mystery') {
    const r = mulberry32(road.seed ^ nodeIdx)();
    if (r < 0.4) { team.healPartyHalf(); return 'A hidden stitch of old thread — the squad rests (half heal).'; }
    if (r < 0.75) { road.notions += 1; return 'A notions-pouch drops from the lining: +1 notion.'; }
    const sp = pickWeighted(WILD_TABLES[zoneForCol(n.col)]); return { kind: 'battle', nodeIdx, enemyId: sp, level: 4 + n.col * 2, elite: false, ambush: true };
  }
  return '';
}

export function roadProgress(road) {
  const patches = road.nodes.filter((n) => n && n.done).length;
  return { patches, total: 10, spools: road.spools, spoolsMax: SPOOLS_MAX };
}

// --------------------------------------------------------------- drawing
export function drawRoad(ctx, state, t, mouse) {
  const road = state.road;
  // quilt backdrop: patched squares with dashed seams
  ctx.fillStyle = '#7a5c3e'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const patch = 64;
  for (let y = 0; y < VIEW_H; y += patch) for (let x = 0; x < VIEW_W; x += patch) {
    const h = ((x * 7 + y * 13 + road.seed) % 3);
    ctx.fillStyle = ['#8a4b52', '#93565c', '#7e4348'][h];
    ctx.fillRect(x, y, patch, patch);
    ctx.strokeStyle = 'rgba(255,240,220,.18)'; ctx.setLineDash([5, 6]); ctx.strokeRect(x + 2, y + 2, patch - 4, patch - 4); ctx.setLineDash([]);
  }
  // title strip
  ctx.textAlign = 'center'; ctx.fillStyle = '#c22f3f'; ctx.font = 'bold 30px Georgia';
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.strokeText('QUILTCODEX', 118, 44); ctx.fillText('QUILTCODEX', 118, 44);
  ctx.fillStyle = '#e8a020'; ctx.font = 'bold 30px Georgia';
  ctx.strokeStyle = '#3a2412'; ctx.strokeText('THE QUILT ROAD', VIEW_W / 2, 42); ctx.fillText('THE QUILT ROAD', VIEW_W / 2, 42);
  ctx.fillStyle = '#fff'; ctx.font = '15px Georgia'; ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 2;
  const zn = zoneForCol(road.at.length ? road.nodes[road.at[0]].col : 0);
  ctx.strokeText(`${zn === 'moss' ? 'Moss Meadow' : zn === 'cliff' ? 'Cinder Bluff' : 'Gloom Shrine'} · seed ${road.seed}`, VIEW_W / 2, 66);
  ctx.fillText(`${zn === 'moss' ? 'Moss Meadow' : zn === 'cliff' ? 'Cinder Bluff' : 'Gloom Shrine'} · seed ${road.seed}`, VIEW_W / 2, 66);
  ctx.textAlign = 'left';

  // map board
  panel(ctx, MAP_X - 20, MAP_Y - 26, MAP_W + 40, MAP_H + 52, 0.94);
  // edges (dashed seams)
  ctx.strokeStyle = '#8a7250'; ctx.lineWidth = 3; ctx.setLineDash([7, 6]);
  for (const n of road.nodes) if (n) {
    const a = nodeRect(road.nodes.indexOf(n), road);
    for (const e of n.edges) {
      const b = nodeRect(e, road);
      ctx.beginPath(); ctx.moveTo(a.x + a.w, a.y + a.h / 2); ctx.lineTo(b.x, b.y + b.h / 2); ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  // column numbers
  ctx.fillStyle = '#c8641e'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
  for (let c = 0; c < COLS; c++) { const r = nodeRect(c * ROWS + 1, road); ctx.fillText(String(c + 1), r.x + r.w / 2, MAP_Y - 4); }
  // frontier + hover
  const front = roadFrontier(road);
  let hovered = null;
  for (const i of road.nodes.map((n, k) => n ? k : -1).filter((k) => k >= 0)) {
    const n = road.nodes[i]; const r = nodeRect(i, road);
    const isFront = front.includes(i);
    if (isFront && mouse && mouse.x >= r.x && mouse.y >= r.y && mouse.x <= r.x + r.w && mouse.y <= r.y + r.h) hovered = i;
    ctx.globalAlpha = n.done ? 0.45 : 1;
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = TYPE_STYLE[n.type].bg; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#5a3d24'; ctx.stroke();
    if (isFront && !n.done) { ctx.save(); ctx.shadowColor = '#ffd23e'; ctx.shadowBlur = 18; ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 4; roundRect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 12); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = '#fff'; ctx.font = '22px monospace';
    ctx.fillText(TYPE_STYLE[n.type].ic, r.x + r.w / 2, r.y + 32);
    ctx.font = 'bold 11px monospace';
    ctx.fillText(n.type === 'boss' ? 'BOSS' : n.type[0].toUpperCase() + n.type.slice(1), r.x + r.w / 2, r.y + 54);
    if (isFront && !n.done) {
      const hot = front.indexOf(i) + 1;
      ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h + 14, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 13px monospace'; ctx.fillText(String(hot), r.x + r.w / 2, r.y + r.h + 18);
    }
    ctx.globalAlpha = 1;
  }
  // you-are-here marker
  for (const i of road.at) { const r = nodeRect(i, road); ctx.fillStyle = '#ffd23e'; ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y - 12, 5 + Math.sin(t * 5) * 1.5, 0, 7); ctx.fill(); }
  ctx.textAlign = 'left';

  // HUD: spools / notions / party
  panel(ctx, VIEW_W - 270, 14, 252, 118, 0.94);
  ctx.font = '16px Georgia';
  for (let s = 0; s < SPOOLS_MAX; s++) {
    ctx.globalAlpha = s < road.spools ? 1 : 0.22;
    ctx.fillStyle = '#a02838'; ctx.beginPath(); ctx.arc(VIEW_W - 248 + s * 30, 44, 11, 0, 7); ctx.fill();
    ctx.strokeStyle = '#5a3d24'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#e05565'; ctx.beginPath(); ctx.arc(VIEW_W - 248 + s * 30, 44, 4, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#5a3d24';
  ctx.fillText(`thread ${road.spools}/${SPOOLS_MAX}`, VIEW_W - 100, 50);
  ctx.fillText(`◔ ${road.notions} notions`, VIEW_W - 254 + 6, 78);
  const alive = state.team.party.filter((c) => c.hp > 0).map((c) => `${c.nickname} L${c.level}`).join(' · ');
  ctx.font = '13px monospace'; ctx.fillText(alive || 'squad rests…', VIEW_W - 254 + 6, 102);
  ctx.fillText(`[C] odex  [I] items`, VIEW_W - 254 + 6, 122);

  // WIN / LOSE contract bars
  const prog = roadProgress(road);
  panel(ctx, VIEW_W / 2 - 330, 84, 660, 86, 0.94);
  ctx.font = 'bold 16px Georgia';
  ctx.fillStyle = '#2e7d3a'; ctx.fillText(`WIN — stitch the road & bind Nocturne   ${prog.patches}/10`, VIEW_W / 2 - 312, 108);
  ctx.fillStyle = '#d9c39a'; ctx.fillRect(VIEW_W / 2 - 312, 116, 624, 9);
  ctx.fillStyle = '#4a7d4e'; ctx.fillRect(VIEW_W / 2 - 312, 116, 624 * Math.min(1, prog.patches / 10), 9);
  ctx.fillStyle = '#b3261e'; ctx.fillText(`LOSE — all ${SPOOLS_MAX} thread spools snap   ${road.spools} left`, VIEW_W / 2 - 312, 146);
  ctx.fillStyle = '#d9c39a'; ctx.fillRect(VIEW_W / 2 - 312, 152, 624, 9);
  ctx.fillStyle = '#b3261e'; ctx.fillRect(VIEW_W / 2 - 312, 152, 624 * (1 - road.spools / SPOOLS_MAX), 9);

  // banner: hovered node or first frontier
  const bi = hovered != null ? hovered : front[0];
  if (bi != null && road.nodes[bi]) {
    const n = road.nodes[bi];
    let desc = TYPE_STYLE[n.type].desc;
    if (n.type === 'boss' && n.bossKey) desc = `BOSS — ${MISSIONS.find((m) => m.key === n.bossKey).name}`;
    if (hovered == null) desc += ` · press ${front.indexOf(bi) + 1}`;
    ctx.font = 'bold 18px Georgia';
    const w = ctx.measureText(desc).width + 52;
    ctx.fillStyle = 'rgba(255,246,220,.95)'; roundRect(ctx, VIEW_W / 2 - w / 2, VIEW_H - 96, w, 40, 10); ctx.fill();
    ctx.strokeStyle = '#5b4636'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#3b2c17'; ctx.textAlign = 'center'; ctx.fillText(desc, VIEW_W / 2, VIEW_H - 70); ctx.textAlign = 'left';
  }
  // hint + legend
  ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 16px Georgia'; ctx.textAlign = 'center';
  ctx.fillText('Click a glowing patch, or press 1-3 to take that stitch', VIEW_W / 2, VIEW_H - 36);
  ctx.font = '12px monospace'; ctx.fillStyle = '#fff';
  let lx = VIEW_W / 2 - 330;
  for (const k of Object.keys(TYPE_STYLE)) {
    ctx.fillStyle = TYPE_STYLE[k].bg; ctx.fillRect(lx, VIEW_H - 22, 11, 11);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(lx, VIEW_H - 22, 11, 11);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(k[0].toUpperCase() + k.slice(1), lx + 15, VIEW_H - 12);
    lx += 15 + ctx.measureText(k[0].toUpperCase() + k.slice(1)).width + 18;
  }
  ctx.textAlign = 'left';
  return { front, hovered };
}
