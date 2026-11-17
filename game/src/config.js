// config.js — global tuning constants and the palette every module shares.
export const VIEW_W = 1280;
export const VIEW_H = 800;

export const TILE = 40;                 // field tile size in world pixels
export const PARTY_MAX = 3;             // creatures carried at once
export const MOVES_SHOWN = 4;           // moves a creature can bring to battle

export const ENCOUNTER_CHANCE = 0.16;   // per step in tall grass
export const HIDDEN_ITEM_CHANCE = 0.05; // per step: a sparkle appears
export const FLEE_BASE = 0.55;          // flee chance against wild creatures

export const CAPTURE = {
  base: 0.18,        // floor chance with full HP
  lowHpBonus: 0.72,  // extra chance at near-zero HP
  seedstoneBonus: 0.06,
  wobblingRolls: 3,  // shakes before the seedstone settles
};

export const XP_CURVE = (level) => 12 + level * level * 4; // xp needed to reach level+1
export const STAT_GROWTH = 0.055; // per level multiplier on base stats

export const DEFEAT_PENALTY_ITEMS = 1; // lost seedstones when the party falls

export const PALETTE = {
  ink: '#0b0f0d',
  paper: '#e8f2e4',
  panel: '#152420',
  panelEdge: '#3b5a47',
  shadow: 'rgba(0,0,0,.45)',
  hpGood: '#57d27a',
  hpMid: '#e6c84a',
  hpBad: '#e0564a',
  ember: '#ff8a3c',
  verdant: '#5fd36a',
  volt: '#ffe14d',
  tide: '#5fc8e8',
  gloom: '#a05fe0',
};

export const ELEMENT_COLORS = {
  Ember: { main: '#ff8a3c', glow: '#ffd2a1', dark: '#8f2f10' },
  Verdant: { main: '#5fd36a', glow: '#c9f5c0', dark: '#1c5e2c' },
  Volt: { main: '#ffe14d', glow: '#fff7c2', dark: '#7a6410' },
  Tide: { main: '#5fc8e8', glow: '#d5f2fb', dark: '#155b70' },
  Gloom: { main: '#a05fe0', glow: '#e3c8ff', dark: '#3a1560' },
};

export const ZONES = [
  { id: 'moss', name: 'Moss Meadow', bg: '#18311f', accent: '#5fd36a', music: 0 },
  { id: 'cliff', name: 'Cinder Bluff', bg: '#30160c', accent: '#ff8a3c', music: 1 },
  { id: 'temple', name: 'Gloom Shrine', bg: '#1c1230', accent: '#a05fe0', music: 2 },
];
