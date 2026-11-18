// run.js — THE QUILT SHOWDOWN: Batomon-style day loop (roguelike auto-battler)
// sitting on top of the existing showdown engine. Layer:
//   title -> trainer select -> DAY loop [ shop -> battle(auto) -> rewards ] ->
//   hearts 0 = run over; win Day 10 = champion -> endless.
// Data contract: game/data/trainers|shop|trinkets.json (Manus). Built-in tables
// below are the fallback so the loop ships before the JSON lands.
import { VIEW_W, VIEW_H, ELEMENT_COLORS } from './config.js?v=run4';
import { SPECIES, SPECIES_LIST, abilityForSpecies } from './data.js?v=run4';
import { mulberry32, rint } from './random.js?v=run4';
import { panel, roundRect, drawSlice } from './hud.js?v=run4';
import { drawCreature } from './art.js?v=run4';
import { makeCreature } from './team.js?v=run4';

// ------------------------------------------------------------------ data
export const BUILTIN_TRAINERS = [
  { id: 'ranger', name: 'Moss Ranger', element: 'Verdant',
    passive: { on: 'victory', effect: { type: 'shield', amount: 6, target: 'grass', permanent: true } },
    text: 'On Victory: Verdant allies gain +6 Shield (permanent).' },
  { id: 'sparker', name: 'Volt Sparker', element: 'Volt',
    passive: { on: 'victory', effect: { type: 'spd', amount: 1, target: 'electric', permanent: true } },
    text: 'On Victory: Volt allies gain +1 Speed (permanent).' },
  { id: 'cinder', name: 'Cinder Kid', element: 'Ember',
    passive: { on: 'victory', effect: { type: 'burn', amount: 3, target: 'fire', permanent: true } },
    text: 'On Victory: Ember allies gain +3 Burn (permanent).' },
];

export const BUILTIN_SHOP = [
  { species: 'embercub', cost: 8 }, { species: 'leaflet', cost: 8 }, { species: 'voltip', cost: 8 },
  { species: 'tidepup', cost: 8 }, { species: 'gloomling', cost: 10 }, { species: 'mossbeak', cost: 10 },
  { species: 'sparklet', cost: 10 }, { species: 'peblite', cost: 12 }, { species: 'stormpup', cost: 12 },
  { species: 'frostcap', cost: 14 }, { species: 'cindermot', cost: 14 }, { species: 'gloomcap', cost: 16 },
];

export const BUILTIN_TRINKETS = [
  { id: 'fools_gold', name: "Fool's Gold", text: '+$6 income each Day; shop stops stocking items.', effect: { type: 'income', value: 6 } },
  { id: 'arcade_coins', name: 'Arcade Coins', text: 'Your first 2 rerolls each Day are free.', effect: { type: 'reroll_free', value: 2 } },
  { id: 'speed_crest', name: 'Speed Crest', text: 'Right-hand monsters act 15% faster.', effect: { type: 'column_spd', value: 0.15 } },
  { id: 'thimble', name: 'Iron Thimble', text: '+1 Shield stack to your front monster at battle start.', effect: { type: 'shield', value: 4 } },
  { id: 'ember_thread', name: 'Ember Thread', text: 'Ember hits leave a burn tick (+2 dmg per turn).', effect: { type: 'burn_on_cast', value: 2 } },
  { id: 'double_needle', name: 'Double Needle', text: 'One random ally multicasts its next strike.', effect: { type: 'multicast', value: 1 } },
];

// ------------------------------------------------------------------ run state
/** Fresh run. seed = deterministic across save/restore. */
export function makeRun(seed, trainerId = null) {
  const rng = mulberry32(seed >>> 0);
  return {
    seed: seed >>> 0, rng,
    trainerId,                       // null = trainer-select pending
    day: 1, hearts: 10, coins: 20, rank: 'Rookie',
    board: [],                       // up to 6 creatures (order = position)
    trinkets: [],                    // owned {…}
    locked: false, shop: [],         // shop offers this Day
    phase: 'trainer',                // trainer | shop | battle | reward | champion | over
    reward: null,                    // pending reward payload after a win
    streak: 0, bestDay: 1,
    champion: false, endless: false,
  };
}

// Manus #331: effect types that need >= 1 monster on the board to do anything.
// Engine types (applyItem) + the JSON-side aliases from Hermes #314.
// reroll_free_once (Voucher) is deliberately NOT here — it works on an empty board.
const BOARD_TARGETED_EFFECTS = new Set([
  'heal_board', 'buff', 'damage_next', 'shield', 'element2', 'shield_next',
  'damage_random', 'add_element',
]);
const needsBoardTarget = (offer) => offer && offer.kind === 'item'
  && BOARD_TARGETED_EFFECTS.has((offer.effect || {}).type);

const shopFor = (run) => {
  const rng = run.rng;
  const items = [];
  const foolGold = run.trinkets.some((t) => t.id === 'fools_gold');
  // Fool's Gold: shop stops stocking items entirely (pool filtered to monsters).
  // Manus #331: board-targeted items are never offered while the board is empty —
  // buying one then is a wasted purchase (applyItem no-ops with no target).
  const base = foolGold ? BUILTIN_SHOP.filter((s) => s.kind !== 'item') : BUILTIN_SHOP;
  const filtered = run.board.length ? base : base.filter((s) => !needsBoardTarget(s));
  const pool = filtered.length ? filtered : base; // never crash on an empty pool
  for (let i = 0; i < 4; i++) {
    const s = pool[Math.floor(rng() * pool.length)];
    if (s.kind === 'item') { items.push({ ...s }); continue; }
    items.push({ species: s.species, cost: s.cost, lvl: 1 + Math.floor(run.day / 4) });
  }
  return items;
};

export function rollShop(run) { run.shop = shopFor(run); }

/** Income at Day start: base + trinket income + streak bonus. */
export function dayIncome(run) {
  const t = run.trinkets.reduce((a, x) => a + (x.effect.type === 'income' ? x.effect.value : 0), 0);
  return 8 + Math.floor(run.day / 2) + t + Math.min(6, run.streak * 2);
}

export function freeRerolls(run) {
  return run.trinkets.reduce((a, x) => a + (x.effect.type === 'reroll_free' ? x.effect.value : 0), 0);
}

/** Buy shop slot i (monster -> board w/ auto-merge; item -> instant effect). Error string or null. */
export function buy(run, i) {
  const offer = run.shop[i]; if (!offer) return 'empty slot';
  if (run.coins < offer.cost) return 'not enough coins';
  if (needsBoardTarget(offer) && !run.board.length) return 'needs a monster on the board'; // Manus #331: belt-and-braces (board emptied after the shop was generated)
  if (offer.kind === 'item') {
    run.coins -= offer.cost;
    run.shop[i] = null;
    applyItem(run, offer);
    return null;
  }
  if (run.board.length >= 6) return 'board full (6)';
  run.coins -= offer.cost;
  run.shop[i] = null;
  const c = makeCreature(offer.species, offer.lvl);
  c.stars = 1; c.cost = offer.cost;
  run.board.push(c);
  autoMerge(run);
  return null;
}

/** Item effects (shop.json kind:'item'). Engine types:
 *  heal_board {value}                         +HP all board
 *  buff {stat|mods[], value, target:all|lowest|leftmost|random}  permanent run stats (mods = list of {stat,value} for two-stat items)
 *  damage_next {value, count}                 +flat damage per hit, N random board monsters, next battle only
 *  shield {value}                             +shield stacks (absorb dmg in battle), leftmost
 *  element2 {element}                         grant a second element (rainbow berry)
 *  reroll_free_once                           next reroll is free (voucher)
 *  Unknown type = cosmetic, still consumable. */
function applyItem(run, offer) {
  const e = offer.effect || {};
  const pickRandom = (n) => run.board.slice().sort(() => run.rng() - 0.5).slice(0, n);
  if (e.type === 'heal_board') {
    run.board.forEach((c) => { c.hp = Math.min(c.stats.hp, c.hp + (e.value || 10)); });
  } else if (e.type === 'buff') {
    const mods = Array.isArray(e.mods) ? e.mods : [{ stat: e.stat || 'atk', value: e.value || 1 }];
    let targets = run.board;
    if (e.target === 'lowest') targets = [run.board.slice().sort((a, b) => a.stats[(mods[0] || {}).stat || 'atk'] - b.stats[(mods[0] || {}).stat || 'atk'])[0]].filter(Boolean);
    if (e.target === 'leftmost') targets = run.board.length ? [run.board[0]] : [];
    if (e.target === 'random') targets = pickRandom(1);
    targets.forEach((c) => {
      for (const m of mods) {
        c.stats[m.stat] = (c.stats[m.stat] || 0) + (m.value || 0);
        if (m.stat === 'hp') { c.maxHp = c.stats.hp; c.hp = c.stats.hp; }
      }
    });
  } else if (e.type === 'damage_next') {
    pickRandom(e.count || 2).forEach((c) => { c.tempDmg = (c.tempDmg || 0) + (e.value || 5); });
  } else if (e.type === 'shield') {
    if (run.board.length) run.board[0].shield = (run.board[0].shield || 0) + (e.value || 2);
  } else if (e.type === 'element2') {
    const els = ['Ember', 'Verdant', 'Volt', 'Tide', 'Gloom'];
    if (run.board.length) {
      const c = pickRandom(1)[0];
      const pool = els.filter((x) => x !== SPECIES[c.species].element); // never same as current element
      c.element2 = e.element || pool[Math.floor(run.rng() * pool.length)];
    }
  } else if (e.type === 'reroll_free_once') {
    run.voucher = (run.voucher || 0) + 1;
  } else if (e.type === 'shield_next') {
    run.itemShield = (run.itemShield || 0) + (e.value || 4); // consumed at battle start in startRunBattle
  }
}

/** Sell board slot i for half cost. */
export function sell(run, i) {
  const c = run.board[i]; if (!c) return 'nothing there';
  run.coins += Math.max(1, Math.floor((c.cost || 10) / 2));
  run.board.splice(i, 1);
  return null;
}

/** Merge rule: 3 copies of the same species -> 1 at stars+1 (+trinket choice at Lv2). */
export function autoMerge(run) {
  const by = {};
  run.board.forEach((c, i) => { (by[c.species] = by[c.species] || []).push(i); });
  for (const id in by) {
    const idxs = by[id].filter((i) => (run.board[i].stars || 1) < 3);
    if (idxs.length >= 3) {
      const keep = run.board[idxs[0]];
      keep.stars = (keep.stars || 1) + 1;
      keep.nickname = `${SPECIES[id].name} ${'★★★'.slice(0, keep.stars)}`;
      boostStats(keep, keep.stars);
      for (const j of idxs.slice(1, 3).reverse()) run.board.splice(j, 1);
      if (keep.stars === 2) run.mergeTrinketPending = true;  // SAP rule: merge earns a trinket
      return true;
    }
  }
  return false;
}

function boostStats(c, stars) {
  const m = stars === 2 ? 1.5 : 2.25;
  c.stats.hp = Math.round(c.stats.hp * m / (stars === 2 ? 1.5 / 1.5 : 1)) || c.stats.hp;
  // simplest honest approach: rebuild from base then scale
  const base = makeCreature(c.species, c.level);
  c.stats = base.stats; c.stats.hp = Math.round(base.stats.hp * m);
  c.stats.atk = Math.round(base.stats.atk * m); c.stats.def = Math.round(base.stats.def * m);
  c.maxHp = c.stats.hp; c.hp = c.stats.hp;
}

/** Move a board monster left/right; column effects (Speed Crest) resolve in battle. */
export function moveOn(run, from, to) {
  const c = run.board[from]; if (!c || to < 0 || to >= run.board.length) return;
  run.board.splice(from, 1); run.board.splice(to, 0, c);
}

/** Pick a trinket from the current 3-choice list (reward or merge). */
export function pickTrinket(run, i) {
  const list = run.reward?.trinkets || run.mergeTrinkets || [];
  const t = list[i]; if (!t) return;
  run.trinkets.push({ ...t });
  run.mergeTrinkets = null; run.mergeTrinketPending = false;
  if (run.reward) run.reward.trinketChosen = true;
}

// -------------------------------------------------------------- opponent
/** Async = stat snapshot: build a deterministic enemy squad from seed+Day.
 *  Once opponents.json lands (real player snapshots), pickOpponent swaps in. */
export function makeOpponent(run) {
  const rng = mulberry32((run.seed ^ (run.day * 7919)) >>> 0);
  const n = Math.min(6, 2 + Math.ceil(run.day / 2));
  const lvl = 1 + Math.floor(run.day / 3) + rint(0, 1, rng);
  const squad = [];
  for (let i = 0; i < n; i++) {
    const s = BUILTIN_SHOP[Math.floor(rng() * BUILTIN_SHOP.length)];
    const c = makeCreature(s.species, lvl);
    c.stars = rng() < run.day / 22 ? 2 : 1;
    if (c.stars === 2) boostStats(c, 2);
    c.ability = abilityForSpecies(SPECIES[s.species]);
    squad.push(c);
  }
  return { name: ['Quiet Quilter', 'Patchwork Pip', 'Spool Sergeant', 'Thimble Tyrant', 'Basting Bandit', 'Seam Sentry', 'Running-Stitch Rhea', 'Needle Nick', 'Purl Punisher', 'Hemline Hazel'][Math.floor(rng() * 10)], squad };
}

/** Snapshot the player board as an async opponent template (what a real SAP stores). */
export function runSnapshot(run) {
  return { trainerId: run.trainerId, day: run.day, bestDay: run.bestDay, rank: run.rank,
    board: run.board.map((c) => ({ species: c.species, level: c.level, stars: c.stars || 1 })),
    trinkets: run.trinkets.map((t) => t.id) };
}

// -------------------------------------------------------------- trainer passive
/** Fire the trainer passive. on:'victory' runs after a won battle; on:'battleStart' before each battle. Mutates board.
 *  v3: effect.target may be an ELEMENT NAME (Ember/Verdant/Volt/Tide/Gloom, any case),
 *  a legacy lowercase element key (fire/grass/electric/water/ghost), or a board
 *  position (leftmost/rightmost/all). Before v3 only the lowercase keys matched, so
 *  target:'Ember' silently fell through to the WHOLE board (every monster got the
 *  buff) and target:'leftmost' did the same — Bimo would have multicasted everyone. */
export function applyPassive(run, won, when = 'victory') {
  const tr = TRAINERS_BY_ID[run.trainerId]; if (!tr) return null;
  const p = tr.passive; if (!p || p.on !== when) return null;
  if (when === 'victory' && !won) return null;
  const e = p.effect;
  const t = String(e.target || '').toLowerCase();
  const elemMatch = { ember: 'Ember', verdant: 'Verdant', volt: 'Volt', tide: 'Tide', gloom: 'Gloom',
    fire: 'Ember', grass: 'Verdant', electric: 'Volt', water: 'Tide', ghost: 'Gloom' }[t];
  let targets = run.board;
  if (elemMatch) targets = run.board.filter((c) => { const sp = SPECIES[c.species]; return sp && sp.element === elemMatch; });
  else if (t === 'leftmost') targets = run.board.length ? [run.board[0]] : [];
  else if (t === 'rightmost') targets = run.board.length ? [run.board[run.board.length - 1]] : [];
  // 'all' or anything unrecognised: whole board (previous behaviour).
  let hits = 0;
  for (const c of targets) {
    if (e.type === 'atk') c.stats.atk += e.amount;
    else if (e.type === 'spd') c.stats.spd += e.amount;
    else if (e.type === 'shield') c.shield = (c.shield || 0) + e.amount;
    else if (e.type === 'burn') c.bonusBurn = (c.bonusBurn || 0) + e.amount;
    else if (e.type === 'extra_cast') c.multicast = (c.multicast || 0) + (e.amount || 1); // showdown strike() double-hits and consumes
    hits++;
  }
  return hits ? `${tr.name}: ${hits} ${hits > 1 ? 'allies' : 'ally'} boosted` : null;
}

// live trainer table = JSON overlay (when data/trainers.json ships) merged over built-ins
const ELEMENT_DEFAULT_MOVE = { Ember: 'emberDart', Verdant: 'leafLash', Volt: 'sparkJolt', Tide: 'bubbleFlick', Gloom: 'gloomSpore' };
export let TRAINERS_BY_ID = Object.fromEntries(BUILTIN_TRAINERS.map((t) => [t.id, t]));
export async function loadData() {
  try {
    const [tr, sh, tk, mn] = await Promise.all([
      fetch('data/trainers.json').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('data/shop.json').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('data/trinkets.json').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('data/monsters.json').then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    if (Array.isArray(mn) && mn.length) {
      // merge/override species rows into SPECIES (keeps art/moves fallbacks for unknown art)
      for (const m of mn) {
        if (!m || !m.id) continue;
        SPECIES[m.id] = {
          id: m.id, name: m.name || m.id, element: m.element || 'Gloom',
          desc: m.desc || '', base: m.base || { hp: 24, atk: 8, def: 6, spd: 7 },
          xpYield: m.xpYield || 30, rarity: m.rarity || 2,
          ability: m.ability || undefined,
          learn: Array.isArray(m.learn) && m.learn.length ? m.learn : [{ lv: 1, move: (ELEMENT_DEFAULT_MOVE[m.element] || 'gloomSpore') }],
        };
        if (Array.isArray(SPECIES_LIST) && !SPECIES_LIST.includes(m.id)) SPECIES_LIST.push(m.id);
      }
    }
    if (Array.isArray(tr) && tr.length) { BUILTIN_TRAINERS.length = 0; BUILTIN_TRAINERS.push(...tr); TRAINERS_BY_ID = Object.fromEntries(tr.map((t) => [t.id, t])); }
    if (Array.isArray(sh) && sh.length) { BUILTIN_SHOP.length = 0; BUILTIN_SHOP.push(...sh); }
    if (Array.isArray(tk) && tk.length) { BUILTIN_TRINKETS.length = 0; BUILTIN_TRINKETS.push(...tk); }
    return true;
  } catch { return false; }
}

export function chooseTrainer(run, id) { run.trainerId = id; run.phase = 'shop'; run.coins = 20; rollShop(run); }

// ------------------------------------------------------------- reward step
/** After a won battle: income + trinket choice (every win) staged into run.reward. */
export function stageReward(run, won) {
  if (won) {
    run.streak += 1;
    const gain = 4 + Math.min(6, run.streak * 2);  // daily income itself pays out at Day start
    run.coins += gain;
    const rng = run.rng;
    const opts = [];
    const pool = BUILTIN_TRINKETS.filter((t) => !run.trinkets.some((o) => o.id === t.id));
    while (opts.length < 3 && pool.length) opts.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    run.reward = { gain, trinkets: opts, trinketChosen: false };
  } else {
    run.streak = 0;
    run.hearts -= 1;
    run.reward = { gain: 4, trinkets: [], trinketChosen: true };
  }
  run.phase = 'reward';
}

/** Confirm reward -> advance Day (or end). */
export function nextDay(run) {
  const endlessChampion = run.champion;
  run.reward = null;
  if (run.hearts <= 0) { run.phase = 'over'; return; }
  if (run.day >= 10 && !run.champion) {
    run.champion = true; run.rank = 'Quilt Champion';
    run.phase = 'champion'; return;
  }
  run.day += 1; run.bestDay = Math.max(run.bestDay, run.day);
  if (run.day > 10) run.endless = true;
  run.locked = false;
  run._freeUsed = 0; // arcade_coins free rerolls reset each Day
  if (!run.locked || !run.shop.some(Boolean)) rollShop(run);
  run.coins += dayIncome(run);
  run.phase = 'shop';
}

// -------------------------------------------------------------- persistence
export function serializeRun(run) {
  return { seed: run.seed, trainerId: run.trainerId, day: run.day, hearts: run.hearts, coins: run.coins,
    rank: run.rank, board: run.board, trinkets: run.trinkets, locked: run.locked, shop: run.shop,
    streak: run.streak, bestDay: run.bestDay, champion: run.champion, endless: run.endless,
    phase: run.phase === 'battle' ? 'shop' : run.phase };
}
export function restoreRun(data) {
  const run = makeRun(data.seed);
  Object.assign(run, data);
  run.rng = mulberry32((data.seed ^ (data.day * 2654435761)) >>> 0);
  if (data.trinkets) run.trinkets = data.trinkets;
  return run;
}

// ============================================================== drawing ===
const EL_COLOR = (id) => ELEMENT_COLORS[SPECIES[id]?.element] || '#9fd8c8';
const heartsRow = (ctx, x, y, run) => {
  for (let i = 0; i < 10; i++) {
    ctx.font = '20px monospace'; ctx.fillStyle = i < run.hearts ? '#ff6a7a' : 'rgba(91,70,54,.20)';
    ctx.fillText('♥', x + i * 24, y);
  }
};

export function drawRun(ctx, run, t, mouse) {
  panel(ctx, 0, 0, VIEW_W, VIEW_H, 0.88);
  ctx.textAlign = 'left';
  // top bar: day / hearts / coins / rank
  drawSlice(ctx, 'day_banner', 14, 12, 150, 44, 14, 0.9);
  ctx.font = 'bold 26px monospace'; ctx.fillStyle = '#3b2c17';
  ctx.fillText(`DAY ${run.day}${run.endless ? ' ∞' : ''}`, 24, 44);
  heartsRow(ctx, 190, 44, run);
  drawSlice(ctx, 'coin_icon', VIEW_W - 196, 24, 22, 22, 6, 1);
  ctx.font = 'bold 22px monospace'; ctx.fillStyle = '#3b2c17';
  ctx.fillText(`⬤ ${run.coins}`, VIEW_W - 170, 44);
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#3b2c17'; // v3: was 14px #6d5b3c, unreadable on sage
  ctx.fillText(run.rank, 24, 68);

  if (run.phase === 'trainer') return drawTrainerSelect(ctx, run, t, mouse);
  if (run.phase === 'shop') return drawShop(ctx, run, t, mouse);
  if (run.phase === 'reward') return drawReward(ctx, run, t, mouse);
  if (run.phase === 'champion') return drawChampion(ctx, run, t, mouse);
  if (run.phase === 'over') return drawOver(ctx, run, t, mouse);
}

function button(ctx, b, label, hot, sub) {
  if (!drawSlice(ctx, 'shop_button', b.x, b.y, b.w, Math.max(48, b.h), 18, hot ? 1 : 0.9)) {
    ctx.fillStyle = hot ? 'rgba(255,201,60,.35)' : 'rgba(255,201,60,.10)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill();
    ctx.strokeStyle = hot ? '#d99a16' : '#5b4636'; ctx.lineWidth = hot ? 3 : 2; ctx.stroke();
  }
  ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center';
  ctx.fillText(label, b.x + b.w / 2, b.y + (sub ? 26 : b.h / 2 + 6));
  if (sub) { ctx.font = '12px monospace'; ctx.fillStyle = '#6d5b3c'; ctx.fillText(sub, b.x + b.w / 2, b.y + 48); }
  ctx.textAlign = 'left';
}

function drawTrainerSelect(ctx, run, t, mouse) {
  run._btns = []; // rebuild the hit list every frame (same fix as drawReward)
  ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center';
  ctx.fillText('PICK YOUR TRAINER', VIEW_W / 2, 110); ctx.textAlign = 'left';
  const W = 320, GAP = 36, X0 = (VIEW_W - (W * 3 + GAP * 2)) / 2, Y = 160;
  BUILTIN_TRAINERS.forEach((tr, i) => {
    const b = { x: X0 + i * (W + GAP), y: Y, w: W, h: 330 };
    run._btns = run._btns || []; run._btns[i] = { ...b, id: `trainer:${tr.id}` };
    const hot = mouse && mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h;
    if (!drawSlice(ctx, 'trainer_frame', b.x, b.y, b.w, b.h, 24, hot ? 1 : 0.92)) {
      ctx.fillStyle = hot ? 'rgba(255,201,60,.28)' : 'rgba(255,201,60,.10)';
      roundRect(ctx, b.x, b.y, b.w, b.h, 16); ctx.fill();
      ctx.strokeStyle = ELEMENT_COLORS[tr.element] || '#8ef2a0'; ctx.lineWidth = hot ? 3 : 2; ctx.stroke();
    }
    // v3: was scale 1.5 at y+120 — the 240px-tall sprite reached the name line (y+220).
    // 1.2x recentered at y+100 ends at ~y+200, clear of the name glyphs (~y+205).
    ctx.save(); ctx.translate(b.x + b.w / 2, b.y + 100); ctx.scale(1.2, 1.2);
    drawCreature(ctx, tr.element === 'Ember' ? 'embercub' : tr.element === 'Volt' ? 'voltip' : 'leaflet', 0, 0, t + i * 2, 'idle');
    ctx.restore();
    ctx.textAlign = 'center'; ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 22px monospace';
    ctx.fillText(tr.name, b.x + b.w / 2, b.y + 220);
    ctx.font = '13px monospace'; ctx.fillStyle = '#6d5b3c';
    wrap(ctx, tr.text, b.x + b.w / 2, b.y + 246, b.w - 30, 17);
    ctx.textAlign = 'left';
  });
}

function wrap(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' '); let line = '', yy = y;
  for (const w of words) {
    if (ctx.measureText(line + w).width > maxW) { ctx.fillText(line, cx, yy); yy += lh; line = w + ' '; }
    else line += w + ' ';
  }
  ctx.fillText(line, cx, yy);
}

function drawShop(ctx, run, t, mouse) {
  run._btns = [];
  ctx.fillStyle = '#6d5b3c'; ctx.font = '15px monospace'; ctx.textAlign = 'center';
  ctx.fillText('build your board — 3 same monsters merge to ★★ · max 6 · then BATTLE', VIEW_W / 2, 92);
  ctx.textAlign = 'left';

  // shop offers
  const SW = 260, SH = 92, X0 = (VIEW_W - SW * 4 - 30) / 2, Y = 120;
  run.shop.forEach((offer, i) => {
    const b = { x: X0 + i * (SW + 10), y: Y, w: SW, h: SH };
    run._btns.push({ ...b, id: `buy:${i}` });
    const hot = inRect(mouse, b);
    ctx.globalAlpha = offer ? 1 : 0.25;
    if (!drawSlice(ctx, offer && offer.kind === 'item' ? 'shop_item' : 'shop_card', b.x, b.y, b.w, b.h, 16, 1)) {
      ctx.fillStyle = hot ? 'rgba(127,191,106,.25)' : 'rgba(255,201,60,.10)';
      roundRect(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill();
      ctx.strokeStyle = offer ? EL_COLOR(offer.species) : '#556'; ctx.lineWidth = 2; ctx.stroke();
    }
    if (offer && offer.kind === 'item') {
      ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 15px monospace';
      ctx.fillText(offer.name || 'Item', b.x + 16, b.y + 34);
      ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#6d5b3c';
      wrapLeft(ctx, offer.text || 'one-shot boost', b.x + 16, b.y + 54, b.w - 90, 15);
      ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 16px monospace';
      ctx.fillText(`⬤ ${offer.cost}`, b.x + 88, b.y + 80);
    } else if (offer) {
      ctx.save(); ctx.translate(b.x + 44, b.y + 46); ctx.scale(0.62, 0.62);
      drawCreature(ctx, offer.species, 0, 0, t + i, 'idle'); ctx.restore();
      ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 15px monospace';
      ctx.fillText(SPECIES[offer.species].name, b.x + 88, b.y + 40);
      ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#6d5b3c';
      ctx.fillText(`Lv ${offer.lvl} · ${SPECIES[offer.species].element}`, b.x + 88, b.y + 60);
      ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 16px monospace';
      ctx.fillText(`⬤ ${offer.cost}`, b.x + 88, b.y + 80);
    }
    ctx.globalAlpha = 1;
  });

  // board
  ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 18px monospace';
  ctx.fillText(`BOARD ${run.board.length}/6`, X0, 260);
  const BW = 148, BH = 150;
  run.board.forEach((c, i) => {
    const b = { x: X0 + i * (BW + 8), y: 280, w: BW, h: BH };
    run._btns.push({ ...b, id: `board:${i}` });
    ctx.fillStyle = inRect(mouse, b) ? 'rgba(233,106,138,.18)' : 'rgba(255,201,60,.10)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill();
    ctx.strokeStyle = EL_COLOR(c.species); ctx.lineWidth = 2; ctx.stroke();
    // v3: was scale 0.7 at (b.x+52, b.y+60) — sprite feet reached y+116, over the Lv line (y+112).
    // 0.6x recentered in the card (74 = BW/2) ends at ~y+98, clear of the Lv glyphs (~y+103).
    ctx.save(); ctx.translate(b.x + 74, b.y + 50); ctx.scale(0.6, 0.6);
    drawCreature(ctx, c.species, 0, 0, t + i * 1.7, 'idle'); ctx.restore();
    ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 13px monospace';
    ctx.fillText(`${'★'.repeat(c.stars || 1)} Lv${c.level}`, b.x + 10, b.y + 112);
    ctx.font = '11px monospace'; ctx.fillStyle = '#6d5b3c';
    ctx.fillText(`${c.stats.hp}hp ${c.stats.atk}atk`, b.x + 10, b.y + 128);
    ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#6d5b3c';
    ctx.fillText(SPECIES[c.species].name, b.x + 10, b.y + 142);
  });
  if (run.mergeTrinketPending) { ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 14px monospace'; ctx.fillText('★ MERGE BONUS: pick a trinket below', X0, 452); }

  // trinket strip
  drawSlice(ctx, 'trinket_bar', X0 - 6, 456, SW * 4 + 42, 44, 12, 0.9);
  ctx.fillStyle = '#6d5b3c'; ctx.font = 'bold 13px monospace';
  ctx.fillText('TRINKETS:', X0, 480);
  run.trinkets.forEach((tr, i) => {
    const b = { x: X0 + 90 + i * 118, y: 462, w: 112, h: 30 };
    ctx.fillStyle = 'rgba(255,201,60,.20)'; roundRect(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill();
    ctx.strokeStyle = '#c8a355'; ctx.stroke();
    ctx.fillStyle = '#3b2c17'; ctx.font = '11px monospace'; ctx.fillText(tr.name, b.x + 8, b.y + 19);
  });

  // merge bonus picker shares the reward row if pending
  if (run.mergeTrinketPending && !run.mergeTrinkets) {
    const pool = BUILTIN_TRINKETS.filter((x) => !run.trinkets.some((o) => o.id === x.id));
    run.mergeTrinkets = pool.slice(0, 3);
  }

  // action row
  const rerollCost = (Math.max(0, freeRerolls(run) - (run._freeUsed || 0)) + (run.voucher || 0)) > 0 ? 0 : 3;
  const acts = [
    { id: 'reroll', x: VIEW_W / 2 - 330, label: `REROLL ⬤${rerollCost}` },
    { id: `lock:${run.locked ? 'off' : 'on'}`, x: VIEW_W / 2 - 120, label: run.locked ? '🔒 LOCKED' : 'LOCK' },
    { id: 'battle', x: VIEW_W / 2 + 90, label: 'BATTLE ⚔', w: 240, primary: true },
  ];
  for (const a of acts) {
    const b = { x: a.x, y: 540, w: a.w || 200, h: 56 };
    run._btns.push({ ...b, id: a.id });
    button(ctx, { ...b, hot: inRect(mouse, b) }, a.label, inRect(mouse, b));
  }

  // pending merge trinket picker overlay
  if (run.mergeTrinketPending && run.mergeTrinkets) drawTrinketRow(ctx, run, mouse, run.mergeTrinkets, 'pick your merge bonus');

  if (!run.board.length) { ctx.fillStyle = '#e85d4a'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText('buy at least one monster before battle', VIEW_W / 2, 630); ctx.textAlign = 'left'; }
}

function drawTrinketRow(ctx, run, mouse, list, label) {
  ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
  ctx.fillText(label.toUpperCase(), VIEW_W / 2, 640); ctx.textAlign = 'left';
  const W = 300, X0 = (VIEW_W - W * list.length - 20 * (list.length - 1)) / 2;
  list.forEach((tr, i) => {
    const b = { x: X0 + i * (W + 20), y: 660, w: W, h: 100 }; // v3: was h 96 — text crowded the bottom border
    run._btns.push({ ...b, id: `trinket:${i}` });
    const hot = inRect(mouse, b);
    ctx.fillStyle = hot ? 'rgba(255,201,60,.30)' : 'rgba(255,201,60,.10)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill();
    ctx.strokeStyle = '#c8a355'; ctx.lineWidth = hot ? 2.5 : 1.5; ctx.stroke();
    ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 16px monospace'; ctx.fillText(tr.name, b.x + 16, b.y + 30);
    ctx.fillStyle = '#6d5b3c'; ctx.font = '12px monospace';
    ctx.save(); ctx.beginPath(); ctx.rect(b.x + 12, b.y + 40, b.w - 24, b.h - 50); ctx.clip(); // v3: text inset — was (x+10, y+38, w-20, h-44), 6px from the border
    wrapLeft(ctx, tr.text, b.x + 16, b.y + 56, b.w - 32, 15); ctx.restore();
  });
}
function wrapLeft(ctx, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = '', yy = y;
  for (const w of words) {
    if (ctx.measureText(line + w).width > maxW) { ctx.fillText(line, x, yy); yy += lh; line = w + ' '; }
    else line += w + ' ';
  }
  ctx.fillText(line, x, yy);
}

function drawReward(ctx, run, mouse) {
  // FIX (stuck NEXT DAY): rebuild the hit list every frame. drawShop resets
  // run._btns, but drawReward kept it — so the previous shop frame's board
  // buttons (y 280-430) stayed registered and shadowed the NEXT DAY button
  // (x 510-770, y 300-360). hitRun returns the FIRST match, so a click on
  // NEXT DAY hit board:2/3/4 first and SOLD that monster instead of advancing.
  run._btns = [];
  const r = run.reward;
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px monospace'; ctx.fillStyle = r.gain > 0 ? '#2e9e4f' : '#e85d4a';
  ctx.fillText(r.trinkets.length ? 'VICTORY!' : 'DEFEAT…', VIEW_W / 2, 140);
  ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#3b2c17';
  ctx.fillText(`+⬤ ${r.gain}`, VIEW_W / 2, 178);
  ctx.font = '15px monospace'; ctx.fillStyle = '#6d5b3c';
  ctx.fillText(r.trinkets.length ? `${run.hearts} hearts left · streak ${run.streak}` : 'you lost a heart', VIEW_W / 2, 204);
  ctx.textAlign = 'left';
  if (r.trinkets.length && !r.trinketChosen) {
    drawTrinketRow(ctx, run, mouse, r.trinkets, 'pick a trinket for the win');
  } else {
    const b = { x: VIEW_W / 2 - 130, y: 300, w: 260, h: 60 };
    run._btns.push({ ...b, id: 'nextday' });
    button(ctx, { ...b, hot: inRect(mouse, b) }, `NEXT DAY →`, inRect(mouse, b));
  }
  if (r.trinketChosen || !r.trinkets.length) return;
}

function drawChampion(ctx, run, mouse) {
  // FIX: same stale-button shadowing as drawReward — rebuild the hit list.
  run._btns = [];
  ctx.textAlign = 'center'; ctx.font = 'bold 40px monospace'; ctx.fillStyle = '#d99a16';
  ctx.fillText('★ YOU ARE A QUILT CHAMPION ★', VIEW_W / 2, 260);
  ctx.font = '18px monospace'; ctx.fillStyle = '#2e9e4f';
  ctx.fillText(`Day 10 cleared with ${run.hearts} hearts · rank: ${run.rank}`, VIEW_W / 2, 310);
  ctx.textAlign = 'left';
  const opts = [{ id: 'endless', label: 'EXTENDED (endless)', x: VIEW_W / 2 - 300 }, { id: 'menu', label: 'MAIN MENU', x: VIEW_W / 2 + 40 }];
  for (const o of opts) {
    const b = { x: o.x, y: 380, w: 260, h: 58 };
    run._btns.push({ ...b, id: o.id });
    button(ctx, b, o.label, inRect(mouse, b));
  }
}

function drawOver(ctx, run, mouse) {
  // FIX: same stale-button shadowing as drawReward — rebuild the hit list.
  run._btns = [];
  ctx.textAlign = 'center'; ctx.font = 'bold 36px monospace'; ctx.fillStyle = '#e85d4a';
  ctx.fillText('RUN OVER', VIEW_W / 2, 250);
  ctx.font = '18px monospace'; ctx.fillStyle = '#6d5b3c'; // bright fix (spec miss): was pale teal '#9fd8c8' on the now-cream full-screen panel — unreadable; matches drawReward's sub-line
  ctx.fillText(`survived to Day ${run.day} · best Day ${run.bestDay} · ${run.champion ? 'CHAMPION' : 'rank ' + run.rank}`, VIEW_W / 2, 300);
  ctx.textAlign = 'left';
  const b = { x: VIEW_W / 2 - 130, y: 360, w: 260, h: 58 };
  run._btns.push({ ...b, id: 'menu' });
  button(ctx, b, 'MAIN MENU', inRect(mouse, b));
}

const inRect = (m, b) => m && m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h;

/** Hit-test a click; returns action id or null. */
export function hitRun(run, mouse) {
  for (const b of (run._btns || [])) if (inRect(mouse, b)) return b.id;
  return null;
}
