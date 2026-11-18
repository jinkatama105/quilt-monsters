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

  // ---- MONSPEC1: Quilt Edition (Muse portraits + poses) ----
  embercub: {
    id: 'embercub', name: 'Embercub', element: 'Ember', quilt: true,
    desc: 'A stitched cub with a button eye that stays warm long after the fire dies.',
    base: { hp: 27, atk: 9, def: 6, spd: 7 }, xpYield: 34, rarity: 2, ability: 'kindle',
    learn: [{ lv: 1, move: 'emberDart' }, { lv: 6, move: 'cinderRoar' }],
  },
  cinderwing: {
    id: 'cinderwing', name: 'Cinderwing', element: 'Ember', quilt: true,
    desc: 'Its patchwork wings shed sparks like loose thread. Do not re-sew.',
    base: { hp: 23, atk: 10, def: 5, spd: 10 }, xpYield: 36, rarity: 2, ability: 'kindle',
    learn: [{ lv: 1, move: 'emberDart' }, { lv: 8, move: 'mothCinder' }],
  },
  leaflet: {
    id: 'leaflet', name: 'Leaflet', element: 'Verdant', quilt: true,
    desc: 'A tiny green quilt-thing that photosynthesises naptime.',
    base: { hp: 25, atk: 7, def: 8, spd: 8 }, xpYield: 31, rarity: 1, ability: 'bulwark',
    learn: [{ lv: 1, move: 'leafLash' }, { lv: 7, move: 'mossVeil' }],
  },
  thornbloom: {
    id: 'thornbloom', name: 'Thornbloom', element: 'Verdant', quilt: true,
    desc: 'Beautiful flowers, hateful thorns, hand-stitched in that order.',
    base: { hp: 28, atk: 9, def: 8, spd: 5 }, xpYield: 37, rarity: 3, ability: 'riposte',
    learn: [{ lv: 1, move: 'leafLash' }, { lv: 9, move: 'bloomDrain' }],
  },
  sparklet: {
    id: 'sparklet', name: 'Sparklet', element: 'Volt', quilt: true,
    desc: 'A lavender storm-cloud plush. Static hair, literally.',
    base: { hp: 22, atk: 9, def: 5, spd: 11 }, xpYield: 35, rarity: 2, ability: 'overload',
    learn: [{ lv: 1, move: 'sparkJolt' }, { lv: 6, move: 'staticField' }],
  },
  voltail: {
    id: 'voltail', name: 'Voltail', element: 'Volt', quilt: true,
    desc: 'Sage-green cat-thing with a segmented lightning tail. Knits itself when scared.',
    base: { hp: 24, atk: 10, def: 6, spd: 10 }, xpYield: 38, rarity: 3, ability: 'overload',
    learn: [{ lv: 1, move: 'sparkJolt' }, { lv: 8, move: 'thunderPelea' }],
  },
  tidepup: {
    id: 'tidepup', name: 'Tidepup', element: 'Tide', quilt: true,
    desc: 'A loyal puddle-pup that refills itself from any basin.',
    base: { hp: 26, atk: 8, def: 7, spd: 8 }, xpYield: 32, rarity: 1, ability: 'riposte',
    learn: [{ lv: 1, move: 'bubbleFlick' }, { lv: 7, move: 'tideMend' }],
  },
  bubblet: {
    id: 'bubblet', name: 'Bubblet', element: 'Tide', quilt: true,
    desc: 'Round, soft, buoyant. Three opinions, zero of them yours.',
    base: { hp: 29, atk: 6, def: 9, spd: 5 }, xpYield: 33, rarity: 2, ability: 'bulwark',
    learn: [{ lv: 1, move: 'bubbleFlick' }, { lv: 9, move: 'brineWave' }],
  },
  gloomoth: {
    id: 'gloomoth', name: 'Gloomoth', element: 'Gloom', quilt: true,
    desc: 'Moth-shaped quilt that lands on your shoulder and lowers the lamps.',
    base: { hp: 23, atk: 9, def: 6, spd: 9 }, xpYield: 35, rarity: 2, ability: 'dread',
    learn: [{ lv: 1, move: 'gloomSpore' }, { lv: 8, move: 'mothCinder' }],
  },
  shadewhisp: {
    id: 'shadewhisp', name: 'Shadewhisp', element: 'Gloom', quilt: true,
    desc: 'Half plush, half rumour. The stitching is entirely rumour.',
    base: { hp: 22, atk: 10, def: 5, spd: 10 }, xpYield: 37, rarity: 3, ability: 'dread',
    learn: [{ lv: 1, move: 'nightCreep' }, { lv: 9, move: 'hexBloom' }],
  },

  // ---- MONSPEC1: Quilt Edition (Manus animation sheets) ----
  pyrelamb: {
    id: 'pyrelamb', name: 'Pyrelamb', element: 'Ember', quiltAnim: true,
    desc: 'A little lamb of embers. Baa sounds like a fireplace.',
    base: { hp: 25, atk: 9, def: 6, spd: 8 }, xpYield: 33, rarity: 2, ability: 'kindle',
    learn: [{ lv: 1, move: 'emberDart' }, { lv: 7, move: 'cinderRoar' }],
  },
  ashwing: {
    id: 'ashwing', name: 'Ashwing', element: 'Ember', quiltAnim: true,
    desc: 'Grey-winged and grim. Where it lands, the campfire relights.',
    base: { hp: 24, atk: 10, def: 5, spd: 10 }, xpYield: 36, rarity: 2, ability: 'kindle',
    learn: [{ lv: 1, move: 'mothCinder' }, { lv: 8, move: 'cinderRoar' }],
  },
  mosskip: {
    id: 'mosskip', name: 'Mosskip', element: 'Verdant', quiltAnim: true,
    desc: 'Hops between stones; wherever it lands, moss follows.',
    base: { hp: 23, atk: 7, def: 7, spd: 11 }, xpYield: 31, rarity: 1, ability: 'bulwark',
    learn: [{ lv: 1, move: 'leafLash' }, { lv: 6, move: 'mossVeil' }],
  },
  brambletusk: {
    id: 'brambletusk', name: 'Brambletusk', element: 'Verdant', quiltAnim: true,
    desc: 'A boar quilted from brambles. Charging is its only diplomacy.',
    base: { hp: 32, atk: 10, def: 9, spd: 4 }, xpYield: 39, rarity: 3, ability: 'riposte',
    learn: [{ lv: 1, move: 'leafLash' }, { lv: 9, move: 'bloomDrain' }],
  },
  zipfinch: {
    id: 'zipfinch', name: 'Zipfinch', element: 'Volt', quiltAnim: true,
    desc: 'Smaller than the sound it makes. Twice as loud as both.',
    base: { hp: 20, atk: 8, def: 4, spd: 13 }, xpYield: 33, rarity: 1, ability: 'overload',
    learn: [{ lv: 1, move: 'sparkJolt' }],
  },
  thunderhare: {
    id: 'thunderhare', name: 'Thunderhare', element: 'Volt', quiltAnim: true,
    desc: 'Its thump is a tiny thunderclap. Rabbits everywhere are suspicious.',
    base: { hp: 24, atk: 9, def: 6, spd: 12 }, xpYield: 37, rarity: 3, ability: 'overload',
    learn: [{ lv: 1, move: 'sparkJolt' }, { lv: 8, move: 'thunderPelea' }],
  },
  brinebell: {
    id: 'brinebell', name: 'Brinebell', element: 'Tide', quiltAnim: true,
    desc: 'Tolls a wet bell when the tide turns. Nobody asked the tide.',
    base: { hp: 27, atk: 7, def: 9, spd: 6 }, xpYield: 34, rarity: 2, ability: 'bulwark',
    learn: [{ lv: 1, move: 'bubbleFlick' }, { lv: 9, move: 'glacierTide' }],
  },
  moonseal: {
    id: 'moonseal', name: 'Moonseal', element: 'Tide', quiltAnim: true,
    desc: 'Balances a full moon on its nose. The moon allows this.',
    base: { hp: 29, atk: 8, def: 8, spd: 7 }, xpYield: 38, rarity: 3, ability: 'riposte',
    learn: [{ lv: 1, move: 'tideMend' }, { lv: 8, move: 'brineWave' }],
  },
  duskowl: {
    id: 'duskowl', name: 'Duskowl', element: 'Gloom', quiltAnim: true,
    desc: 'Blinks once per sunset. The sunset always loses the stare.',
    base: { hp: 25, atk: 9, def: 7, spd: 8 }, xpYield: 36, rarity: 2, ability: 'dread',
    learn: [{ lv: 1, move: 'nightCreep' }, { lv: 8, move: 'duskRequiem' }],
  },
  shadehare: {
    id: 'shadehare', name: 'Shadehare', element: 'Gloom', quiltAnim: true,
    desc: 'A hare cut from the shadow of a bigger hare.',
    base: { hp: 22, atk: 10, def: 5, spd: 11 }, xpYield: 35, rarity: 2, ability: 'dread',
    learn: [{ lv: 1, move: 'gloomSpore' }, { lv: 7, move: 'nightCreep' }],
  },
};

export const SPECIES_LIST = Object.keys(SPECIES);

// Wild encounter tables per zone id (weight).
export const WILD_TABLES = {
  moss:   [['leaflet', 4], ['mosskip', 3], ['tidepup', 3], ['bubblet', 3], ['thornbloom', 2], ['brinebell', 2], ['moonseal', 1], ['sparklet', 1]],
  cliff:  [['magmoth', 0.02], ['embercub', 4], ['pyrelamb', 3], ['cinderwing', 3], ['ashwing', 2], ['sparklet', 2], ['voltail', 2], ['zipfinch', 2], ['thunderhare', 1]],
  temple: [['nocturne', 0.012], ['gloomoth', 4], ['shadewhisp', 3], ['duskowl', 2], ['shadehare', 2], ['brambletusk', 2], ['leaflet', 1]],
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
