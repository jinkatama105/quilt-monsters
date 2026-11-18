// battle.js — the turn-based battle engine: initiative, moves, accuracy, type
// matchups, drains/focus, AI choices, capture, flee, xp and mission resolution.
import { SPECIES, MOVES, matchup } from './data.js?v=run5';
import { FLEE_BASE } from './config.js?v=run5';
import { makeCreature, giveXp, attemptCapture } from './team.js?v=run5';
import { roll, rint } from './random.js?v=run5';

export class Battle {
  /** kind: 'wild' | 'boss' ; mission is set for boss battles. */
  constructor(playerCreature, enemyCreature, kind, mission = null) {
    this.player = playerCreature;
    this.enemy = enemyCreature;
    this.kind = kind;
    this.mission = mission;
    this.log = [{ text: `A wild ${enemyCreature.nickname} blocks the path!`, sfx: 'encounter' }];
    this.phase = 'choose';     // choose -> resolve -> end/win/lose/caught/fled
    this.turn = 0;
    this.fx = null;            // {kind:'hit'|'heal'|'miss'|'capture', target, t}
    this.captured = false;
    this.fled = false;
    this.enemyDefeated = false;
    this.xpGained = 0;
    this.levelEvents = [];
  }

  say(text, sfx = null) { this.log.push({ text, sfx }); if (this.log.length > 8) this.log.shift(); }

  pushFx(kind, target) { this.fx = { kind, target, t: 0.55 }; }

  // ------------------------------------------------------------- player actions
  /** The main loop calls this with the player's decision, then step() advances animations. */
  playerAction(action) {
    if (this.phase !== 'choose') return false;
    this.pending = action;
    this.phase = 'resolve';
    this.order = this.initiative();
    this.resolveTurn();
    return true;
  }

  initiative() {
    const p = this.player.stats.spd + rint(0, 6);
    const e = this.enemy.stats.spd + rint(0, 6);
    return p >= e ? ['player', 'enemy'] : ['enemy', 'player'];
  }

  resolveTurn() {
    for (const actor of this.order) {
      if (this.phase === 'end') break;
      if (actor === 'player') this.doPlayerTurn();
      else this.doEnemyTurn();
    }
    this.turn += 1;
    if (this.phase === 'resolve') this.phase = 'choose';
  }

  doPlayerTurn() {
    const a = this.pending;
    if (a.type === 'move') this.useMove(this.player, this.enemy, a.moveKey, 'player');
    else if (a.type === 'potion') {
      if (this.team.usePotion(this.player)) { this.say(`${this.player.nickname} drinks — mossbitter and warm. HP restored.`, 'heal'); this.pushFx('heal', 'player'); }
      else this.say('No potions left!', 'buzzer');
    } else if (a.type === 'capture') {
      if (!this.team.useSeedstone()) { this.say('Out of Seedstones!', 'buzzer'); return; }
      this.say('The Seedstone glints and opens…', 'throw');
      const res = attemptCapture(this.enemy);
      if (res.caught) {
        this.say(`${this.enemy.nickname} is bound to the seed! Captured!`, 'capture');
        this.captured = true; this.phase = 'end';
      } else {
        this.say(`It broke free after ${res.shakes + 1} wobble${res.shakes ? 's' : ''}!`, 'buzzer');
        this.pushFx('miss', 'enemy');
      }
    } else if (a.type === 'flee') {
      if (this.kind === 'boss') { this.say('The Tribus will not let you leave!', 'buzzer'); return; }
      const chance = FLEE_BASE + (this.player.stats.spd - this.enemy.stats.spd) * 0.02;
      if (roll(chance)) { this.say('You slip away into the brush.', 'flee'); this.fled = true; this.phase = 'end'; }
      else this.say('No escape — it bars the way!', 'buzzer');
    } else if (a.type === 'switch') {
      const next = a.creature;
      this.player = next; this.player.focused = false;
      this.say(`Stand tall, ${next.nickname}!`, 'heal');
    }
  }

  doEnemyTurn() {
    if (this.enemy.hp <= 0 || this.player.hp <= 0) return;
    const usable = this.enemy.moves.filter((m) => m.pp > 0);
    if (usable.length === 0) { this.say(`${this.enemy.nickname} flails without strength!`, 'buzzer'); return; }
    // simple AI: prefer the move that types best against the player
    let best = usable[0], bestScore = -1;
    for (const m of usable) {
      const def = MOVES[m.key];
      const score = def.power * matchup(def.element, SPECIES[this.player.species].element) + roll() * 12;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    this.useMove(this.enemy, this.player, best.key, 'enemy');
  }

  useMove(attacker, defender, moveKey, side) {
    if (attacker.hp <= 0) return;
    const entry = attacker.moves.find((m) => m.key === moveKey);
    if (!entry) return;
    if (entry.pp <= 0) { this.say(`${attacker.nickname} has no charges of ${MOVES[moveKey].name}!`, 'buzzer'); return; }
    entry.pp -= 1;
    const mv = MOVES[moveKey];
    if (roll(mv.accuracy)) {
      if (mv.power > 0) {
        const atkSp = SPECIES[attacker.species].element;
        const defSp = SPECIES[defender.species].element;
        const eff = matchup(atkSp, defSp);
        const stab = atkSp === mv.element ? 1.25 : 1;
        let atk = attacker.stats.atk * (attacker.focused ? 1.6 : 1);
        attacker.focused = false;
        const dmg = Math.max(1, Math.round((mv.power * stab * atk) / (defender.stats.def * 2) * (0.85 + roll() * 0.2)));
        defender.hp = Math.max(0, defender.hp - dmg);
        this.pushFx('hit', side === 'player' ? 'enemy' : 'player');
        let note = `${attacker.nickname} uses ${mv.name} — ${dmg} damage`;
        if (eff > 1) note += ' (super effective!)';
        else if (eff < 1) note += ' (resisted)';
        this.say(note + '.', 'hit');
        if (mv.effect === 'drain') {
          const healed = Math.max(1, Math.round(dmg * 0.35));
          attacker.hp = Math.min(attacker.stats.hp, attacker.hp + healed);
          this.say(`${attacker.nickname} drinks the light (+${healed}).`, 'heal');
        }
      } else {
        this.pushFx('heal', side);
        if (mv.effect === 'heal') {
          const healed = Math.round(attacker.stats.hp * 0.4);
          attacker.hp = Math.min(attacker.stats.hp, attacker.hp + healed);
          this.say(`${attacker.nickname} weaves ${mv.name} (+${healed} HP).`, 'heal');
        } else if (mv.effect === 'focus') {
          attacker.focused = true;
          this.say(`${attacker.nickname} focuses — the next strike will burn brighter.`, 'focus');
        }
      }
    } else {
      this.pushFx('miss', side === 'player' ? 'enemy' : 'player');
      this.say(`${attacker.nickname}'s ${mv.name} misses!`, 'miss');
    }
    this.checkEnd();
  }

  checkEnd() {
    if (this.enemy.hp <= 0 && this.phase !== 'end') {
      this.enemyDefeated = true;
      this.say(`${this.enemy.nickname} is beaten!`, 'victory-hit');
      this.awardXp();
      this.phase = 'end';
    } else if (this.player.hp <= 0 && this.phase !== 'end') {
      const alive = this.team.firstAlive();
      if (alive) {
        this.say(`${this.player.nickname} falls… ${alive.nickname} takes the field!`, 'heal');
        this.player = alive;
      } else {
        this.say('The whole team is spent…', 'defeat');
        this.phase = 'end';
      }
    }
  }

  awardXp() {
    const sp = SPECIES[this.enemy.species];
    this.xpGained = Math.round(sp.xpYield * (this.enemy.level / 6 + 1));
    this.say(`${this.player.nickname} gains ${this.xpGained} XP.`, 'xp');
    this.levelEvents = giveXp(this.player, this.xpGained);
    for (const ev of this.levelEvents) {
      if (ev.kind === 'level') this.say(`${this.player.nickname} rose to level ${ev.level}!`, 'levelup');
      if (ev.kind === 'move') this.say(`It learned ${ev.move}!`, 'levelup');
    }
  }

  // attach the team after construction (capture/potion actions need it)
  bindTeam(team) { this.team = team; team.markSeen(this.enemy.species); }
}

/** Factory used by the main loop for wild encounters and mission bosses. */
export function startBattle(team, enemy, kind, mission) {
  const player = team.firstAlive();
  const battle = new Battle(player, enemy, kind, mission);
  battle.bindTeam(team);
  if (kind === 'boss') {
    battle.log = [{ text: `${enemy.nickname.toUpperCase()}, Tribus of the ${mission.zone === 'temple' ? 'Shrine' : mission.zone === 'cliff' ? 'Bluff' : 'Spring'} — the ground holds its breath.`, sfx: 'encounter' }];
  }
  return battle;
}
