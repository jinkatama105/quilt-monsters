// main.js — bootstrap: canvas, loop, and the state machine that ties screens,
// world, battles, HUD, audio and autosave together.
import { VIEW_W, VIEW_H, PARTY_MAX, DEFEAT_PENALTY_ITEMS } from './config.js';
import { SPECIES, MISSIONS } from './data.js';
import { Input } from './input.js';
import { World } from './world.js';
import { TeamManager, makeCreature } from './team.js';
import { startBattle } from './battle.js';
import { drawField, drawBattle, Particles, battleAnchors } from './render.js';
import { drawFieldHud } from './hud.js';
import { drawTitle, drawCodex, drawVictory, drawDefeat, titleButtonRect, battleButtons, battleAction, victoryScore } from './screens.js';
import { playMusic, stopMusic, unlockAudio, setMuted, playSfx } from './audio.js';
import { saveGame, loadGame, canSave } from './save.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W; canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const particles = new Particles();

const params = new URLSearchParams(location.search);
const debugMode = sessionStorage.getItem('vs-debug') || params.get('debug') || '';

const state = {
  mode: 'title',              // title | field | battle | codex | victory | defeat
  world: new World(),
  team: startingTeam(),
  battle: null,
  submenu: null,
  busy: 0,                    // battle animation pause
  t: 0,
  stats: { time: 0, encounters: 0, wins: 0 },
  missions: {},
  muted: false,
  lostNote: '',
  lastSfx: {},
  autosaveT: 0,
  result: null,
};
window.__vs = state; // debug hook
window.__vsHooks = { startEncounterBattle, makeCreature, newGame, respawnInMeadow, victoryScore };

function startingTeam() {
  const team = new TeamManager();
  team.addCreature(makeCreature('emberling', 5));
  team.addCreature(makeCreature('tidrel', 4));
  return team;
}

// ---------------------------------------------------------------- start paths
function newGame() {
  state.world = new World();
  state.team = startingTeam();
  state.stats = { time: 0, encounters: 0, wins: 0 };
  state.mode = 'field';
  state.world.setNotice('Moss Meadow — walk the grass, find the Tribus');
  playMusic('moss');
}

function continueGame() {
  const saved = loadGame();
  if (!saved || saved.team.party.length === 0) return newGame();
  state.team = saved.team;
  state.world = saved.world;
  state.stats = saved.stats;
  state.missions = saved.missions || {};
  state.mode = 'field';
  state.world.setNotice('Welcome back, ranger');
  playMusic(state.world.zoneId);
}

function debugStart() {
  // ?debug=win|battle|codex — jump straight to a screen for clean screenshots.
  unlockAudio();
  if (debugMode === 'win') {
    state.result = { time: 312, steps: 486, captures: 7, wins: 3 };
    state.mode = 'victory'; playSfx('victory'); playMusic('title');
  } else if (debugMode === 'codex') {
    for (const id of Object.keys(SPECIES)) { state.team.dexSeen.add(id); }
    ['emberling', 'verdanom', 'tidrel', 'gloomcap'].forEach((id) => state.team.dexCaught.add(id));
    state.mode = 'codex'; playMusic('title');
  } else if (debugMode === 'battle') {
    newGame();
    state.team.markSeen('verdanom');
    startEncounterBattle(makeCreature('verdanom', 7), 'wild');
    playMusic('cliff');
  } else if (debugMode === 'defeat') {
    state.lostNote = 'Seedstones scattered';
    state.mode = 'defeat';
  } else if (debugMode === 'continue' || debugMode === 'resume') {
    continueGame();
  } else if (debugMode === 'title') {
    playMusic('title');
  } else if (debugMode === 'field') {
    newGame();
  }
}

function startEncounterBattle(enemy, kind, mission = null) {
  if (!state.team.firstAlive()) return;
  state.battle = startBattle(state.team, enemy, kind, mission);
  state.battle._kind = kind; state.battle._mission = mission; state.battle._zone = state.world.zoneId;
  state.mode = 'battle';
  state.submenu = null;
  state.busy = 0;
  state.stats.encounters += 1;
  playSfx('encounter');
}

// ---------------------------------------------------------------- update
function update(dt) {
  state.t += dt;
  if (state.mode === 'field' || state.mode === 'battle') state.stats.time += dt;

  if (input.hit('m')) { state.muted = !state.muted; setMuted(state.muted); }

  switch (state.mode) {
    case 'title': {
      if (debugMode && debugMode !== 'title') break;
      const r = titleButtonRect();
      const start = input.hit('enter') || input.hit(' ') || input.inRect(r.x, r.y, r.w, r.h);
      if (start) {
        unlockAudio(); playSfx('menu');
        if (canSave() && loadGame()) continueGame(); else newGame();
      }
      break;
    }
    case 'field': updateField(dt); break;
    case 'battle': updateBattle(dt); break;
    case 'codex': {
      const back = input.hit('c') || input.hit('escape') || input.inRect(VIEW_W / 2 - 90, VIEW_H - 66, 180, 44);
      if (back) { playSfx('menu'); state.mode = state.battle ? 'battle' : 'field'; }
      break;
    }
    case 'victory': {
      const r = { x: VIEW_W / 2 - 130, y: VIEW_H - 60, w: 260, h: 46 };
      if (input.hit('enter') || input.inRect(r.x, r.y, r.w, r.h)) {
        playSfx('menu');
        sessionStorage.removeItem('vs-debug');
        newGame();
      }
      break;
    }
    case 'defeat': {
      if (input.hit('enter') || input.inRect(VIEW_W / 2 - 160, 400, 320, 50)) {
        playSfx('menu');
        respawnInMeadow();
      }
      break;
    }
  }

  particles.update(dt);

  // autosave every 6s of play
  if (state.mode === 'field') {
    state.autosaveT += dt;
    if (state.autosaveT > 6) { state.autosaveT = 0; saveGame(state); }
  }
  input.endFrame();
}

function updateField(dt) {
  state.world.update(dt);
  if (input.hit('c')) { playSfx('menu'); state.mode = 'codex'; return; }
  // HUD buttons
  if (input.inRect(VIEW_W - 150, VIEW_H - 66, 136, 44)) { playSfx('menu'); state.mode = 'codex'; return; }
  if (input.inRect(VIEW_W - 274, VIEW_H - 66, 114, 44)) {
    state.muted = !state.muted; setMuted(state.muted); playSfx('menu'); return;
  }
  const mv = input.moveVector();
  if (mv) {
    const res = state.world.onStepResult(mv);
    if (res) handleFieldEvent(res);
  }
  if (input.mouse.clicked) {
    const cam = fieldCamera();
    const evt = state.world.clickAt(input.mouse.x + cam.x, input.mouse.y + cam.y, state.team);
    if (evt) playSfx('pickup');
  }
}

// World.tryMove returns step events now; wire it here.
World.prototype.onStepResult = function (mv) {
  if (this.moving > 0) return null;
  const nx = this.px + mv.dx, ny = this.py + mv.dy;
  const target = this.tileAt(nx, ny);
  if (target === 6 /* EXIT_E */) { this.changeZone(1); playSfx('menu'); return null; }
  if (target === 7 /* EXIT_W */) { this.changeZone(-1); playSfx('menu'); return null; }
  if (this.blocked(nx, ny)) return null;
  this.px = nx; this.py = ny;
  this.moving = 0.13;
  playSfx('step');
  return this.onStep(target);
};

function fieldCamera() {
  const TILE = 40, VIEW_W2 = 1280, VIEW_H2 = 800, MAPW = 40, MAPH = 26;
  const camX = Math.max(0, Math.min(MAPW * TILE - VIEW_W2, state.world.px * TILE + TILE / 2 - VIEW_W2 / 2));
  const camY = Math.max(0, Math.min(MAPH * TILE - VIEW_H2, state.world.py * TILE + TILE / 2 - VIEW_H2 / 2));
  return { x: camX, y: camY };
}

function handleFieldEvent(res) {
  if (!res) return;
  if (res.kind === 'wild') {
    startEncounterBattle(makeCreature(res.speciesId, res.level), 'wild');
  } else if (res.kind === 'boss') {
    startEncounterBattle(makeCreature(res.mission.key, 14), 'boss', res.mission);
  }
}

function updateBattle(dt) {
  const b = state.battle;
  if (!b) { state.mode = 'field'; return; }
  if (b.fx) { b.fx.t -= dt; if (b.fx.t <= 0) b.fx = null; }

  // fire any queued sfx lines from the log
  const last = b.log[b.log.length - 1];
  if (last && last.sfx && state.lastSfx.text !== last.text) {
    state.lastSfx = { text: last.text };
    playSfx(last.sfx);
    if (last.sfx === 'hit') {
      const a = battleAnchors();
      particles.spawn(last.target === 'enemy' ? a.enemy.x : a.player.x, (last.target === 'enemy' ? a.enemy.y : a.player.y), '#ffd27a', 16);
    }
  }

  if (state.busy > 0) { state.busy -= dt; return; }

  if (b.phase === 'end') { finishBattle(b); return; }

  if (input.hit('c')) { state.mode = 'codex'; return; }

  if (state.submenu === 'moves' || state.submenu === 'switch') {
    const buttons = battleMenuButtons(b);
    const clicked = buttons.find((btn) => input.inRect(btn.x, btn.y, btn.w, btn.h));
    if (clicked) {
      playSfx('menu');
      if (clicked.id === 'back') { state.submenu = null; return; }
      if (clicked.id.startsWith('move:')) { act(b, { type: 'move', moveKey: clicked.id.slice(5) }); state.submenu = null; }
      else if (clicked.id.startsWith('switch:')) {
        const target = state.team.party[Number(clicked.id.slice(7))];
        if (target && target.hp > 0) act(b, { type: 'switch', creature: target });
        state.submenu = null;
      }
    }
    return;
  }

  const buttons = battleButtons(b, state.team, null);
  const clicked = buttons.find((btn) => input.inRect(btn.x, btn.y, btn.w, btn.h));
  if (!clicked) return;
  playSfx('menu');
  if (clicked.id === 'moves') state.submenu = 'moves';
  else if (clicked.id === 'switch') state.submenu = 'switch';
  else act(b, battleAction(clicked.id, b, state.team));
}

function battleMenuButtons(b) {
  const x0 = 200, y0 = VIEW_H - 130;
  if (state.submenu === 'moves') {
    const btns = b.player.moves.map((m, i) => ({
      id: 'move:' + m.key, x: x0 + (i % 2) * 250, y: y0 + Math.floor(i / 2) * 56, w: 236, h: 46,
      label: m.key,
    }));
    btns.push({ id: 'back', x: 700, y: y0 + 56, w: 140, h: 46, label: 'back' });
    return btns;
  }
  // switch menu: party slots that are alive and not active; star = type advantage vs enemy
  const enemyEl = SPECIES[b.enemy.species].element;
  const bestIdx = state.team.party.reduce((best, c, i) => {
    if (c.hp <= 0 || c === b.player) return best;
    const score = Math.max(...c.moves.map(m => {
      const mv = MOVES_TABLE[m.key]; return mv ? matchup(SPECIES[c.species].element, enemyEl) * (mv.power || 30) : 0;
    }));
    return (!best || score > best.score) ? { i, score } : best;
  }, null);
  const btns = state.team.party.map((c, i) => ({
    id: 'switch:' + i, x: x0 + i * 190, y: y0 + 28, w: 176, h: 46,
    label: c.hp > 0 ? (bestIdx && bestIdx.i === i ? `${c.nickname} L${c.level} *` : `${c.nickname} L${c.level}`) : 'fainted',
  }));
  btns.push({ id: 'back', x: x0 + 3 * 190, y: y0 + 28, w: 140, h: 46, label: 'back' });
  return btns;
}

function act(battle, action) {
  if (!action) return;
  battle.playerAction(action);
  // animate: hold the resolution briefly so hits read on screen
  state.busy = 1.15;
  const anchors = battleAnchors();
  if (action.type === 'capture') particles.spawn(anchors.enemy.x, anchors.enemy.y, '#5fd36a', 22);
}

function finishBattle(b) {
  const wasBoss = b.kind === 'boss';
  const mission = b.mission;
  state.battle = null;
  state.submenu = null;
  const anchors = battleAnchors();

  if (b.captured) {
    state.team.markCaught(b.enemy.species);
    state.team.captureCount += 1;
    if (state.team.party.length < PARTY_MAX) state.team.addCreature(b.enemy);
    worldMessage(`${b.enemy.nickname} joins your cause!`);
    playSfx('capture');
    settleMission(b, wasBoss, mission);
    state.mode = 'field';
  } else if (b.enemyDefeated) {
    state.stats.wins += 1;
    worldMessage(`${b.enemy.nickname} is beaten!`);
    settleMission(b, wasBoss, mission);
    if (b._mission && b._mission.key === 'nocturne') {
      state.result = { time: state.stats.time, steps: state.world.steps, captures: state.team.captureCount, wins: state.stats.wins };
      state.mode = 'victory';
      stopMusic(); playSfx('victory');
      saveGame(state);
      return;
    }
    state.mode = 'field';
  } else if (b.fled) {
    state.mode = 'field';
  } else if (state.team.allFainted()) {
    state.lostNote = `${Math.min(DEFEAT_PENALTY_ITEMS, state.team.seedstones)} Seedstones scattered`;
    state.team.seedstones = Math.max(0, state.team.seedstones - DEFEAT_PENALTY_ITEMS);
    state.mode = 'defeat';
    stopMusic(); playSfx('defeat');
  } else {
    state.mode = 'field';
  }
  saveGame(state);
  playMusic(state.world.zoneId);
}

function settleMission(b, wasBoss, mission) {
  if (!wasBoss || !mission) return;
  state.world.bossDefeated[mission.zone] = true;
  worldMessage(`${mission.name} — mission settled!`);
}

function worldMessage(text) { state.world.setNotice(text); }

function respawnInMeadow() {
  state.world.zoneId = 'moss';
  state.world.px = 3; state.world.py = 13;
  state.team.healPartyHalf();
  state.mode = 'field';
  state.world.setNotice('You wake in Moss Meadow, humbled');
  playMusic('moss');
  saveGame(state);
}

// ---------------------------------------------------------------- draw
function draw() {
  ctx.fillStyle = '#0b0f0d'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  switch (state.mode) {
    case 'title': drawTitle(ctx, state.t); break;
    case 'field':
      drawField(ctx, state.world, state.t);
      drawFieldHud(ctx, state, state.t);
      particles.draw(ctx);
      break;
    case 'battle':
      drawBattle(ctx, state.battle, state.t, particles);
      drawBattleSceneHud(state.battle);
      break;
    case 'codex': drawCodex(ctx, state.team, state.t); break;
    case 'victory': drawVictory(ctx, state.result || { time: 0, steps: 0, captures: 0, wins: 0 }, state.t); break;
    case 'defeat': drawDefeat(ctx, state, state.t); break;
  }
}

function drawBattleSceneHud(b) {
  // lazy import cycle avoider: hud already loaded via import below
  hudDrawBattleHud(ctx, b, state, state.t, activeBattleButtons(b), hoveredButton(activeBattleButtons(b)));
}

import { drawBattleHud as hudDrawBattleHud } from './hud.js';
import { MOVES as MOVES_TABLE } from './data.js';

function activeBattleButtons(b) {
  if (state.submenu === 'moves') {
    return b.player.moves.map((m, i) => ({
      id: 'move:' + m.key, label: MOVES_TABLE[m.key].name, sub: `${MOVES_TABLE[m.key].element} · PP ${m.pp}`,
      x: 200 + (i % 2) * 250, y: VIEW_H - 130 + Math.floor(i / 2) * 56, w: 236, h: 46,
    })).concat([{ id: 'back', label: '‹ BACK', x: 700, y: VIEW_H - 74, w: 140, h: 46 }]);
  }
  if (state.submenu === 'switch') {
    const btns = state.team.party.map((c, i) => ({
      id: 'switch:' + i, label: c.hp > 0 ? c.nickname : 'fainted', sub: `L${c.level} ${c.hp}/${c.stats.hp}`,
      x: 200 + i * 190, y: VIEW_H - 102, w: 176, h: 46,
    }));
    btns.push({ id: 'back', label: '‹ BACK', x: 200 + 3 * 190, y: VIEW_H - 102, w: 140, h: 46 });
    return btns;
  }
  return battleButtons(b, state.team, null);
}

function hoveredButton(buttons) {
  const m = input.mouse;
  const b = buttons.find((btn) => m.x >= btn.x && m.x <= btn.x + btn.w && m.y >= btn.y && m.y <= btn.y + btn.h);
  return b ? b.id : null;
}

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

if (debugMode) debugStart();
else { playMusic('title'); }
requestAnimationFrame(frame);
