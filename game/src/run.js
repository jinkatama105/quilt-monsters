// run.js — THE QUILT SHOWDOWN: Batomon-style day loop (roguelike auto-battler)
// sitting on top of the existing showdown engine. Layer:
//   title -> trainer select -> DAY loop [ shop -> battle(auto) -> rewards ] ->
//   hearts 0 = run over; win Day 10 = champion -> endless.
// Data contract: game/data/trainers|shop|trinkets.json (Manus). Built-in tables
// below are the fallback so the loop ships before the JSON lands.
import { VIEW_W, VIEW_H, ELEMENT_COLORS } from './config.js?v=run10';
import { SPECIES, SPECIES_LIST, abilityForSpecies } from './data.js?v=run10';
import { mulberry32, rint } from './random.js?v=run10';
import { panel, roundRect, drawSlice } from './hud.js?v=run10';
import { drawCreature } from './art.js?v=run10';
import { makeCreature } from './team.js?v=run10';

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

// The 10 approved trinkets (Muse #299 wording). All hooks live in the engine:
// column_spd/burn_on_cast/multicast(leftmost)/shield/dread/counter in showdown.js,
// lucky_stitch + income + reroll_free in run.js, post_battle_heal in main.js.
// Manus's data/trinkets.json overrides this pool at boot when present.
export const BUILTIN_TRINKETS = [
  { id: 'golden_thimble', name: 'Golden Thimble', text: '+$8 income each Day.', effect: { type: 'income', value: 8 } },
  { id: 'arcade_buttons', name: 'Arcade Buttons', text: 'Your first 5 rerolls each Day are free.', effect: { type: 'reroll_free', value: 5 } },
  { id: 'swift_spool', name: 'Swift Spool', text: 'Right-hand monsters act 15% faster.', effect: { type: 'column_spd', value: 0.15 } },
  { id: 'ember_feather', name: 'Ember Feather', text: 'Ember hits leave a burn tick (+2 dmg per turn).', effect: { type: 'burn_on_cast', value: 2 } },
  { id: 'storm_needle', name: 'Storm Needle', text: 'Your leftmost monster multicasts its next strike.', effect: { type: 'multicast', value: 1, target: 'leftmost' } },
  { id: 'patchwork_shield', name: 'Patchwork Shield', text: '+6 Shield stacks to your front monster at battle start.', effect: { type: 'shield', value: 6 } },
  { id: 'shadow_spool', name: 'Shadow Spool', text: 'Each enemy KO: your Gloom allies gain +3 damage per hit this battle.', effect: { type: 'dread', value: 3 } },
  { id: 'riposte_charm', name: 'Riposte Charm', text: 'Your monsters counter every hit for 50% of damage taken.', effect: { type: 'counter', value: 50 } },
  { id: 'lucky_stitch', name: 'Lucky Stitch', text: '25% chance after a win: a bonus item in the next shop.', effect: { type: 'lucky_item', value: 25 } },
  { id: 'woolly_charm', name: 'Woolly Charm', text: 'No heal between battles; instead your board recovers +2 HP.', effect: { type: 'post_battle_heal', value: 2 } },
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
    champion: false, endless: false, championShown: false,
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
  // Lucky Stitch: a pending bonus (from the trinket roll OR the shop item) puts
  // one bonus item into the next shop. Manus #370 b1: the item's own grant must
  // not be gated on also owning the trinket (trinket rolls already check
  // ownership in stageReward before setting the flag).
  const lucky = !foolGold && !!run.luckyPending;
  if (lucky) run.luckyPending = false;
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
  if (lucky) {
    const ip = base.filter((s) => s.kind === 'item' && (run.board.length || !needsBoardTarget(s)));
    if (ip.length) items.splice(1 + Math.floor(rng() * 3), 0, { ...ip[Math.floor(rng() * ip.length)] });
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
  if (run.board.length >= 6) return 'board full (max 6)';
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
export function applyItem(run, offer) {
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
  } else if (e.type === 'lucky_item') {
    // as a SHOP item (Manus data): grant the pending lucky bonus immediately (value = % chance, default 25)
    if (run.rng() < ((e.value || 25) / 100)) run.luckyPending = true;
  } else if (e.type === 'trinket') {
    // buy a named trinket from the built-in pool; unknown id or already owned = still consumable (coin sink)
    const t = BUILTIN_TRINKETS.find((x) => x.id === e.id);
    if (t && !run.trinkets.some((x) => x.id === t.id)) run.trinkets.push({ ...t });
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
  // Manus #370 b3: the shop pool now contains items (no `species`) once
  // data/shop.json overrides BUILTIN_SHOP — opponents draw monsters only.
  const ids = SPECIES_LIST.filter((id) => SPECIES[id] && SPECIES[id].base);
  for (let i = 0; i < n; i++) {
    const id = ids[Math.floor(rng() * ids.length)];
    const c = makeCreature(id, lvl);
    c.stars = rng() < run.day / 22 ? 2 : 1;
    if (c.stars === 2) boostStats(c, 2);
    c.ability = abilityForSpecies(SPECIES[id]);
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
    // v5: carry the real outcome — drawReward used to derive VICTORY/DEFEAT
    // from trinkets.length, so a WON battle with an exhausted trinket pool
    // (all 6 owned — normal by Day 7) displayed as DEFEAT + 'you lost a heart'.
    run.reward = { gain, trinkets: opts, trinketChosen: false, won: true };
    // Lucky Stitch: 25% roll for one bonus item in the NEXT shop
    const luckies = run.trinkets.filter((t) => (t.effect || {}).type === 'lucky_item');
    for (const lt of luckies) { if (run.rng() < ((lt.effect.value || 25) / 100)) { run.luckyPending = true; break; } }
  } else {
    run.streak = 0;
    run.hearts -= 1;
    run.reward = { gain: 4, trinkets: [], trinketChosen: true, won: false };
  }
  run.phase = 'reward';
}

/** Confirm reward -> advance Day (or end). */
export function nextDay(run) {
  run.reward = null;
  if (run.hearts <= 0) { run.phase = 'over'; return; }
  // v5: the champion screen used to fire on ANY Day-10 exit — including a
  // Day-10 LOSS — crowning the run 'QUILT CHAMPION' with 'Day 10 cleared'
  // even though Day 10 was lost (and the hearts text vs the hearts row then
  // told two different stories). finishRunBattle records a real Day-10 win
  // in run.champion; only that opens the champion screen, once.
  if (run.day >= 10 && run.champion && !run.championShown) {
    run.championShown = true; run.rank = 'Quilt Champion';
    run.phase = 'champion'; return;
  }
  // Day 10 lost (champion false): retry Day 10 — the day does not advance
  // and endless does not start until Day 10 is actually won. Days other
  // than 10 always advance (including endless Days 11+).
  if (run.day !== 10) { run.day += 1; run.bestDay = Math.max(run.bestDay, run.day); }
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
    luckyPending: run.luckyPending || false,
    championShown: run.championShown,
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
  // v5: was `⬤ ${run.coins}` — the ⬤ rendered as a black disc in ink, and the
  // coin icon is already drawn just left of it. Number only.
  ctx.fillText(`${run.coins}`, VIEW_W - 170, 44);
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#3b2c17'; // v3: was 14px #6d5b3c, unreadable on sage
  // v7: was y=68 — measured (DejaVu Sans Mono Bold 14px): the 'k' ascender
  // tops at baseline-12, so at 68 its top was y=56 = the DAY tab's bottom
  // edge (tab spans y 12..56, opaque to the edge). At 74 the 'k' top is 62
  // (6px clear of the tab) and the rank's ink bottom (74) sits 7px above the
  // shop subtitle's ink top (~81) — clear on both sides, every phase.
  ctx.fillText(run.rank, 24, 74);

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
  // v6 (Manus #351): one row sized for 3 pushed trainers 4-6 off-canvas.
  // Grid: 3 per row, cards shrink when a second row is needed so 6 fit in 800px.
  const perRow = 3, rows = Math.ceil(BUILTIN_TRAINERS.length / perRow);
  const W = 320, H = rows > 1 ? 290 : 330, GAPX = 36, GAPY = 24;
  const X0 = (VIEW_W - (W * perRow + GAPX * (perRow - 1))) / 2, Y0 = rows > 1 ? 130 : 160;
  const sprY = H > 300 ? 100 : 92, sprS = H > 300 ? 1.2 : 1.05;
  const nameY = H > 300 ? 220 : 198, textY = H > 300 ? 246 : 220;
  BUILTIN_TRAINERS.forEach((tr, i) => {
    const col = i % perRow, row = Math.floor(i / perRow);
    const b = { x: X0 + col * (W + GAPX), y: Y0 + row * (H + GAPY), w: W, h: H };
    run._btns = run._btns || []; run._btns[i] = { ...b, id: `trainer:${tr.id}` };
    const hot = mouse && mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h;
    if (!drawSlice(ctx, 'trainer_frame', b.x, b.y, b.w, b.h, 24, hot ? 1 : 0.92)) {
      ctx.fillStyle = hot ? 'rgba(255,201,60,.28)' : 'rgba(255,201,60,.10)';
      roundRect(ctx, b.x, b.y, b.w, b.h, 16); ctx.fill();
      ctx.strokeStyle = ELEMENT_COLORS[tr.element] || '#8ef2a0'; ctx.lineWidth = hot ? 3 : 2; ctx.stroke();
    }
    // v3: was scale 1.5 at y+120 — the 240px-tall sprite reached the name line (y+220).
    // 1.2x recentered at y+100 ends at ~y+200, clear of the name glyphs (~y+205).
    ctx.save(); ctx.translate(b.x + b.w / 2, b.y + sprY); ctx.scale(sprS, sprS);
    drawCreature(ctx, tr.element === 'Ember' ? 'embercub' : tr.element === 'Volt' ? 'voltip' : 'leaflet', 0, 0, t + i * 2, 'idle');
    ctx.restore();
    ctx.textAlign = 'center'; ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 22px monospace';
    ctx.fillText(tr.name, b.x + b.w / 2, b.y + nameY);
    ctx.font = '13px monospace'; ctx.fillStyle = '#6d5b3c';
    wrap(ctx, tr.text, b.x + b.w / 2, b.y + textY, b.w - 30, 17);
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

  // shop offers — Manus #370 b2: a Lucky Stitch bonus adds a 5th offer; slots
  // shrink to fit so nothing overflows the 1280px canvas (4 slots = 260 as before).
  const N = Math.max(4, run.shop.length);
  const SW = Math.min(260, Math.floor((VIEW_W - 40 - (N - 1) * 10) / N));
  const SH = 92, X0 = (VIEW_W - (SW * N + 10 * (N - 1))) / 2, Y = 120;
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
      // v5: was `⬤ ${offer.cost}` — the ⬤ rendered as a black disc. Real coin icon + number.
      drawSlice(ctx, 'coin_icon', b.x + 88, b.y + 66, 16, 16, 6, 1);
      ctx.fillText(`${offer.cost}`, b.x + 110, b.y + 80);
    } else if (offer) {
      ctx.save(); ctx.translate(b.x + 44, b.y + 46); ctx.scale(0.62, 0.62);
      drawCreature(ctx, offer.species, 0, 0, t + i, 'idle'); ctx.restore();
      ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 15px monospace';
      ctx.fillText(SPECIES[offer.species].name, b.x + 88, b.y + 40);
      ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#6d5b3c';
      ctx.fillText(`Lv ${offer.lvl} · ${SPECIES[offer.species].element}`, b.x + 88, b.y + 60);
      ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 16px monospace';
      // v5: was `⬤ ${offer.cost}` — the ⬤ rendered as a black disc. Real coin icon + number.
      drawSlice(ctx, 'coin_icon', b.x + 88, b.y + 66, 16, 16, 6, 1);
      ctx.fillText(`${offer.cost}`, b.x + 110, b.y + 80);
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
  // 10-trinket pool: chips shrink to fit the row instead of overflowing the canvas
  {
    const avail = VIEW_W - (X0 + 90) - 20;
    const n = run.trinkets.length || 1;
    const w = Math.min(112, Math.floor((avail - (n - 1) * 6) / n));
    const step = w + 6;
    run.trinkets.forEach((tr, i) => {
      const b = { x: X0 + 90 + i * step, y: 462, w, h: 30 };
      ctx.fillStyle = 'rgba(255,201,60,.20)'; roundRect(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill();
      ctx.strokeStyle = '#c8a355'; ctx.stroke();
      ctx.fillStyle = '#3b2c17'; ctx.font = '11px monospace';
      let label = tr.name;
      while (ctx.measureText(label).width > w - 12 && label.length > 4) label = label.slice(0, -2);
      if (label !== tr.name) label = label.slice(0, -1) + '.';
      ctx.fillText(label, b.x + 6, b.y + 19);
    });
  }

  // merge bonus picker shares the reward row if pending
  if (run.mergeTrinketPending && !run.mergeTrinkets) {
    const pool = BUILTIN_TRINKETS.filter((x) => !run.trinkets.some((o) => o.id === x.id));
    run.mergeTrinkets = pool.slice(0, 3);
  }

  // action row
  const rerollCost = (Math.max(0, freeRerolls(run) - (run._freeUsed || 0)) + (run.voucher || 0)) > 0 ? 0 : 3;
  const acts = [
    // v5: was `REROLL ⬤${rerollCost}` — the ⬤ rendered as a black disc.
    // Label is text-only now; the coin icon is drawn just left of it below.
    { id: 'reroll', x: VIEW_W / 2 - 330, label: `REROLL ${rerollCost}` },
    { id: `lock:${run.locked ? 'off' : 'on'}`, x: VIEW_W / 2 - 120, label: run.locked ? '🔒 LOCKED' : 'LOCK' },
    { id: 'battle', x: VIEW_W / 2 + 90, label: 'BATTLE', w: 240, primary: true },
  ];
  for (const a of acts) {
    const b = { x: a.x, y: 540, w: a.w || 200, h: 56 };
    run._btns.push({ ...b, id: a.id });
    button(ctx, { ...b, hot: inRect(mouse, b) }, a.label, inRect(mouse, b));
    // v5: coin icon for the reroll price — drawn after the panel so it sits
    // on top, just left of the centred label ('REROLL 3' spans ±40px).
    if (a.id === 'reroll') drawSlice(ctx, 'coin_icon', b.x + b.w / 2 - 66, b.y + 18, 20, 20, 6, 1);
  }

  // pending merge trinket picker overlay
  if (run.mergeTrinketPending && run.mergeTrinkets) drawTrinketRow(ctx, run, mouse, run.mergeTrinkets, 'pick your merge bonus');

  // v6: run._msg was set on failed buy/sell (e.g. 'board full') but never drawn,
  // so a full-board click looked dead. Show it here; the empty-board hint only
  // when there is no message (same line, no overlap).
  if (run._msg) { ctx.fillStyle = '#e85d4a'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText(run._msg, VIEW_W / 2, 630); ctx.textAlign = 'left'; }
  else if (!run.board.length) { ctx.fillStyle = '#e85d4a'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText('buy at least one monster before battle', VIEW_W / 2, 630); ctx.textAlign = 'left'; }
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
  // v5: verdict comes from r.won now, not trinkets.length — a won battle with
  // an exhausted trinket pool used to display as DEFEAT + 'you lost a heart'.
  // (The old title colour also keyed on r.gain > 0, which is 4 even on a loss,
  // so DEFEAT… was drawn green.)
  ctx.font = 'bold 34px monospace'; ctx.fillStyle = r.won ? '#2e9e4f' : '#e85d4a';
  ctx.fillText(r.won ? 'VICTORY!' : 'DEFEAT…', VIEW_W / 2, 140);
  ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#3b2c17';
  // v5: was `+⬤ ${r.gain}` — the ⬤ rendered as a black disc. Real coin icon
  // left of the centred number.
  const gainTxt = `+${r.gain}`;
  const gainW = ctx.measureText(gainTxt).width;
  drawSlice(ctx, 'coin_icon', VIEW_W / 2 - gainW / 2 - 28, 162, 20, 20, 6, 1);
  ctx.fillText(gainTxt, VIEW_W / 2, 178);
  ctx.font = '15px monospace'; ctx.fillStyle = '#6d5b3c';
  ctx.fillText(r.won ? `${run.hearts} hearts left · streak ${run.streak}` : 'you lost a heart', VIEW_W / 2, 204);
  // v5: level-ups from the battle, announced where they stay readable — the
  // in-battle banner lived 1.8s under the end veil and was never seen.
  if (r.levelUps && r.levelUps.length) {
    ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#d99a16';
    ctx.fillText(`★ LEVEL UP: ${r.levelUps.map((u) => `${u.name} Lv${u.level}`).join(' · ')}`, VIEW_W / 2, 232);
  }
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
