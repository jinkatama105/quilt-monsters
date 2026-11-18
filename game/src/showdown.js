// showdown.js — realtime auto-battler engine (team-formation idler genre).
// Two squads (player left, wild/boss right) stand in 2-row x 3-col formations.
// Combat runs itself: every unit charges an action bar (speed-dependent);
// when it fills, the unit strikes the weakest enemy. Passive abilities proc.
// The player steers only: pause / fast-forward, throw a Seedstone to capture,
// or flee. Aggregate team HP bars sit top-centre, exactly like the reference.
import { VIEW_W, VIEW_H, PALETTE, ELEMENT_COLORS, CAPTURE } from './config.js?v=run2';
import { SPECIES, MOVES, matchup, ABILITIES, abilityForSpecies } from './data.js?v=run2';
import { makeCreature, giveXp } from './team.js?v=run2';
import { drawCreature, drawQuilt, loadQuiltImg } from './art.js?v=run2';
import { battleBg, drawBattleBg } from './bg.js?v=run2';
import { panel, roundRect } from './hud.js?v=run2';

const R = () => Math.random();

// Ghibli PNG loader (own cache, smaller draw size for squad members)
const artCache = new Map();
const HAS_ART = new Set(['cindermot','duskfin','emberling','embersnail','frostcap','gelundra','gloomling','magmoth','mossbeak','nocturne','stormpup','thornback','verdanom','voltip','peblite']);
function unitArt(ctx, speciesId, cx, cy, pose, size, t = 0, flip = false) {
  if (drawQuilt(ctx, speciesId, cx, cy, pose, size, t, flip)) return true;
  if (!HAS_ART.has(speciesId)) return false;
  let img = artCache.get(speciesId);
  if (img === undefined) {
    img = new Image();
    img.onerror = () => artCache.set(speciesId, false);
    img.onload = () => artCache.set(speciesId, img);
    img.src = `assets/world/ghibli-${speciesId}-512.png`;
    artCache.set(speciesId, img);
  }
  if (!img || img === false || !img.naturalWidth) return false;
  ctx.save();
  ctx.translate(cx, cy);
  if (flip) ctx.scale(-1, 1);
  if (pose === 'defeat') { ctx.globalAlpha = 0.45; ctx.translate(0, size * 0.12); }
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(0, size * 0.42, size * 0.4, size * 0.08, 0, 0, 7); ctx.fill();
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
  return true;
}

export class Unit {
  constructor(creature, side, slot, leader = false) {
    this.c = creature;
    this.side = side;           // 'player' | 'enemy'
    this.slot = slot;           // 0..5 (grid position)
    this.leader = leader;
    this.charge = 0;            // 0..1 action bar
    this.alive = true;
    this.scared = false;        // dread proc: skipped next action
    this.fx = null;             // {kind:'attack'|'hurt', t}
    this.skillFx = null;        // {kind:<ability>, t} — quilt skill flash
    this.koFx = null;           // {t} — KO pop/fade timer (set by faint)
    this.ability = creature.ability || abilityForSpecies(SPECIES[creature.species]) || null;
    this.kindle = false;        // set by an ally's kindle at battle start
  }
  get sp() { return SPECIES[this.c.species]; }
  get maxHp() { return this.c.stats.hp; }
  get hp() { return this.c.hp; }
  get interval() { return Math.max(1.6, 5.2 - this.c.stats.spd * 0.28); }
}

export class Showdown {
  isShowdown = true;
  constructor(playerUnits, enemyUnits, kind, mission) {
    this.kind = kind;
    this.mission = mission;
    this.zone = (playerUnits[0] && playerUnits[0].battleZone) || 'moss';
    this.units = [];
    playerUnits.forEach((c, i) => this.units.push(new Unit(c, 'player', i)));
    enemyUnits.forEach((c, i) => this.units.push(new Unit(c, 'enemy', i)));
    this.phase = 'vs';          // vs (splash) -> live -> end
    this.vsT = 1.8;
    this.speed = 1;             // 1 | 2 | 4  (pause handled by state.paused)
    this.paused = false;
    this.t = 0;
    this.time = 0;              // battle clock at 1x
    this.pops = [];             // floating combat numbers {x,y,text,color,t,big}
    this.log = [];
    this.winner = null;         // 'player' | 'enemy' | 'captured' | 'fled'
    this.captured = null;       // enemy creature caught
    this.shake = 0;
    this.xpGained = 0;
    this.captureFail = 0;       // wobble animation timer on a caught ball
    this.trinketFx();
    this.kindleCheck();
  }

  /** Run-mode trinket hooks: column_spd (act faster), shield (front monster stacks), burn_on_cast (Ember ticks), multicast (one ally double-strikes). */
  trinketFx() {
    const run = this._run; if (!run) return;
    const has = (type) => run.trinkets.filter((x) => (x.effect || {}).type === type);
    for (const t of has('column_spd')) {
      for (const u of this.squad('player')) if (u.slot < 2) u.intervalMult = 1 - (t.effect.value || 0.15); // right-hand col = front col (slots 0-1) on the left side
    }
    for (const t of has('shield')) {
      const front = this.squad('player').sort((a, b) => a.slot - b.slot)[0];
      if (front) front.c.shield = (front.c.shield || 0) + (t.effect.value || 4);
    }
    this.burnOnCast = has('burn_on_cast').reduce((a, t) => a + (t.effect.value || 2), 0);
    const mc = has('multicast');
    if (mc.length) {
      const pool = this.squad('player').filter((u) => u.alive);
      const pick = pool[Math.floor(R() * pool.length)];
      if (pick) pick.c.multicast = mc.reduce((a, t) => a + (t.effect.value || 1), 0);
    }
  }

  kindleCheck() {
    for (const side of ['player', 'enemy']) {
      const squad = this.squad(side);
      if (squad.some((u) => u.ability === 'kindle' && u.alive)) {
        for (const u of squad) { u.kindle = true; if (u.ability === 'kindle') u.skillFx = { kind: 'kindle', t: 1.0 }; }
        this.pop(VIEW_W / 2, 150, side === 'player' ? 'KINDLE! team ATK +18%' : 'foe KINDLE flares', '#ffd2a1', 2);
      }
    }
  }

  squad(side) { return this.units.filter((u) => u.side === side); }
  aliveSquad(side) { return this.squad(side).filter((u) => u.alive); }
  teamHp(side) {
    const s = this.squad(side);
    return { hp: s.reduce((a, u) => a + Math.max(0, u.hp), 0), max: s.reduce((a, u) => a + u.maxHp, 0) || 1 };
  }

  slotPos(side, slot) {
    // Front column sits nearest the centre; extra columns march backward.
    const col = Math.floor(slot / 2), row = slot % 2;
    const x = side === 'player' ? 560 - col * 180 : 720 + col * 180;
    const y = (row === 0 ? 340 : 545) + (col === 1 ? -12 : 0);
    return { x, y };
  }

  posOf(u) { return this.slotPos(u.side, u.slot); }

  update(dt) {
    this.t += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 6);
    this.pops = this.pops.filter((p) => (p.t -= dt) > 0);
    for (const u of this.units) if (u.koFx && (u.koFx.t -= dt) <= 0) u.koFx = null;
    if (this.captureFail > 0) this.captureFail -= dt;

    if (this.phase === 'vs') {
      this.vsT -= dt;
      if (this.vsT <= 0) this.phase = 'live';
      return;
    }
    if (this.phase !== 'live' || this.paused) return;

    const g = dt * this.speed;
    this.time += g;

    for (const u of this.units) {
      if (u.fx && (u.fx.t -= g) <= 0) u.fx = null;
      if (u.skillFx && (u.skillFx.t -= g) <= 0) u.skillFx = null;
      if (!u.alive || u.scared) { if (u.scared && u.alive) { u.scared = false; u.charge = 0; } continue; }
      u.charge += g / (u.interval * (u.intervalMult || 1));
      if (u.charge >= 1) { u.charge = 0; this.act(u); }
    }

    const pl = this.aliveSquad('player').length, en = this.aliveSquad('enemy').length;
    if (en === 0 || pl === 0) {
      this.phase = 'end';
      this.winner = en === 0 ? 'player' : 'enemy';
      if (en === 0) this.settleXp();
    }
  }

  act(u) {
    const foes = this.aliveSquad(u.side === 'player' ? 'enemy' : 'player');
    if (!foes.length) return;
    foes.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
    // lead with a slight anti-squishy bias: 55% pick the lowest HP fraction
    const target = R() < 0.55 ? foes[0] : foes[Math.floor(R() * foes.length)];
    const moves = u.c.moves.filter((m) => (MOVES[m.key] || {}).pp > 0);
    const dmgMoves = moves.filter((m) => MOVES[m.key].power > 0);
    const pool = dmgMoves.length ? dmgMoves : moves;
    if (!pool.length) return;
    const pick = pool[Math.floor(R() * pool.length)];
    const mv = MOVES[pick.key];
    if (pick.pp !== undefined && mv.power > 0) { if (pick.pp <= 0) return; pick.pp -= 1; }
    u.fx = { kind: 'attack', t: 0.4 };
    const up = this.posOf(u), tp = this.posOf(target);

    if (mv.power === 0) {
      if (mv.effect === 'heal') {
        const own = this.aliveSquad(u.side).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        const healed = Math.round(own.c.stats.hp * 0.3);
        own.c.hp = Math.min(own.c.stats.hp, own.c.hp + healed);
        this.pop(this.posOf(own).x, this.posOf(own).y - 40, `+${healed}`, '#7dffa1', 1.4);
      } else if (mv.effect === 'focus') {
        u.c.focused = true;
        this.pop(up.x, up.y - 40, 'FOCUS', '#ffe14d', 1.2);
      } else if (mv.effect === 'drain') {
        this.strike(u, target, mv, 0.6);
        const healed = Math.max(1, Math.round(this.lastDmg * 0.5));
        u.c.hp = Math.min(u.c.stats.hp, u.c.hp + healed);
        this.pop(up.x, up.y - 46, `+${healed}`, '#7dffa1', 1);
      }
      return;
    }
    this.strike(u, target, mv, 1);
  }

  strike(u, target, mv, mult) {
    const atkEl = u.sp.element, defEl = target.sp.element;
    let eff = matchup(atkEl, defEl);
    // Rainbow Berry: second element also scores — take the better matchup
    if (u.c.element2) eff = Math.max(eff, matchup(u.c.element2, defEl));
    const stab = atkEl === mv.element || u.c.element2 === mv.element ? 1.25 : 1;
    let atk = u.c.stats.atk * (u.c.focused ? 1.6 : 1) * (u.kindle ? 1.18 : 1);
    u.c.focused = false;
    let def = target.c.stats.def * (target.ability === 'bulwark' ? 1.22 : 1);
    let dmg = Math.max(1, Math.round(((mv.power * stab * atk) / (def * 2)) * (0.85 + R() * 0.2) * mult * eff));
    if (u.c.tempDmg) dmg += u.c.tempDmg; // Honey Cake: flat damage per hit (next battle only)
    let crit = false;
    if (u.ability === 'overload' && R() < 0.15) { crit = true; dmg = Math.round(dmg * 1.6); u.skillFx = { kind: 'overload', t: 0.7 }; }
    if (target.ability === 'bulwark' && R() < 0.3) target.skillFx = { kind: 'bulwark', t: 0.7 };
    if (R() < 0.06) dmg = Math.max(1, Math.round(dmg * 0.5)); // graze
    // shield stacks (thimble trinket, trainer/item shields) absorb damage first
    if (target.c.shield > 0) {
      const back = Math.min(target.c.shield, dmg);
      target.c.shield -= back;
      dmg -= back;
      target.shieldFx = back;
    }
    target.c.hp = Math.max(0, target.c.hp - dmg);
    target.fx = { kind: 'hurt', t: 0.35 };
    this.shake = Math.min(1, this.shake + 0.35);
    const tp = this.posOf(target);
    if (target.shieldFx) { this.pop(tp.x, tp.y - 58, `⛨${target.shieldFx}`, '#8ecbff', 1); target.shieldFx = 0; }
    // damage numbers: white normal / yellow big crit, float up + fade in ~600ms
    this.pop(tp.x + (R() * 30 - 15), tp.y - 34, (crit ? '✦' : '') + dmg, crit ? '#ffd24a' : '#ffffff', crit ? 0.9 : 0.6, crit);
    if (eff > 1) this.pop(tp.x, tp.y - 72, 'SUPER!', '#8ef2a0', 1);
    // Ember Thread: ember moves leave a burn tick; trainer bonusBurn adds to any fire attacker
    const burnAmt = (atkEl === 'Ember' ? (this.burnOnCast || 0) : 0) + (u.c.bonusBurn || 0);
    if (burnAmt > 0 && target.alive && mv.power > 0) {
      target.c.hp = Math.max(0, target.c.hp - burnAmt);
      this.pop(tp.x, tp.y - 48, `🔥${burnAmt}`, '#ffb15a', 0.6);
      if (target.c.hp <= 0) this.faint(target);
    }
    // Double Needle: multicast ally repeats the strike once
    if (u.c.multicast > 0 && target.alive && mv.power > 0) {
      u.c.multicast -= 1;
      this.strike(u, target, mv, 0.7);
      this.pop(this.posOf(u).x, this.posOf(u).y - 60, 'DOUBLE!', '#ffe14d', 1.2);
    }

    // dread proc
    if (u.ability === 'dread' && target.alive && R() < 0.18) {
      target.scared = true; target.charge = 0;
      u.skillFx = { kind: 'dread', t: 0.7 };
      this.pop(tp.x, tp.y - 92, 'SCARED', '#c9a1ff', 1);
    }
    // riposte proc
    if (target.alive && target.ability === 'riposte' && R() < 0.25) {
      target.skillFx = { kind: 'riposte', t: 0.7 };
      const back = Math.max(1, Math.round(dmg * 0.4));
      u.c.hp = Math.max(0, u.c.hp - back);
      u.fx = { kind: 'hurt', t: 0.3 };
      const up = this.posOf(u);
      this.pop(up.x, up.y - 40, back, '#ff8ec4', 1);
      if (u.c.hp <= 0) this.faint(u);
    }
    if (target.c.hp <= 0) this.faint(target);
    this.lastDmg = dmg;
  }

  faint(u) {
    u.alive = false; u.charge = 0; u.fx = null; u.koFx = { t: 0.5 };
    const p = this.posOf(u);
    this.pop(p.x, p.y - 30, 'DOWN', '#d8d8d8', 1.4);
  }

  settleXp() {
    const total = this.squad('enemy').reduce((a, u) => a + Math.round(u.sp.xpYield * (u.c.level / 6 + 1)), 0);
    const standing = this.aliveSquad('player');
    this.xpGained = Math.max(4, Math.round(total * 0.5 / Math.max(1, standing.length)));
    for (const u of standing) {
      const evs = giveXp(u.c, this.xpGained);
      for (const ev of evs) if (ev.kind === 'level') this.pop(this.posOf(u).x, this.posOf(u).y - 84, 'LEVEL UP!', '#ffe14d', 1.8);
    }
  }

  pop(x, y, text, color, life = 1, big = life >= 1.4) { this.pops.push({ x, y, text, color, t: life, big }); }

  // ---- player steering -----------------------------------------------------
  toggleSpeed() { this.speed = this.speed >= 4 ? 1 : this.speed * 2; }
  squadOf(side) { return this.squad(side); } // kept for external tools

  tryCapture() {
    // costs one seedstone (checked by the caller); weakest survivor is the target
    const foes = this.aliveSquad('enemy');
    if (!foes.length) return { caught: false };
    foes.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    const t = foes[0];
    const frac = this.teamHp('enemy').hp / this.teamHp('enemy').max;
    const sp = t.sp;
    const base = sp.boss ? 0.04 : CAPTURE.base;
    const bonus = sp.boss ? 0.2 : CAPTURE.lowHpBonus;
    const chance = Math.max(0.02, base + bonus * (1 - frac));
    if (R() >= chance) { this.captureFail = 1.2; this.pop(VIEW_W - 300, 240, 'BROKE FREE!', '#ffb14a', 1.4); return { caught: false }; }
    let shakes = 0;
    for (let i = 0; i < CAPTURE.wobblingRolls; i++) { if (R() < 0.72) shakes += 1; }
    this.captured = t.c;
    this.phase = 'end';
    this.winner = 'captured';
    return { caught: true, shakes };
  }

  tryFlee() {
    if (R() < 0.72) { this.phase = 'end'; this.winner = 'fled'; return true; }
    this.pop(VIEW_W / 2, VIEW_H / 2, 'NO ESCAPE!', '#ff8a6a', 1.4);
    return false;
  }
}

/** Build a showdown from the team: player deploys every alive party member (max 6). */
export function startShowdown(team, enemySquad, kind, mission, zoneId) {
  const playerUnits = team.party.filter((c) => c.hp > 0).slice(0, 6);
  const enemyUnits = [];
  for (const [speciesId, level] of enemySquad) {
    const c = makeCreature(speciesId, Math.max(1, level));
    c.ability = abilityForSpecies(SPECIES[speciesId]);
    enemyUnits.push(c);
  }
  // formation: pull the strongest to the front slots
  enemyUnits.sort((a, b) => (SPECIES[b.species].boss ? 1 : 0) - (SPECIES[a.species].boss ? 1 : 0) || b.stats.atk - a.stats.atk);
  const sd = new Showdown(playerUnits, enemyUnits, kind, mission);
  sd.zone = zoneId || 'moss';
  team.markSeen && enemySquad.forEach(([id]) => team.markSeen(id));
  return sd;
}

// ---------------------------------------------------------------- drawing
export function drawShowdown(ctx, sd, t) {
  const { VIEW_W: W, VIEW_H: H } = { VIEW_W, VIEW_H };
  if (sd.zone && drawBattleBg(ctx, sd.zone, W, H)) { /* painted backdrop */ }
  else {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#dff3fb'); bg.addColorStop(1, '#fff3c4');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  }

  if (sd.phase === 'vs') { drawVsCard(ctx, sd); return; }

  // arena floor band
  ctx.fillStyle = 'rgba(91,70,54,.12)';
  ctx.fillRect(0, 260, W, 340);

  const shakeX = sd.shake > 0 ? Math.sin(t * 70) * 4 * sd.shake : 0;
  ctx.save(); ctx.translate(shakeX, 0);

  for (const u of sd.units) {
    const p = sd.posOf(u);
    const size = u.leader || u.sp.boss ? 150 : 118;
    const pose = !u.alive ? 'defeat' : u.fx && u.fx.kind === 'attack' ? 'attack' : u.fx && u.fx.kind === 'hurt' ? 'hurt' : 'idle';
    const flip = u.side === 'enemy'; // enemies face left toward the player; player faces right
    // attack lunge: ~40px toward the target, out in ~120ms then back (fx lasts 0.4s)
    let bounced = 0;
    if (pose === 'attack' && u.fx) {
      const prog = 1 - u.fx.t / 0.4;
      const k = prog < 0.3 ? prog / 0.3 : 1 - (prog - 0.3) / 0.7;
      bounced = (u.side === 'player' ? 1 : -1) * 40 * Math.max(0, k);
    }
    // hurt shake: small jitter while the hit lands
    const jx = pose === 'hurt' ? (Math.random() * 6 - 3) : 0;
    const jy = pose === 'hurt' ? (Math.random() * 4 - 2) : 0;
    const drawX = p.x + bounced + jx, drawY = p.y + jy;
    // cast glow behind the attacker
    if (pose === 'attack' && u.fx) {
      const gk = Math.max(0, u.fx.t / 0.4);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * gk;
      ctx.fillStyle = ELEMENT_COLORS[u.sp.element].glow;
      ctx.beginPath(); ctx.ellipse(drawX, drawY, size * 0.72, size * 0.55, 0, 0, 7); ctx.fill(); ctx.restore();
    }
    // KO pop + fade: scale up to ~1.2x, then settle with a burst ring
    let koScale = 1, koAlpha = 1;
    if (u.koFx) {
      const kp = 1 - u.koFx.t / 0.5;
      koScale = kp < 0.3 ? 1 + 0.2 * (kp / 0.3) : 1.2 - 0.2 * ((kp - 0.3) / 0.7);
      koAlpha = kp < 0.3 ? 1 : 1 - 0.55 * ((kp - 0.3) / 0.7);
    }
    ctx.save();
    ctx.translate(drawX, drawY); ctx.scale(koScale, koScale); ctx.globalAlpha = koAlpha;
    if (!unitArt(ctx, u.c.species, 0, 0, pose, size, t, flip)) {
      ctx.scale((size / 160) * (flip ? -1 : 1), size / 160);
      drawCreature(ctx, u.c.species, 0, 0, t + u.slot * 3, pose);
    }
    ctx.restore();
    // KO burst ring (expands + fades during the settle phase)
    if (u.koFx) {
      const kp = 1 - u.koFx.t / 0.5;
      if (kp >= 0.3) {
        const bk = (kp - 0.3) / 0.7;
        ctx.save(); ctx.globalAlpha = 0.6 * (1 - bk);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, size * (0.4 + bk * 0.7), 0, 7); ctx.stroke(); ctx.restore();
      }
    }
    // white hit-flash while the hurt fx is fresh (first ~150ms)
    if (pose === 'hurt' && u.fx) {
      const flash = Math.max(0, (u.fx.t - 0.2) / 0.15);
      if (flash > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * flash;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, size * 0.55, size * 0.5, 0, 0, 7); ctx.fill(); ctx.restore();
      }
    }

    // skill effect flash (Monspec1 quilt FX)
    if (u.skillFx) {
      const img = loadQuiltImg('fx:' + u.skillFx.kind, `assets/quilt/skill-${u.skillFx.kind}.png`);
      if (img && img !== false && img.naturalWidth) {
        const k = Math.max(0, Math.min(1, u.skillFx.t / 0.7));
        const grow = 1 + (1 - k) * 0.35;
        const fs = size * 1.5 * grow;
        ctx.save();
        ctx.globalAlpha = 0.85 * k;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(img, p.x - fs / 2, p.y - fs / 2, fs, fs);
        ctx.restore();
      }
    }

    // nameplate + level + hp pip + charge bar
    ctx.save();
    ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3;
    ctx.strokeText(`Lv.${u.c.level}`, p.x, p.y - size * 0.62);
    ctx.fillText(`Lv.${u.c.level}`, p.x, p.y - size * 0.62);
    if (u.ability) {
      ctx.fillStyle = '#2e9e8f';
      ctx.strokeText(ABILITIES[u.ability].name.toUpperCase(), p.x, p.y - size * 0.62 - 14);
      ctx.fillText(ABILITIES[u.ability].name.toUpperCase(), p.x, p.y - size * 0.62 - 14);
    }
    // per-unit hp bar
    const bw = size * 0.86;
    const hpf = u.maxHp ? u.hp / u.maxHp : 0;
    ctx.fillStyle = 'rgba(59,44,23,.85)'; roundRect(ctx, p.x - bw / 2, p.y + size * 0.52, bw, 8, 4); ctx.fill();
    if (hpf > 0) {
      ctx.fillStyle = hpf > 0.5 ? PALETTE.hpGood : hpf > 0.22 ? PALETTE.hpMid : PALETTE.hpBad;
      roundRect(ctx, p.x - bw / 2 + 1, p.y + size * 0.52 + 1, (bw - 2) * hpf, 6, 3); ctx.fill();
    }
    // charge bar
    if (u.alive) {
      ctx.fillStyle = 'rgba(59,44,23,.85)'; roundRect(ctx, p.x - bw / 2, p.y + size * 0.52 + 12, bw, 6, 3); ctx.fill();
      const el = ELEMENT_COLORS[u.sp.element];
      ctx.fillStyle = u.charge >= 1 ? '#ffffff' : el.main;
      roundRect(ctx, p.x - bw / 2 + 1, p.y + size * 0.52 + 13, (bw - 2) * Math.min(1, u.charge), 4, 2); ctx.fill();
    }
    if (u.scared) { ctx.font = '20px monospace'; ctx.fillText('❔', p.x + size * 0.4, p.y - size * 0.4); }
    ctx.restore();
  }

  // capture wobble effect
  if (sd.captureFail > 0) {
    const foes = sd.aliveSquad('enemy');
    if (foes.length) {
      const p = sd.posOf(foes[0]);
      ctx.strokeStyle = ELEMENT_COLORS.Verdant.main; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, 46 + Math.sin(sd.captureFail * 30) * 8, 0, 7); ctx.stroke();
    }
  }

  // floating numbers
  for (const pop of sd.pops) {
    const rise = (1 - Math.min(1, pop.t)) * 26;
    ctx.save();
    ctx.globalAlpha = Math.min(1, pop.t * 2);
    ctx.font = `bold ${pop.big ? 26 : 20}px monospace`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 5;
    ctx.strokeText(pop.text, pop.x, pop.y - rise);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, pop.x, pop.y - rise);
    ctx.restore();
  }
  ctx.restore();
}

function drawVsCard(ctx, sd) {
  const W = VIEW_W, H = VIEW_H;
  const k = Math.min(1, (1.8 - sd.vsT) * 3);
  ctx.fillStyle = '#0b0f0d'; ctx.fillRect(0, 0, W, H);
  // diagonal split: player colour left, enemy colour right
  const pc = ELEMENT_COLORS[SPECIES[sd.units.find(u=>u.side==='player')?.c.species || 'emberling'].element];
  const es = sd.units.find(u=>u.side==='enemy');
  const ec = ELEMENT_COLORS[es ? SPECIES[es.c.species].element : 'Gloom'];
  ctx.save(); ctx.translate(W / 2, 0); ctx.rotate(-0.12);
  ctx.fillStyle = pc.dark; ctx.fillRect(-W / 2 - 80, -100, W / 2 + 80, H + 200);
  ctx.fillStyle = ec.dark; ctx.fillRect(0, -100, W / 2 + 80, H + 200);
  // speed lines
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = i % 2 ? ec.main : pc.main;
    ctx.fillRect(-W / 2 - 60 + ((i * 97 + sd.t * 900) % (W / 2)), 60 + i * 52, 180, 5);
    ctx.fillRect(((i * 133 + W / 2) % (W / 2)) , 90 + i * 48, 180, 5);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // side rosters
  const drawSide = (side, x, dir) => {
    const list = sd.squad(side);
    list.forEach((u, i) => {
      const p = { x: x + dir * (i % 3) * 120, y: 300 + Math.floor(i / 3) * 180 };
      ctx.save(); ctx.globalAlpha = k;
      if (!unitArt(ctx, u.c.species, p.x, p.y, 'idle', 100, sd.t, side === 'enemy')) {
        ctx.translate(p.x, p.y); ctx.scale(0.7 * (side === 'enemy' ? -1 : 1), 0.7); drawCreature(ctx, u.c.species, 0, 0, sd.t, 'idle');
      }
      ctx.restore();
    });
    ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#e8f2e4';
    ctx.fillText(side === 'player' ? 'YOUR SQUAD' : 'WILD SQUAD', x + dir * 110, 520);
  };
  ctx.save(); ctx.globalAlpha = k; drawSide('player', 250, 1); drawSide('enemy', W - 250, -1); ctx.restore();
  // VS stamp
  ctx.save();
  ctx.translate(W / 2, H / 2 - 60);
  const s = 0.3 + k * 0.95 + (sd.vsT < 0.5 ? (0.5 - sd.vsT) * 0.4 : 0);
  ctx.scale(s, s);
  ctx.font = 'bold 110px monospace'; ctx.textAlign = 'center';
  const vg = ctx.createLinearGradient(0, -60, 0, 30);
  vg.addColorStop(0, '#ffe14d'); vg.addColorStop(1, '#ff7a2f');
  ctx.lineWidth = 14; ctx.strokeStyle = '#fff'; ctx.strokeText('VS', 0, 0);
  ctx.fillStyle = vg; ctx.fillText('VS', 0, 0);
  ctx.restore();
  if (sd.mission) {
    ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd2a1';
    ctx.fillText(sd.mission.name.toUpperCase(), VIEW_W / 2, 120);
  }
}

// ---------------------------------------------------------------- HUD
export function showdownButtons(sd) {
  const btns = [
    { id: 'pause', label: sd.paused ? '▶' : '❚❚', x: VIEW_W / 2 - 96, y: 14, w: 44, h: 40 },
    { id: 'ff', label: sd.speed >= 4 ? '4×' : sd.speed + '×', x: VIEW_W / 2 + 52, y: 14, w: 44, h: 40 },
  ];
  if (sd.phase === 'live' || sd.phase === 'vs') {
    if (!sd._run) { // quilt run battles: 100% automated, no capture/flee
      btns.push({ id: 'capture', label: 'CAPTURE', x: VIEW_W - 190, y: VIEW_H - 66, w: 170, h: 46 });
      btns.push({ id: 'flee', label: 'FLEE', x: 20, y: VIEW_H - 66, w: 130, h: 46 });
    }
    btns.push({ id: 'codex', label: 'CODEX', x: VIEW_W / 2 - 70, y: VIEW_H - 66, w: 140, h: 46 });
  }
  return btns;
}

export function drawShowdownHud(ctx, sd, team) {
  if (sd.phase === 'vs') return;
  const W = VIEW_W;
  // team HP bars (aggregate), like the reference layout
  const drawBar = (side, x, label) => {
    const th = sd.teamHp(side);
    const w = 340;
    panel(ctx, x, 66, w + 76, 46, 0.88);
    ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = side === 'enemy' ? '#ff9d6a' : '#8ef2a0';
    ctx.fillText(label, x + 12, 95);
    const f = th.hp / th.max;
    ctx.fillStyle = 'rgba(6,10,6,.9)'; roundRect(ctx, x + 60, 78, w, 22, 8); ctx.fill();
    ctx.fillStyle = f > 0.5 ? PALETTE.hpGood : f > 0.22 ? PALETTE.hpMid : PALETTE.hpBad;
    if (f > 0) { roundRect(ctx, x + 62, 80, (w - 4) * f, 18, 7); ctx.fill(); }
    ctx.fillStyle = '#e8f2e4'; ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(th.hp)}/${th.max}`, x + w + 66, 95);
  };
  drawBar('player', 40, 'HP');
  drawBar('enemy', W - 456, 'HP');

  // speed / pause controls
  const isPaused = sd.paused;
  panel(ctx, W / 2 - 120, 8, 240, 50, 0.85);
  for (const b of [showdownButtons(sd)[0], showdownButtons(sd)[1]]) {
    ctx.fillStyle = b.id === 'pause' && isPaused ? '#ffe14d' : 'rgba(255,255,255,.08)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = b.id === 'ff' ? '#ff7a6a' : '#e8f2e4';
    ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 6);
  }
  ctx.fillStyle = isPaused ? '#ffb14a' : '#9fd8c8';
  ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
  ctx.fillText(isPaused ? 'PAUSED' : ['NORMAL', 'FAST FORWARD', '×4 FRENZY'][Math.log2(sd.speed)], W / 2, 54);

  // unit counters (backpack-style numbers top corners)
  const pl = sd.aliveSquad('player').length, en = sd.aliveSquad('enemy').length;
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'left'; ctx.fillStyle = '#8ef2a0';
  ctx.fillText(`⬤ ${pl} UNITS   ✿ ${team.seedstones}`, 40, 46);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ff9d6a';
  ctx.fillText(`${en} FOES ⬤`, W - 40, 46);

  // action buttons bottom
  const btns = showdownButtons(sd).filter((b) => b.id !== 'pause' && b.id !== 'ff');
  for (const b of btns) {
    const label = b.id === 'capture' ? `CAPTURE ✿${team.seedstones}` : b.label;
    panel(ctx, b.x, b.y, b.w, b.h, 0.9);
    ctx.fillStyle = b.id === 'capture' ? '#ffe14d' : b.id === 'flee' ? '#ff8a6a' : '#e8f2e4';
    ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 6);
  }

  if (sd.phase === 'end') {
    ctx.fillStyle = 'rgba(6,10,6,.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.font = 'bold 44px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = sd.winner === 'player' ? '#8ef2a0' : sd.winner === 'captured' ? '#ffe14d' : sd.winner === 'fled' ? '#9fd8c8' : '#ff8a6a';
    const txt = sd.winner === 'player' ? 'VICTORY!' : sd.winner === 'captured' ? 'CAUGHT!' : sd.winner === 'fled' ? 'ESCAPED' : 'DEFEATED…';
    ctx.fillText(txt, VIEW_W / 2, VIEW_H / 2 - 6);
    if (sd.winner === 'player' && sd.xpGained) {
      ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#e8f2e4';
      ctx.fillText(`+${sd.xpGained} XP to every standing unit`, VIEW_W / 2, VIEW_H / 2 + 34);
    }
    ctx.font = '14px monospace'; ctx.fillStyle = '#9fb8a6';
    ctx.fillText('click to continue', VIEW_W / 2, VIEW_H / 2 + 62);
  }
}
