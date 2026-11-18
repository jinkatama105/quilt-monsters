// main.js — bootstrap: canvas, loop, and the state machine that ties screens,
// world, battles, HUD, audio and autosave together.
import { VIEW_W, VIEW_H, TILE, PARTY_MAX, DEFEAT_PENALTY_ITEMS } from './config.js?v=run9';
import { SPECIES, MISSIONS, matchup } from './data.js?v=run9';
import { Input } from './input.js?v=run9';
import { World } from './world.js?v=run9';
import { TeamManager, makeCreature } from './team.js?v=run9';
import { startBattle } from './battle.js?v=run9';
import { startShowdown, drawShowdown, drawShowdownHud, showdownButtons, Showdown as SHOWDOWN_CLASS } from './showdown.js?v=run9';
import { openDraft, draftButtons, doMerge, commitDraft, drawDraft } from './draft.js?v=run9';
import { wildSquad, bossSquad } from './data.js?v=run9';
import { makeRoad, drawRoad, roadFrontier, roadEnter, roadDone, roadInstant, nodeRect, roadMusic, zoneForCol } from './road.js?v=run9';
import { makeRun, restoreRun, serializeRun, drawRun, hitRun, loadData as loadRunData, chooseTrainer, buy, sell, rollShop, freeRerolls, autoMerge, stageReward, nextDay, makeOpponent, applyPassive, runSnapshot, TRAINERS_BY_ID } from './run.js?v=run9';

// Showdown mode (realtime auto-battler) is the default
// battle engine. Append ?classic=1 to the URL (or set localStorage
// vs-classic='1') to fall back to the old turn-based duel. See README.
const SHOWDOWN = !/classic=1/.test(location.search) && localStorage.getItem('vs-classic') !== '1';

import { drawField, drawBattle, Particles, battleAnchors } from './render.js?v=run9';
import { drawFieldHud, panel } from './hud.js?v=run9';
import { PALETTE } from './config.js?v=run9';
function roundRectC(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
// ?v busts stale browser copies (old screens.js served from disk cache, max-age 4h era)
import { drawTitle, drawCodex, drawVictory, drawDefeat, titleButtonRect, battleButtons, battleAction, victoryScore, codexNavRects, codexGetPage, codexSetPage, codexPageCount } from './screens.js?v=run9';
import { playMusic, stopMusic, unlockAudio, setMuted, playSfx } from './audio.js?v=run9';
import { saveGame, loadGame, canSave } from './save.js?v=run9';
const ROAD = !/classic=1/.test(location.search) && localStorage.getItem('vs-classic') !== '1';
// Day-loop roguelike (Batomon/SAP style) — the newest shell; ?road=1 falls back
// to the quilt node map, ?classic=1 to the old field game.
const RUN = ROAD && !/road=1/.test(location.search) && localStorage.getItem('vs-mode') !== 'road';

const canvas = document.getElementById('game');
canvas.width = VIEW_W; canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const particles = new Particles();

const params = new URLSearchParams(location.search);
const debugMode = sessionStorage.getItem('vs-debug') || params.get('debug') || '';

const state = {
  mode: 'title',              // title | road | field | battle | codex | victory | defeat
  codexFrom: null,            // v3: origin mode saved when the Codex opens; close returns here
  world: new World(),
  road: null,                 // The Quilt Road node-map (run shell)
  roadPending: null,          // node index that started the current battle
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
  team.addCreature(makeCreature('embercub', 5));
  team.addCreature(makeCreature('leaflet', 4));
  return team;
}

// ---------------------------------------------------------------- start paths
function newGame() {
  if (RUN) {
    state.world = state.world || new World();
    state.team = state.team || startingTeam();
    state.run = makeRun((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
    state.mode = 'run';
    playMusic('title');
    saveGame(state);
    return;
  }
  if (ROAD) {
    state.road = makeRoad((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
    state.mode = 'road';
    playMusic('moss');
    saveGame(state);
    return;
  }
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
  if (RUN) {
    state.run = saved.run ? restoreRun(saved.run) : makeRun(((saved.stats?.time || 0) * 7919 + 20261118) >>> 0);
    if (state.run.phase === 'battle') state.run.phase = 'shop';
    state.mode = 'run';
    playMusic('title');
    return;
  }
  if (ROAD) {
    // old field-mode saves get wrapped into the quilt run; party & items carry over
    state.road = saved.road || makeRoad(((saved.stats?.time || 0) * 7919 + 20261118) >>> 0);
    state.mode = 'road';
    playMusic(roadMusic(state.road));
    return;
  }
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
    ['embercub', 'leaflet', 'gloomoth', 'tidepup'].forEach((id) => state.team.dexCaught.add(id));
    state.mode = 'codex'; playMusic('title');
  } else if (debugMode === 'battle') {
    newGame();
    state.team.markSeen('magmoth');
    startEncounterBattle(makeCreature('magmoth', 7), 'wild');
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
  } else if (debugMode === 'road') {
    state.road = makeRoad(20261118);
    state.mode = 'road'; playMusic('moss');
  }
}

function startEncounterBattle(enemy, kind, mission = null) {
  if (!state.team.firstAlive()) return;
  if (SHOWDOWN && !state._draftDone) {
    // draft first: pick squad / merge before the battle actually starts
    state.pendingBattle = { enemy, kind, mission };
    state.draft = openDraft(state.team);
    state.mode = 'draft';
    state.submenu = null;
    playSfx('menu');
    return;
  }
  state._draftDone = false;
  if (SHOWDOWN) {
    // squad-vs-squad auto battle. `enemy` is the lead creature; escorts are rolled.
    const zone = state.world.zoneId;
    const avgLv = Math.round(state.team.party.reduce((a, c) => a + c.level, 0) / Math.max(1, state.team.party.filter((c) => c.hp > 0).length));
    const baseLv = kind === 'boss' ? enemy.level : Math.min(enemy.level, avgLv + 1);
    const squad = kind === 'boss'
      ? bossSquad(enemy.species, enemy.level, mission ? mission.zone : zone)
      : wildSquad(zone, baseLv);
    if (kind !== 'boss') squad[0] = [enemy.species, enemy.level];
    const aliveN = state.team.party.filter((c) => c.hp > 0).length;
    if (kind !== 'boss' && squad.length > aliveN) squad.length = aliveN; // wild never outnumbers your squad
    const sd = startShowdown(state.team, squad, kind, mission, zone);
    if (!sd || !sd.squad('player').length) {
      state.world.setNotice('Your squad needs healing first.');
      state.mode = 'field';
      return;
    }
    state.battle = sd;
    state.battle._kind = kind; state.battle._mission = mission; state.battle._zone = zone;
    state.mode = 'battle';
    state.submenu = null;
    state.stats.encounters += 1;
    playSfx('encounter');
    return;
  }
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
    case 'draft': updateDraft(); break;
    case 'road': updateRoad(); break;
    case 'run': updateRun(); break;
    case 'field': updateField(dt); break;
    case 'battle': updateBattle(dt); break;
    case 'codex': {
      // v7: paged Codex — PREV/NEXT flip pages (edge-triggered click via
      // inRect, so holding the mouse cannot flip more than one page).
      const nav = codexNavRects();
      if (input.inRect(nav.prev.x, nav.prev.y, nav.prev.w, nav.prev.h) && codexGetPage() > 0) { playSfx('menu'); codexSetPage(codexGetPage() - 1); }
      else if (input.inRect(nav.next.x, nav.next.y, nav.next.w, nav.next.h) && codexGetPage() < codexPageCount() - 1) { playSfx('menu'); codexSetPage(codexGetPage() + 1); }
      const back = input.hit('c') || input.hit('escape') || input.inRect(VIEW_W / 2 - 90, VIEW_H - 66, 180, 44);
      // v3: return to where the Codex was opened from (was: battle/road/field guess —
      // closing from the shop dumped the player into the Leafpine overworld).
      if (back) { playSfx('menu'); state.mode = state.codexFrom || (state.battle ? 'battle' : (state.road && ROAD ? 'road' : 'field')); state.codexFrom = null; }
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
  if (input.hit('c')) { playSfx('menu'); state.codexFrom = 'field'; state.mode = 'codex'; return; }
  // HUD buttons
  if (input.inRect(VIEW_W - 150, VIEW_H - 66, 136, 44)) { playSfx('menu'); state.codexFrom = 'field'; state.mode = 'codex'; return; }
  if (input.inRect(VIEW_W - 274, VIEW_H - 66, 114, 44)) {
    state.muted = !state.muted; setMuted(state.muted); playSfx('menu'); return;
  }
  // dialog open: Enter/click advances or closes
  if (state.dialog) {
    if (input.hit('enter') || input.hit(' ') || input.mouse.clicked) {
      playSfx('menu');
      if (state.dialog.npc.shop && state.dialog.line === state.dialog.npc.lines.length - 1) {
        if (state.team.seedstones >= 2) { state.team.seedstones -= 2; state.team.potions += 1; state.world.setNotice('Purchased a Mossdra Potion.'); }
        else state.world.setNotice('Not enough Seedstones.');
      }
      state.dialog.line += 1;
      if (state.dialog.line >= state.dialog.npc.lines.length) state.dialog = null;
    }
    return;
  }
  if (input.hit('enter') || input.hit(' ')) {
    const evt = state.world.interact();
    if (evt && evt.kind === 'talk') { playSfx('menu'); state.dialog = { npc: evt.npc, line: 0 }; return; }
  }
  const mv = input.moveVector();
  if (mv) {
    const res = state.world.tryMove(mv.dx, mv.dy);
    if (res) handleFieldEvent(res);
  }
  if (input.mouse.clicked && !state.dialog) {
    const cam = fieldCamera();
    const evt = state.world.clickAt(input.mouse.x + cam.x, input.mouse.y + cam.y, state.team);
    if (evt) playSfx('pickup');
  }
}

function updateDraft() {
  const d = state.draft;
  if (!d) { state.mode = 'field'; return; }
  const btns = draftButtons(d);
  // smaller buttons win over the full-card sel: hitbox they sit inside
  const clicked = input.mouse.clicked ? (btns.find((b) => !b.id.startsWith('sel:') && input.inRect(b.x, b.y, b.w, b.h)) || btns.find((b) => b.id.startsWith('sel:') && input.inRect(b.x, b.y, b.w, b.h))) : null;
  if (!clicked && input.hit('escape')) { state.draft = null; state.pendingBattle = null; state.mode = state.road && ROAD ? 'road' : 'field'; playSfx('menu'); return; }
  if (!clicked) return;
  if (clicked.id.startsWith('sel:')) {
    const i = +clicked.id.slice(4);
    const at = d.sel.indexOf(i);
    if (at >= 0) d.sel.splice(at, 1);
    else if (d.sel.length < 6 && d.pool[i].hp > 0) d.sel.push(i);
    playSfx('menu');
  } else if (clicked.id.startsWith('merge:')) {
    const s = doMerge(d, +clicked.id.slice(6), state.team);
    if (s) { playSfx('heal'); state.world.setNotice(`${s.nickname} fused — ★${'★'.repeat(s.stars - 1)}!`); }
  } else if (clicked.id === 'auto') {
    d.sel = d.pool.map((c, i) => ({ c, i })).filter(({ c }) => c.hp > 0)
      .sort((a, b) => b.c.level - a.c.level).slice(0, 6).map(({ i }) => i);
    playSfx('menu');
  } else if (clicked.id === 'deploy') {
    if (!d.sel.length) { state.world.setNotice('Pick at least one monster.'); return; }
    commitDraft(state.team, d);
    const pb = state.pendingBattle; state.draft = null; state._draftDone = true;
    startEncounterBattle(pb.enemy, pb.kind, pb.mission);
  } else if (clicked.id === 'cancel') {
    state.draft = null; state.pendingBattle = null; state.mode = state.road && ROAD ? 'road' : 'field'; playSfx('menu');
  }
}

function updateRoad() {
  const road = state.road;
  if (!road) { newGame(); return; }
  if (input.hit('c')) { playSfx('menu'); state.codexFrom = 'road'; state.mode = 'codex'; return; }
  const front = roadFrontier(road);
  let chosen = -1;
  for (let k = 0; k < 3 && k < front.length; k++) if (input.hit(String(k + 1))) chosen = front[k];
  if (chosen < 0 && input.mouse.clicked) {
    for (const i of front) { const r = nodeRect(i, road); if (input.inRect(r.x, r.y, r.w, r.h)) { chosen = i; break; } }
  }
  if (chosen < 0) return;
  playSfx('menu');
  const ev = roadEnter(road, chosen);
  if (ev.kind === 'battle') {
    state.roadPending = chosen;
    startEncounterBattle(makeCreature(ev.enemyId, ev.level), ev.boss ? 'boss' : 'wild', ev.boss ? MISSIONS.find((m) => m.key === ev.enemyId) : null);
    return;
  }
  const res = roadInstant(road, chosen, state.team);
  if (res && res.kind === 'battle') { // mystery ambush
    state.roadPending = chosen;
    startEncounterBattle(makeCreature(res.enemyId, res.level), 'wild');
    return;
  }
  if (res) { state.world.setNotice(res); playSfx('pickup'); }
  if (road.spools <= 0) { state.lostNote = 'The last spool snapped'; state.mode = 'defeat'; stopMusic(); playSfx('defeat'); return; }
  saveGame(state);
}

// ---------------------------------------------------------------- quilt run (Batomon day loop)
function updateRun() {
  const run = state.run;
  if (!run) { newGame(); return; }

  // battle phase delegates to the showdown scene (state.battle._run set)
  if (run.phase === 'battle') return;

  if (input.hit('c')) { playSfx('menu'); state.codexFrom = 'run'; state.mode = 'codex'; return; }
  if (!input.mouse.clicked && !input.hit('enter')) return;

  const id = hitRun(run, input.mouse) || (input.hit('enter') ? (run.phase === 'shop' && run.board.length ? 'battle' : run.phase === 'reward' ? 'nextday' : null) : null);
  if (!id) return;
  playSfx('menu');

  if (id.startsWith('trainer:')) { unlockAudio(); chooseTrainer(run, id.slice(8)); saveGame(state); return; }
  if (id.startsWith('buy:')) { const err = buy(run, Number(id.slice(4))); if (err) run._msg = err; else { run._msg = null; if (run.mergeTrinketPending && run.mergeTrinkets) autoMerge(run); } saveGame(state); return; }
  if (id.startsWith('board:')) { const err = sell(run, Number(id.slice(6))); if (err) run._msg = err; saveGame(state); return; }
  if (id.startsWith('trinket:')) {
    if (run.reward && !run.reward.trinketChosen) { pickTrinketByIndex(run, Number(id.slice(8)), false); run.reward.trinketChosen = true; }
    else pickTrinketByIndex(run, Number(id.slice(8)), true);
    saveGame(state); return;
  }
  if (id === 'reroll') {
    const freeLeft = Math.max(0, freeRerolls(run) - (run._freeUsed || 0)) + (run.voucher || 0);
    const cost = freeLeft > 0 ? 0 : 3;
    if (run.coins < cost) { run._msg = 'not enough coins'; return; }
    run.coins -= cost;
    if (freeLeft > 0) { if (run.voucher > 0) run.voucher -= 1; else run._freeUsed = (run._freeUsed || 0) + 1; } // arcade_coins capped per Day; Voucher consumed on use
    run.mergeTrinkets = null; rollShop(run); saveGame(state); return;
  }
  if (id.startsWith('lock:')) { run.locked = !run.locked; saveGame(state); return; }
  if (id === 'battle') {
    if (!run.board.length) { run._msg = 'buy at least one monster'; return; }
    startRunBattle(run); return;
  }
  if (id === 'nextday') {
    run.mergeTrinkets = null; nextDay(run);
    if (run.phase === 'shop' && !run.locked) rollShop(run);
    saveGame(state); return;
  }
  if (id === 'endless') { run.endless = true; run.day += 1; run.phase = 'shop'; rollShop(run); saveGame(state); return; }
  if (id === 'menu') { state.run = null; state.mode = 'title'; stopMusic(); playMusic('title'); saveGame(state); return; }
}

function pickTrinketByIndex(run, i, isMerge) {
  const list = isMerge ? run.mergeTrinkets : run.reward?.trinkets;
  const t = list && list[i]; if (!t) return;
  run.trinkets.push({ ...t });
  if (isMerge) { run.mergeTrinkets = null; run.mergeTrinketPending = false; }
}

function startRunBattle(run) {
  const opp = makeOpponent(run);
  const playerUnits = run.board.filter((c) => c.hp > 0);
  if (!playerUnits.length) { run.phase = 'shop'; return; }
  applyPassive(run, true, 'battleStart'); // e.g. Bimo: boost before every fight
  if (run.itemShield) { // one-shot shield from shop items: leftmost +HP, consumed now
    const first = playerUnits[0];
    first.stats = { ...first.stats, hp: first.stats.hp + run.itemShield };
    first.hp = first.stats.hp;
    run.itemShield = 0;
  }
  // fresh HP each battle (SAP resets between fights? no — stats persist; heal to full at Day start instead)
  const sd = new SHOWDOWN_CLASS(playerUnits, opp.squad, 'run', null);
  sd.zone = ['moss', 'cliff', 'temple'][run.day % 3];
  sd.opponentName = opp.name;
  sd._run = run;
  sd.trinketFx(); // constructor ran before _run existed; fire trinket hooks now
  state.battle = sd;
  run.phase = 'battle';
  state.mode = 'battle';
  playSfx('encounter'); playMusic('cliff');
}

function finishRunBattle(b) {
  const run = b._run;
  state.battle = null;
  state.mode = 'run';
  const won = b.winner === 'player';
  // Board hp for the next fight (hp ticks are per-run-resource, hearts are the real loss)
  const woolly = run.trinkets.filter((t) => (t.effect || {}).type === 'post_battle_heal');
  for (const c of run.board) {
    c.tempDmg = 0; c.multicast = 0; c.dreadBonus = 0; // Honey Cake / Double Needle / Shadow Spool: next-battle-only effects expire
    // Woolly Charm replaces the full heal with +N (chips persist across battles)
    c.hp = woolly.length ? Math.min(c.stats.hp, c.hp + woolly.reduce((a, t) => a + (t.effect.value || 2), 0)) : c.stats.hp;
  }
  run.board = run.board.filter((c) => c.hp > 0); // KO'd monsters survive (auto-battler: board persists; keep all)
  if (won) applyPassive(run, true);
  stageReward(run, won);
  // v5: carry the battle's level-ups to the reward screen (see settleXp).
  if (b.levelUps && b.levelUps.length) run.reward.levelUps = b.levelUps;
  run.phase = 'reward';
  run.champion = won && run.day >= 10;
  saveGame(state);
  playMusic('title');
}

function fieldCamera() {
  const { w, h } = state.world.dims();
  const camX = Math.max(0, Math.min(w * TILE - VIEW_W, state.world.px * TILE + TILE / 2 - VIEW_W / 2));
  const camY = Math.max(0, Math.min(h * TILE - VIEW_H, state.world.py * TILE + TILE / 2 - VIEW_H / 2));
  return { x: camX, y: camY };
}

function handleFieldEvent(res) {
  if (!res) return;
  if (res.kind === 'wild') {
    startEncounterBattle(makeCreature(res.speciesId, res.level), 'wild');
  } else if (res.kind === 'boss') {
    startEncounterBattle(makeCreature(res.mission.key, 14), 'boss', res.mission);
  } else if (res.kind === 'heal') {
    state.team.healPartyFull();
    playSfx('heal');
    state.world.setNotice('The spring water mends your party.');
  }
}

function updateBattle(dt) {
  const b = state.battle;
  if (!b) { state.mode = 'field'; return; }

  if (b.isShowdown) { updateShowdown(dt); return; }

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

  if (input.hit('c')) { state.codexFrom = 'battle'; state.mode = 'codex'; return; }

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

// ----------------------------------------------------- showdown (auto-battler)
function updateShowdown(dt) {
  const b = state.battle;
  b.update(dt);

  if (input.hit('c')) { state.codexFrom = 'battle'; state.mode = 'codex'; return; }

  if (b.phase === 'end') {
    if (input.mouse.clicked || input.hit('enter')) finishBattle(b);
    return;
  }

  const clicked = showdownButtons(b).find((btn) => input.inRect(btn.x, btn.y, btn.w, btn.h));
  if (!clicked) return;
  playSfx('menu');
  if (clicked.id === 'pause') { b.paused = !b.paused; return; }
  if (clicked.id === 'ff') { b.toggleSpeed(); return; }
  if (clicked.id === 'codex') { state.codexFrom = 'battle'; state.mode = 'codex'; return; }
  if (clicked.id === 'capture') {
    if (state.team.seedstones <= 0) { state.world.setNotice('No Seedstones left.'); return; }
    state.team.useSeedstone();
    const res = b.tryCapture();
    if (res.caught) playSfx('capture');
    return;
  }
  if (clicked.id === 'flee') {
    if (b.tryFlee()) playSfx('menu');
  }
}

function roadBattleEnd(won) {
  // called when a node battle resolves; returns true if it consumed the flow
  if (!ROAD || !state.road || state.roadPending == null) return false;
  const nodeIdx = state.roadPending; state.roadPending = null;
  const finalWin = roadDone(state.road, nodeIdx, won);
  if (state.road.spools <= 0) {
    state.lostNote = 'The last spool snapped';
    state.mode = 'defeat'; stopMusic(); playSfx('defeat'); saveGame(state);
    return true;
  }
  if (finalWin) {
    state.result = { time: state.stats.time, steps: state.road.nodes.filter((n) => n && n.done).length, captures: state.team.captureCount, wins: state.stats.wins };
    state.mode = 'victory'; stopMusic(); playSfx('victory'); saveGame(state);
    return true;
  }
  state.mode = 'road'; playMusic(roadMusic(state.road)); saveGame(state);
  return true;
}

function finishShowdown(b) {
  if (b._run) return finishRunBattle(b);
  state.battle = null;
  const won = b.winner === 'player';
  const captured = b.winner === 'captured';
  const wasBoss = b.kind === 'boss';
  const mission = b._mission;

  if (captured && b.captured) {
    state.team.markCaught(b.captured.species);
    state.team.captureCount += 1;
    if (state.team.party.length < 6) state.team.addCreature(b.captured);
    else { state.team.box.push(b.captured); }
    worldMessage(`${b.captured.nickname} joins your cause!`);
  }
  // quilt road: a node battle resolved (win OR capture = patch stitched)
  if (ROAD && state.roadPending != null && b.winner !== 'fled') {
    if (roadBattleEnd(won || captured)) return;
  }
  if (won) {
    state.stats.wins += 1;
    worldMessage(`Wild squad beaten! +${b.xpGained} XP`);
    if (wasBoss && mission) {
      state.world.bossDefeated[mission.zone] = true;
      worldMessage(`${mission.name} — mission settled!`);
      if (mission.key === 'nocturne') {
        state.result = { time: state.stats.time, steps: state.world.steps, captures: state.team.captureCount, wins: state.stats.wins };
        state.mode = 'victory';
        stopMusic(); playSfx('victory'); saveGame(state);
        return;
      }
    }
    state.mode = 'field';
  } else if (b.winner === 'fled') {
    if (ROAD && state.road) { state.mode = 'road'; saveGame(state); playMusic(roadMusic(state.road)); return; }
    state.mode = 'field';
  } else if (state.team.allFainted()) {
    if (ROAD && state.roadPending != null) { if (roadBattleEnd(false)) return; } // node loss costs a spool, not a run
    state.lostNote = `${Math.min(DEFEAT_PENALTY_ITEMS, state.team.seedstones)} Seedstones scattered`;
    state.team.seedstones = Math.max(0, state.team.seedstones - DEFEAT_PENALTY_ITEMS);
    state.mode = 'defeat';
    stopMusic(); playSfx('defeat');
    return;
  } else {
    // squad wiped but party technically alive elsewhere? (shouldn't happen) — treat as defeat-lite
    state.mode = 'field';
  }
  saveGame(state);
  playMusic(state.world.zoneId);
}

function act(battle, action) {  if (!action) return;
  battle.playerAction(action);
  // animate: hold the resolution briefly so hits read on screen
  state.busy = 1.15;
  const anchors = battleAnchors();
  if (action.type === 'capture') particles.spawn(anchors.enemy.x, anchors.enemy.y, '#5fd36a', 22);
}

function finishBattle(b) {
  if (b.isShowdown) return finishShowdown(b);
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
  if (ROAD && state.road) {
    state.road.spools = 3; // the quilt rewinds: fresh spools, same stitched patches
    state.road.notions = Math.max(0, state.road.notions - 1);
    state.team.healPartyHalf();
    state.mode = 'road';
    state.world.setNotice('You wake by the quilt frame, humbled');
    playMusic(roadMusic(state.road)); saveGame(state);
    return;
  }
  state.world.zoneId = 'town';
  state.world.px = 7; state.world.py = 18;
  state.team.healPartyHalf();
  state.mode = 'field';
  state.world.setNotice('You wake in Moss Meadow, humbled');
  playMusic('moss');
  saveGame(state);
}

// ---------------------------------------------------------------- draw
function draw() {
  ctx.fillStyle = '#f7ead0'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  switch (state.mode) {
    case 'title': drawTitle(ctx, state.t); break;
    case 'field':
      drawField(ctx, state.world, state.t);
      drawFieldHud(ctx, state, state.t);
      if (state.dialog) {
        const d = state.dialog;
        const line = d.npc.lines[Math.min(d.line, d.npc.lines.length - 1)];
        panel(ctx, 120, VIEW_H - 150, VIEW_W - 240, 108);
        ctx.fillStyle = '#3b2c17'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left';
        ctx.fillText(d.npc.name.toUpperCase(), 146, VIEW_H - 118);
        ctx.fillStyle = '#3b2c17'; ctx.font = '17px monospace';
        ctx.fillText(line, 146, VIEW_H - 84);
        ctx.fillStyle = '#6d5b3c'; ctx.font = '13px monospace'; ctx.textAlign = 'right';
        ctx.fillText('[Enter] ' + (d.line + 1 >= d.npc.lines.length ? 'close' : 'next'), VIEW_W - 146, VIEW_H - 56);
        ctx.textAlign = 'left';
      }
      particles.draw(ctx);
      break;
    case 'battle':
      if (state.battle && state.battle.isShowdown) {
        drawShowdown(ctx, state.battle, state.t);
        drawShowdownHud(ctx, state.battle, state.team);
      } else {
        drawBattle(ctx, state.battle, state.t, particles);
        drawBattleSceneHud(state.battle);
      }
      break;
    case 'draft': drawField(ctx, state.world, state.t); drawDraft(ctx, state.draft, state.t); break;
    case 'road': {
      drawRoad(ctx, state, state.t, input.mouse);
      const nt = state.world.notice;
      if (nt && nt.t > 0) {
        ctx.font = 'bold 17px Georgia'; const w = ctx.measureText(nt.text).width + 44;
        ctx.fillStyle = 'rgba(15,40,25,.95)'; roundRectC(ctx, VIEW_W / 2 - w / 2, 178, w, 38, 9); ctx.fill();
        ctx.strokeStyle = '#57d27a'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#e8f2e4'; ctx.textAlign = 'center'; ctx.fillText(nt.text, VIEW_W / 2, 203); ctx.textAlign = 'left';
      }
      break;
    }
    case 'run': {
      drawRun(ctx, state.run, state.t, input.mouse);
      break;
    }
    case 'codex': drawCodex(ctx, state.team, state.t); break;
    case 'victory': drawVictory(ctx, state.result || { time: 0, steps: 0, captures: 0, wins: 0 }, state.t); break;
    case 'defeat': drawDefeat(ctx, state, state.t); break;
  }
}

function drawBattleSceneHud(b) {
  // lazy import cycle avoider: hud already loaded via import below
  hudDrawBattleHud(ctx, b, state, state.t, activeBattleButtons(b), hoveredButton(activeBattleButtons(b)));
}

import { drawBattleHud as hudDrawBattleHud } from './hud.js?v=run9';
import { MOVES as MOVES_TABLE } from './data.js?v=run9';

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
if (RUN) loadRunData(); // swap built-in trainers/shop/trinkets for Manus's JSON when present
requestAnimationFrame(frame);
