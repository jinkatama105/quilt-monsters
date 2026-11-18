// data.js — everything the game knows about creatures, moves, the type chart and the wild tables.
// Five elements: Ember, Verdant, Volt, Tide, Gloom. All names and creatures are original.

// Type chart: CHART[attacker][defender] = multiplier. Designed cycle:
// Ember > Verdant > Tide > Ember, Volt > Tide & Gloom, Gloom > Verdant, with matching resistances.
export const CHART = {
  Ember:   { Ember: 1,   Verdant: 2,  Volt: 1,   Tide: 0.5, Gloom: 1 },
  Verdant: { Ember: 0.5, Verdant: 1,  Volt: 0.5, Tide: 2,   Gloom: 0.5 },
  Volt:    { Ember: 1,   Verdant: 1,  Volt: 1,   Tide: 2,   Gloom: 2 },
  Tide:    { Ember: 2,   Verdant: 0.5, Volt: 0.5, Tide: 1,  Gloom: 1 },
  Gloom:   { Ember: 1,   Verdant: 2,  Volt: 0.5, Tide: 1,   Gloom: 1 },
};

export const ELEMENTS = ['Ember', 'Verdant', 'Volt', 'Tide', 'Gloom'];

export function matchup(att, def) {
  return CHART[att] && CHART[att][def] !== undefined ? CHART[att][def] : 1;
}

// ------------------------------------------------------------------ moves
// power 0 = status move. effect: 'heal' restores 40% hp, 'focus' raises own attack next turn.
export const MOVES = {
  emberDart:    { name: 'Ember Dart',    element: 'Ember',   power: 42,  accuracy: 1.0,  pp: 12 },
  cinderRoar:   { name: 'Cinder Roar',   element: 'Ember',   power: 74,  accuracy: 0.85, pp: 6 },
  flareFocus:   { name: 'Flare Focus',   element: 'Ember',   power: 0,   accuracy: 1,    pp: 4, effect: 'focus' },
  leafLash:     { name: 'Leaf Lash',     element: 'Verdant', power: 44,  accuracy: 0.95, pp: 11 },
  bloomDrain:   { name: 'Bloom Drain',   element: 'Verdant', power: 58,  accuracy: 0.9,  pp: 6, effect: 'drain' },
  mossVeil:     { name: 'Moss Veil',     element: 'Verdant', power: 0,   accuracy: 1,    pp: 4, effect: 'heal' },
  sparkJolt:    { name: 'Spark Jolt',    element: 'Volt',    power: 40,  accuracy: 1.0,  pp: 12 },
  thunderPelea: { name: 'Thunder Pelea', element: 'Volt',    power: 78,  accuracy: 0.8,  pp: 5 },
  staticField:  { name: 'Static Field',  element: 'Volt',    power: 0,   accuracy: 1,    pp: 4, effect: 'focus' },
  bubbleFlick:  { name: 'Bubble Flick',  element: 'Tide',    power: 42,  accuracy: 0.98, pp: 11 },
  brineWave:    { name: 'Brine Wave',    element: 'Tide',    power: 72,  accuracy: 0.85, pp: 6 },
  tideMend:     { name: 'Tide Mend',     element: 'Tide',    power: 0,   accuracy: 1,    pp: 4, effect: 'heal' },
  gloomSpore:   { name: 'Gloom Spore',   element: 'Gloom',   power: 46,  accuracy: 0.95, pp: 10 },
  nightCreep:   { name: 'Night Creep',   element: 'Gloom',   power: 76,  accuracy: 0.82, pp: 6 },
  hexBloom:     { name: 'Hex Bloom',     element: 'Gloom',   power: 0,   accuracy: 1,    pp: 3, effect: 'drain' },
  // tribus signatures
  mothCinder:   { name: 'Moth Cinder',   element: 'Ember',   power: 88,  accuracy: 0.9,  pp: 5 },
  glacierTide:  { name: 'Glacier Tide',  element: 'Tide',    power: 86,  accuracy: 0.88, pp: 5 },
  duskRequiem:  { name: 'Dusk Requiem',  element: 'Gloom',   power: 95,  accuracy: 0.85, pp: 4 },
};

// ------------------------------------------------------------------ species
// base: hp/atk/def/spd at level 1 (grown per level by config.STAT_GROWTH).
// learn: [{lv, move}] — moves known at start (lv 1) plus learned later.
export const SPECIES = {
  emberling: {
    id: 'emberling', name: 'Emberling', element: 'Ember',
    desc: 'A coal-hearted cub whose tail-smoke smells of pine and matches.',
    base: { hp: 24, atk: 9, def: 6, spd: 8 }, xpYield: 30, rarity: 2,
    learn: [{ lv: 1, move: 'emberDart' }, { lv: 1, move: 'cinderRoar' }, { lv: 6, move: 'flareFocus' }],
  },
  verdanom: {
    id: 'verdanom', name: 'Verdanom', element: 'Verdant',
    desc: 'A walking thicket. Birds nest in its crown and it pretends not to notice.',
    base: { hp: 28, atk: 7, def: 9, spd: 5 }, xpYield: 32, rarity: 2,
    learn: [{ lv: 1, move: 'leafLash' }, { lv: 1, move: 'mossVeil' }, { lv: 7, move: 'bloomDrain' }],
  },
  voltip: {
    id: 'voltip', name: 'Voltip', element: 'Volt',
    desc: 'A humming seed-bot that snaps to attention near storms.',
    base: { hp: 21, atk: 8, def: 5, spd: 11 }, xpYield: 34, rarity: 2,
    learn: [{ lv: 1, move: 'sparkJolt' }, { lv: 5, move: 'staticField' }, { lv: 9, move: 'thunderPelea' }],
  },
  tidrel: {
    id: 'tidrel', name: 'Tidrel', element: 'Tide',
    desc: 'A shy newt of the spring pools, bubbles trailing like ribbon.',
    base: { hp: 26, atk: 7, def: 8, spd: 7 }, xpYield: 33, rarity: 2,
    learn: [{ lv: 1, move: 'bubbleFlick' }, { lv: 6, move: 'tideMend' }, { lv: 10, move: 'brineWave' }],
  },
  gloomcap: {
    id: 'gloomcap', name: 'Gloomcap', element: 'Gloom',
    desc: 'A lantern mushroom that glows only when someone looks away.',
    base: { hp: 25, atk: 9, def: 6, spd: 6 }, xpYield: 35, rarity: 1,
    learn: [{ lv: 1, move: 'gloomSpore' }, { lv: 8, move: 'hexBloom' }, { lv: 11, move: 'nightCreep' }],
  },
  magmoth: {
    id: 'magmoth', name: 'Magmoth', element: 'Ember', boss: true,
    desc: 'Tribus of the Cinder Bluff. Its wing-dust sets nine fires and one rumour.',
    base: { hp: 60, atk: 13, def: 9, spd: 8 }, xpYield: 240, rarity: 0,
    learn: [{ lv: 1, move: 'cinderRoar' }, { lv: 1, move: 'emberDart' }, { lv: 1, move: 'mothCinder' }, { lv: 1, move: 'flareFocus' }],
  },
  gelundra: {
    id: 'gelundra', name: 'Gelundra', element: 'Tide', boss: true,
    desc: 'Tribus of the Spring. Sleeps under the ice that feeds the meadow.',
    base: { hp: 64, atk: 11, def: 12, spd: 5 }, xpYield: 240, rarity: 0,
    learn: [{ lv: 1, move: 'brineWave' }, { lv: 1, move: 'bubbleFlick' }, { lv: 1, move: 'glacierTide' }, { lv: 1, move: 'tideMend' }],
  },
  nocturne: {
    id: 'nocturne', name: 'Nocturne', element: 'Gloom', boss: true,
    desc: 'Final Tribus of the Gloom Shrine. It does not cast shadows; it keeps them.',
    base: { hp: 80, atk: 15, def: 11, spd: 12 }, xpYield: 500, rarity: 0,
    learn: [{ lv: 1, move: 'nightCreep' }, { lv: 1, move: 'gloomSpore' }, { lv: 1, move: 'duskRequiem' }, { lv: 1, move: 'hexBloom' }],
  },
  // ---- nine common wild juniors (catchable, all procedurally drawn in art.js) ----
  cindermot: {
    id: 'cindermot', name: 'Cindermot', element: 'Ember',
    desc: 'A wandering spark that mistakes every campfire for a long-lost cousin.',
    base: { hp: 18, atk: 7, def: 4, spd: 9 }, xpYield: 18, rarity: 4,
    learn: [{ lv: 1, move: 'emberDart' }, { lv: 5, move: 'cinderRoar' }],
  },
  embersnail: {
    id: 'embersnail', name: 'Embersnail', element: 'Ember',
    desc: 'Its shell smoulders slowly. Pedestrians are advised not to lean on it.',
    base: { hp: 24, atk: 5, def: 9, spd: 2 }, xpYield: 19, rarity: 4,
    learn: [{ lv: 1, move: 'emberDart' }, { lv: 6, move: 'flareFocus' }],
  },
  mossbeak: {
    id: 'mossbeak', name: 'Mossbeak', element: 'Verdant',
    desc: 'A round bird with a leaf crest that files its seeds for later.',
    base: { hp: 22, atk: 6, def: 6, spd: 7 }, xpYield: 20, rarity: 4,
    learn: [{ lv: 1, move: 'leafLash' }, { lv: 5, move: 'mossVeil' }],
  },
  thornback: {
    id: 'thornback', name: 'Thornback', element: 'Verdant',
    desc: 'A living bramble-shield. Predators politely look elsewhere.',
    base: { hp: 26, atk: 7, def: 10, spd: 3 }, xpYield: 24, rarity: 3,
    learn: [{ lv: 1, move: 'leafLash' }, { lv: 7, move: 'bloomDrain' }],
  },
  stormpup: {
    id: 'stormpup', name: 'Stormpup', element: 'Volt',
    desc: 'Chases thunderheads like a dog chases cars. Both are equally confused.',
    base: { hp: 20, atk: 8, def: 5, spd: 10 }, xpYield: 22, rarity: 4,
    learn: [{ lv: 1, move: 'sparkJolt' }, { lv: 6, move: 'staticField' }],
  },
  peblite: {
    id: 'peblite', name: 'Peblite', element: 'Volt',
    desc: 'A pebble with a static charge and unshakeable opinions about roads.',
    base: { hp: 23, atk: 7, def: 8, spd: 4 }, xpYield: 21, rarity: 4,
    learn: [{ lv: 1, move: 'sparkJolt' }, { lv: 8, move: 'thunderPelea' }],
  },
  frostcap: {
    id: 'frostcap', name: 'Frostcap', element: 'Tide',
    desc: 'A little ice mushroom that weeps clean cold tears into the springs.',
    base: { hp: 23, atk: 6, def: 8, spd: 5 }, xpYield: 21, rarity: 4,
    learn: [{ lv: 1, move: 'bubbleFlick' }, { lv: 6, move: 'tideMend' }],
  },
  duskfin: {
    id: 'duskfin', name: 'Duskfin', element: 'Tide',
    desc: 'Surfaces only at sundown. Anglers consider this excellent manners.',
    base: { hp: 21, atk: 7, def: 6, spd: 9 }, xpYield: 21, rarity: 3,
    learn: [{ lv: 1, move: 'bubbleFlick' }, { lv: 7, move: 'brineWave' }],
  },
  gloomling: {
    id: 'gloomling', name: 'Gloomling', element: 'Gloom',
    desc: 'A shadow that fell off a mushroom and grew ambitions.',
    base: { hp: 19, atk: 8, def: 5, spd: 8 }, xpYield: 20, rarity: 4,
    learn: [{ lv: 1, move: 'gloomSpore' }, { lv: 6, move: 'hexBloom' }],
  },
  // ---- Showdown roster expansion (auto-battler units) ----
  lampkin: {
    id: 'lampkin', name: 'Lampkin', element: 'Ember',
    desc: 'A jack-o-lantern with a borrowed candle. Generous with the light, stingy with the secrets.',
    base: { hp: 24, atk: 7, def: 7, spd: 5 }, xpYield: 23, rarity: 3, ability: 'kindle',
    learn: [{ lv: 1, move: 'emberDart' }, { lv: 6, move: 'cinderRoar' }],
  },
  brineling: {
    id: 'brineling', name: 'Brineling', element: 'Tide',
    desc: 'A little knot of living sea-salt that reformulates itself after every storm.',
    base: { hp: 23, atk: 6, def: 9, spd: 6 }, xpYield: 23, rarity: 3, ability: 'riposte',
    learn: [{ lv: 1, move: 'bubbleFlick' }, { lv: 6, move: 'brineWave' }],
  },
  arcmoth: {
    id: 'arcmoth', name: 'Arcmoth', element: 'Volt',
    desc: 'Flies straight into every storm because it finds the impact fashionable.',
    base: { hp: 20, atk: 9, def: 5, spd: 9 }, xpYield: 25, rarity: 3, ability: 'overload',
    learn: [{ lv: 1, move: 'sparkJolt' }, { lv: 7, move: 'thunderPelea' }],
  },
  murkmaw: {
    id: 'murkmaw', name: 'Murkmaw', element: 'Gloom',
    desc: 'Bites first, haunts later. Shrine etiquette discourages both.',
    base: { hp: 25, atk: 10, def: 6, spd: 7 }, xpYield: 28, rarity: 2, ability: 'dread',
    learn: [{ lv: 1, move: 'gloomSpore' }, { lv: 8, move: 'hexBloom' }],
  },
  fernacle: {
    id: 'fernacle', name: 'Fernacle', element: 'Verdant',
    desc: 'A fern in a very old shell, moving at a very diplomatic pace.',
    base: { hp: 30, atk: 6, def: 11, spd: 3 }, xpYield: 26, rarity: 3, ability: 'bulwark',
    learn: [{ lv: 1, move: 'leafLash' }, { lv: 7, move: 'bloomDrain' }],
  },
};

export const SPECIES_LIST = Object.keys(SPECIES);

// Wild encounter tables per zone id (weight).
export const WILD_TABLES = {
  moss:   [['mossbeak', 5], ['frostcap', 3], ['stormpup', 2], ['thornback', 2], ['gloomling', 2], ['verdanom', 4], ['tidrel', 3], ['voltip', 2], ['emberling', 2], ['gloomcap', 1], ['fernacle', 2], ['brineling', 2]],
  cliff:  [['cindermot', 5], ['embersnail', 3], ['peblite', 3], ['stormpup', 2], ['emberling', 5], ['voltip', 3], ['magmoth', 0.02], ['gloomcap', 1], ['lampkin', 2], ['arcmoth', 2]],
  temple: [['gloomling', 5], ['duskfin', 2], ['frostcap', 2], ['gloomcap', 5], ['verdanom', 2], ['nocturne', 0.012], ['tidrel', 1], ['murkmaw', 2], ['arcmoth', 1]],
};

// ------------------------------------------------- showdown abilities (passive)
// Each unit carries one ability from its species (bosses always get one).
// kindle   — battle start: whole allied team +18% ATK
// riposte  — 25% chance to strike back when hit
// overload — attacks gain +15% crit chance (x1.6 dmg)
// dread    — on hit, 18% chance the target loses its next action (scared)
// bulwark  — takes 22% less damage from everything
export const ABILITIES = {
  kindle:   { name: 'Kindle',   note: '+18% team ATK at the start of every skirmish' },
  riposte:  { name: 'Riposte',  note: '25% chance to strike back when hit' },
  overload: { name: 'Overload', note: '+15% critical chance (x1.6 damage)' },
  dread:    { name: 'Dread',    note: 'Hits may scare the foe out of its next action' },
  bulwark:  { name: 'Bulwark',  note: 'Takes 22% less damage from every source' },
};

/** Pick an ability for a freshly made creature: species default, or rolled by element. */
export function abilityForSpecies(sp) {
  if (sp.ability) return sp.ability;
  const byElement = { Ember: 'kindle', Tide: 'riposte', Volt: 'overload', Gloom: 'dread', Verdant: 'bulwark' };
  return byElement[sp.element] || null;
}

/** A random enemy squad for the wild (3-6 units, formation slots auto). */
export function wildSquad(zoneId, baseLevel) {
  const table = WILD_TABLES[zoneId] || WILD_TABLES.moss;
  const total = table.reduce((s, [, w]) => s + w, 0);
  const pick = () => {
    let r = Math.random() * total;
    for (const [id, w] of table) { r -= w; if (r <= 0) return id; }
    return table[0][0];
  };
  const count = 2 + Math.floor(Math.random() * 3); // 2..4 wilders (player outnumbers slightly to keep win rate fair)
  const squad = [];
  for (let i = 0; i < count; i++) squad.push([pick(), baseLevel + rint2(-1, 2)]);
  return squad;
}

function rint2(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

/** Boss squad: the Tribus plus 2-3 wild escorts from its zone. */
export function bossSquad(bossId, bossLevel, zoneId) {
  const squad = [[bossId, bossLevel]];
  const table = (WILD_TABLES[zoneId] || WILD_TABLES.moss).filter(([id]) => !SPECIES[id].boss);
  for (let i = 0; i < 3; i++) {
    const [id] = table[Math.floor(Math.random() * table.length)];
    squad.push([id, bossLevel - 2 + Math.floor(Math.random() * 3)]);
  }
  return squad;
}

// Fixed story encounters: walking onto the tile near these markers starts the boss battle.
export const MISSIONS = [
  { key: 'gelundra', zone: 'moss',   name: 'Gelundra, Tribus of the Spring', note: 'Defeat or capture Gelundra at the frozen spring.' },
  { key: 'magmoth',  zone: 'cliff',  name: 'Magmoth, Tribus of the Bluff',   note: 'Defeat or capture Magmoth atop the Cinder Bluff.' },
  { key: 'nocturne', zone: 'temple', name: 'Nocturne, the Final Tribus',     note: 'End the vigil of Nocturne in the Gloom Shrine.', gated: true },
];

export function movesForSpecies(sp, level) {
  const chosen = sp.learn.filter((l) => l.lv <= level).map((l) => l.move);
  const uniq = [...new Set(chosen)];
  return uniq.slice(-4);
}
