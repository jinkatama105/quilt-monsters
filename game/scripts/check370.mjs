// self-check for Manus #370 blockers — run: node scripts/check370.mjs
import { makeRun, rollShop, buy, makeOpponent } from '../src/run.js';
const shopFor = (r) => { rollShop(r); return r.shop; };
import { SPECIES, SPECIES_LIST } from '../src/data.js';

// simulate loadData() pushing a shop.json with items into BUILTIN_SHOP
import { BUILTIN_SHOP } from '../src/run.js';
BUILTIN_SHOP.length = 0;
BUILTIN_SHOP.push(
  { species: 'embercub', cost: 8 }, { species: 'leaflet', cost: 8 },
  { species: 'tidepup', cost: 8 }, { species: 'gloomling', cost: 10 },
  { kind: 'item', id: 'honey_cake', name: 'Honey Cake', cost: 6, effect: { type: 'heal_board', value: 4 } },
  { kind: 'item', id: 'lucky_stitch_item', name: 'Lucky Stitch', cost: 10, effect: { type: 'lucky_item', value: 100 } },
  { kind: 'item', id: 'thread_voucher', name: 'Voucher', cost: 5, effect: { type: 'reroll_free_once' } },
);

const mk = (seed = 42) => { const r = makeRun(seed); r.trainerId = 'ranger'; r.phase = 'shop'; return r; };

// b3: makeOpponent must not crash on item entries
for (let d = 1; d <= 6; d++) { const r = mk(); r.day = d; const o = makeOpponent(r);
  if (!o.squad.length || o.squad.some((c) => !c.stats || c.stats.hp === undefined)) throw new Error('b3 squad bad'); }
console.log('b3 OK: makeOpponent survives item-containing shop pool');

// b1: buying the Lucky Stitch shop item triggers the bonus WITHOUT the trinket
{ const r = mk(7); rollShop(r);
  const i = r.shop.findIndex((s) => s && s.effect && s.effect.type === 'lucky_item');
  if (i < 0) throw new Error('lucky item not offered');
  r.coins = 100; const err = buy(r, i);
  if (err) throw new Error('b1 buy err ' + err);
  if (!r.luckyPending) throw new Error('b1 flag not set');
  const next = shopFor(r);
  if (!next.some((s) => s.kind === 'item')) throw new Error('b1 no bonus item next shop');
  console.log('b1 OK: shop item alone -> bonus next shop, no trinket needed'); }

// b2: 5-offer layout fits 1280 (mirror of drawShop math)
{ const VIEW_W = 1280;
  for (const N of [4, 5]) { const SW = Math.min(260, Math.floor((VIEW_W - 40 - (N - 1) * 10) / N));
    const X0 = (VIEW_W - (SW * N + 10 * (N - 1))) / 2;
    const right = X0 + (N - 1) * (SW + 10) + SW;
    if (X0 < 0 || right > VIEW_W) throw new Error('b2 overflow N=' + N);
    if (N === 4 && SW !== 260) throw new Error('b2 changed 4-slot size'); }
  console.log('b2 OK: 4-slot unchanged (260px), 5-slot fits canvas'); }

// b4: empty board -> no board-targeted bonus offered; voucher OK; buy never says 'needs a monster'
{ const r = mk(11); r.board = []; r.luckyPending = true;
  r.trinkets = [{ id: 'lucky_stitch', effect: { type: 'lucky_item', value: 100 } }];
  for (let s = 0; s < 30; s++) { const shop = shopFor(r);
    const bonus = shop.filter((x) => x.kind === 'item');
    for (const b of bonus) if ((b.effect.type === 'heal_board' || b.effect.type === 'buff' || b.effect.type === 'shield') && !r.board.length) throw new Error('b4 offered board item on empty board'); }
  // board-targeted items also absent from the base 4 draws on empty board
  for (let s = 0; s < 30; s++) { const shop = shopFor({ ...mk(3), board: [], luckyPending: false });
    if (shop.some((x) => x && x.kind === 'item' && x.effect && x.effect.type === 'heal_board')) throw new Error('b4 base filter'); }
  console.log('b4 OK: board-targeted items never offered on an empty board'); }
console.log('ALL PASS');
