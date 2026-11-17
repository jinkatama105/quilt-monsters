// team.js — the player's party, inventory, stat growth and capture logic.
import { SPECIES, MOVES, movesForSpecies } from './data.js?v=6';
import { PARTY_MAX, XP_CURVE, STAT_GROWTH, CAPTURE } from './config.js?v=6';
import { roll } from './random.js?v=6';

/** Build a fresh creature instance from a species id + level. */
export function makeCreature(speciesId, level) {
  const sp = SPECIES[speciesId];
  const stats = statsAtLevel(sp, level);
  const moves = movesForSpecies(sp, level).map((key) => ({ key, pp: MOVES[key].pp }));
  return {
    species: speciesId,
    nickname: sp.name,
    level,
    xp: 0,
    xpNext: XP_CURVE(level),
    stats,
    hp: stats.hp,
    moves,
    focused: false,
  };
}

export function statsAtLevel(sp, level) {
  const g = 1 + STAT_GROWTH * (level - 1);
  return {
    hp: Math.round(sp.base.hp * g),
    atk: Math.round(sp.base.atk * g),
    def: Math.round(sp.base.def * g),
    spd: Math.round(sp.base.spd * g),
  };
}

/** Award xp; returns list of events [{kind:'level'|'move', ...}] for the battle log. */
export function giveXp(creature, amount) {
  const events = [];
  creature.xp += amount;
  while (creature.xp >= creature.xpNext) {
    creature.xp -= creature.xpNext;
    creature.level += 1;
    creature.xpNext = XP_CURVE(creature.level);
    const old = creature.stats;
    creature.stats = statsAtLevel(SPECIES[creature.species], creature.level);
    creature.hp += creature.stats.hp - old.hp; // growing heals the deficit
    events.push({ kind: 'level', level: creature.level });
    const sp = SPECIES[creature.species];
    for (const l of sp.learn) {
      if (l.lv === creature.level && !creature.moves.some((m) => m.key === l.move)) {
        creature.moves.push({ key: l.move, pp: MOVES[l.move].pp });
        if (creature.moves.length > 4) creature.moves.shift();
        events.push({ kind: 'move', move: MOVES[l.move].name });
      }
    }
  }
  return events;
}

/** Capture chance for a wild creature — rises as its HP drops; bosses resist hard. */
export function captureChance(target) {
  const hpFrac = Math.max(0, target.hp / target.stats.hp);
  const sp = SPECIES[target.species];
  const base = sp.boss ? 0.04 : CAPTURE.base;
  const bonus = sp.boss ? 0.2 : CAPTURE.lowHpBonus;
  return Math.max(0.02, base + bonus * (1 - hpFrac));
}

/** Resolve a thrown Seedstone. Returns {caught, shakes}. */
export function attemptCapture(target) {
  const chance = captureChance(target);
  if (!roll(chance)) return { caught: false, shakes: 0 };
  let shakes = 0;
  for (let i = 0; i < CAPTURE.wobblingRolls; i++) {
    if (!roll(0.72)) break;
    shakes += 1;
  }
  if (shakes >= CAPTURE.wobblingRolls - 1) return { caught: true, shakes };
  return { caught: false, shakes };
}

export class TeamManager {
  constructor() {
    this.party = [];
    this.seedstones = 5;
    this.potions = 3;
    this.dexSeen = new Set();
    this.dexCaught = new Set();
    this.captureCount = 0;
  }

  addCreature(creature) {
    if (this.party.length < PARTY_MAX) { this.party.push(creature); return true; }
    return false; // box overflow: stored outside the active party for now
  }

  healPartyHalf() {
    for (const c of this.party) {
      c.hp = Math.max(1, Math.min(c.stats.hp, Math.round((c.hp + c.stats.hp) / 2)));
      for (const m of c.moves) m.pp = MOVES[m.key].pp;
    }
  }

  healPartyFull() {
    for (const c of this.party) {
      c.hp = c.stats.hp;
      for (const m of c.moves) m.pp = MOVES[m.key].pp;
    }
  }

  allFainted() { return this.party.every((c) => c.hp <= 0); }

  firstAlive() { return this.party.find((c) => c.hp > 0) || null; }

  usePotion(creature) {
    if (this.potions <= 0 || creature.hp <= 0) return false;
    this.potions -= 1;
    creature.hp = Math.min(creature.stats.hp, creature.hp + Math.round(creature.stats.hp * 0.4));
    return true;
  }

  useSeedstone() {
    if (this.seedstones <= 0) return false;
    this.seedstones -= 1;
    return true;
  }

  markSeen(speciesId) { this.dexSeen.add(speciesId); }
  markCaught(speciesId) { this.dexSeen.add(speciesId); this.dexCaught.add(speciesId); }

  serialize() {
    return {
      party: this.party,
      seedstones: this.seedstones,
      potions: this.potions,
      dexSeen: [...this.dexSeen],
      dexCaught: [...this.dexCaught],
      captureCount: this.captureCount,
    };
  }

  static restore(data) {
    const t = new TeamManager();
    if (!data) return t;
    t.party = data.party || [];
    t.seedstones = data.seedstones ?? 5;
    t.potions = data.potions ?? 3;
    t.dexSeen = new Set(data.dexSeen || []);
    t.dexCaught = new Set(data.dexCaught || []);
    t.captureCount = data.captureCount || 0;
    return t;
  }
}
