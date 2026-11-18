// hud.js — in-game overlay panels drawn on the canvas: field status (zone,
// party hearts, items, mission tracker) and the battle HUD (HP bars, levels,
// XP, action wheel, message log).
import { VIEW_W, VIEW_H, PALETTE, ELEMENT_COLORS } from './config.js?v=15';
import { SPECIES, MOVES } from './data.js?v=15';
import { MISSIONS } from './data.js?v=15';
import { drawSeedstoneIcon, drawPotionIcon } from './art.js?v=15';

export function panel(ctx, x, y, w, h, alpha = 0.92) {
  if (drawSlice(ctx, 'hud_panel', x, y, w, h, 24, alpha)) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge; ctx.lineWidth = 3;
  roundRect(ctx, x, y, w, h, 14); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

// HUD01 skin: named slice with per-asset margin (measured from the PNGs, not spec).
const SLICE_M = { field_hud: 22, enemy_card: 6, player_creature_card: 14, message_log: 5 };
// HUD01 panels are LIGHT parchment -> dark ink text (light-on-light was the QA defect).
const INK = '#3b2c17', INK_SUB = '#6d5b3c';
function artPanel(ctx, name, x, y, w, h, alpha = 0.92) {
  if (drawSlice(ctx, name, x, y, w, h, SLICE_M[name], alpha)) return;
  panel(ctx, x, y, w, h, alpha);
}

// Muse watercolor UI assets, lazy-loaded; false = missing -> procedural fallback.
// shortcut: if a panel ever needs its own art, upgrade from generic hud_panel.
const uiCache = new Map();
function uiImg(name) {
  if (!uiCache.has(name)) {
    const img = new Image();
    img.onerror = () => uiCache.set(name, false);
    img.onload = () => uiCache.set(name, img);
    img.src = `assets/ui/${name}.png?v=quilt2`;
    uiCache.set(name, null); // loading
  }
  return uiCache.get(name);
}
/** 9-slice draw of a UI asset; edge bands scale with target height (slim bars OK). */
export function drawSlice(ctx, name, x, y, w, h, m, alpha = 1) {
  const img = uiImg(name);
  if (!img) return img === false ? false : true; // loading: caller keeps procedural this frame
  const e = Math.min(m * (h / img.height), w / 2, h / 2); // shortcut: w<2e overlaps edges; our panels never that small
  ctx.save(); ctx.globalAlpha = alpha;
  const sxC = [0, m, img.width - m], widC = [m, img.width - 2 * m, m], dxC = [x, x + e, x + w - e], dwC = [e, Math.max(0, w - 2 * e), e];
  const syR = [0, m, img.height - m], widR = [m, img.height - 2 * m, m], dyR2 = [y, y + e, y + h - e], dhR = [e, Math.max(0, h - 2 * e), e];
  for (let c = 0; c < 3; c++)
    for (let r = 0; r < 3; r++)
      if (dwC[c] > 0 && dhR[r] > 0) ctx.drawImage(img, sxC[c], syR[r], widC[c], widR[r], dxC[c], dyR2[r], dwC[c], dhR[r]);
  ctx.restore();
  return true;
}

// buttons.png = 2 pills side by side, 192x64: normal, hover/glow.
function drawButtonArt(ctx, x, y, w, h, hot) {
  const img = uiImg('buttons');
  if (!img) return false;
  ctx.drawImage(img, hot ? 192 : 0, 0, 192, 64, x, y, w, h);
  return true;
}

// hp_bar.png = 4 horizontal 96px segments: empty track, green, yellow, red fills.
function hpBarArt(ctx, x, y, w, h, frac) {
  const img = uiImg('hp_bar');
  if (!img) return false;
  const seg = frac <= 0.25 ? 3 : frac <= 0.5 ? 2 : 1;
  ctx.drawImage(img, 0, 0, 96, 64, x, y, w, h);
  if (frac > 0.001) ctx.drawImage(img, seg * 96, 0, 96, 64, x, y, Math.max(h, w * frac), h);
  return true;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hpColor(frac) { return frac > 0.5 ? PALETTE.hpGood : frac > 0.22 ? PALETTE.hpMid : PALETTE.hpBad; }

export function hpBar(ctx, x, y, w, h, frac) {
  if (hpBarArt(ctx, x, y, w, h, frac)) return;
  ctx.fillStyle = '#0a0f0a'; roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = '#31493a'; ctx.lineWidth = 2; roundRect(ctx, x, y, w, h, h / 2); ctx.stroke();
  if (frac > 0.001) {
    ctx.fillStyle = hpColor(frac);
    roundRect(ctx, x + 2, y + 2, Math.max(h - 4, (w - 4) * frac), h - 4, (h - 4) / 2); ctx.fill();
  }
}

function elementChip(ctx, x, y, element, text, ink = false) {
  const c = ELEMENT_COLORS[element];
  ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
  ctx.fillStyle = ink ? INK : c.main; ctx.fillText(`${ink ? '' : '◈ '}${text}`, x, y);
}

// ---------------------------------------------------------------- field HUD
export function drawFieldHud(ctx, state, t) {
  const { world, team } = state;
  // top-left: zone + timer
  artPanel(ctx, 'field_hud', 14, 12, 330, 78);
  ctx.fillStyle = INK; ctx.font = 'bold 21px monospace'; ctx.textAlign = 'left';
  const zoneNames = { town: 'Leafpine Village', route: 'Old Root Road', forest: 'Deepfern Hollow', cave: 'Glimmerdeep Cave' };
  ctx.fillText(zoneNames[world.zoneId] || 'Moss Meadow', 30, 40);
  ctx.font = '14px monospace'; ctx.fillStyle = INK_SUB;
  const mins = Math.floor(state.stats.time / 60), secs = Math.floor(state.stats.time % 60);
  ctx.fillText(`steps ${world.steps} · ${mins}:${String(secs).padStart(2, '0')} · encounters ${state.stats.encounters}`, 30, 66);

  // top-right: party
  const px = VIEW_W - 292;
  artPanel(ctx, 'field_hud', px, 12, 278, 40 + team.party.length * 40);
  team.party.forEach((c, i) => {
    const y = 40 + i * 40;
    const sp = SPECIES[c.species];
    elementChip(ctx, px + 16, y + 12, sp.element, `${c.nickname} L${c.level}`, true);
    hpBar(ctx, px + 16, y + 18, 200, 10, c.hp / c.stats.hp);
    ctx.fillStyle = INK; ctx.font = '12px monospace'; ctx.textAlign = 'right';
    ctx.fillText(`${c.hp}/${c.stats.hp}`, px + 262, y + 27);
    ctx.textAlign = 'left';
  });

  // bottom-left: items + mission tracker
  artPanel(ctx, 'field_hud', 14, VIEW_H - 148, 360, 134);
  drawSeedstoneIcon(ctx, 44, VIEW_H - 112, 22, t);
  ctx.fillStyle = INK; ctx.font = 'bold 17px monospace';
  ctx.fillText(`× ${team.seedstones}`, 66, VIEW_H - 106);
  drawPotionIcon(ctx, 150, VIEW_H - 112, 22);
  ctx.fillText(`× ${team.potions}`, 172, VIEW_H - 106);
  ctx.font = '14px monospace'; ctx.fillStyle = INK_SUB;
  ctx.fillText('Codex: press C or click [C]', 220, VIEW_H - 106);
  let my = VIEW_H - 78;
  for (const m of MISSIONS) {
    const done = world.bossDefeated[m.zone];
    ctx.fillStyle = done ? '#2e7d32' : INK;
    ctx.fillText(`${done ? '✔' : '○'} ${m.name}`, 30, my);
    my += 22;
  }

  // bottom-right buttons: Codex + mute
  drawHudButton(ctx, VIEW_W - 150, VIEW_H - 66, 136, 44, 'CODEX');
  drawHudButton(ctx, VIEW_W - 274, VIEW_H - 66, 114, 44, state.muted ? 'SOUND ✕' : 'SOUND ♪');

  // notice banner
  if (world.notice) {
    ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
    const w = ctx.measureText(world.notice.text).width + 60;
    panel(ctx, VIEW_W / 2 - w / 2, 108, w, 56, 0.94);
    ctx.fillStyle = PALETTE.paper;
    ctx.fillText(world.notice.text, VIEW_W / 2, 145);
    ctx.textAlign = 'left';
  }
}

export function drawHudButton(ctx, x, y, w, h, label, hot = false) {
  ctx.save();
  ctx.globalAlpha = hot ? 1 : 0.88;
  if (drawButtonArt(ctx, x, y, w, h, hot)) {
    // sprite drawn; skip procedural fill below
  } else {
    ctx.fillStyle = hot ? '#2a4f38' : PALETTE.panel;
    roundRect(ctx, x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = hot ? ELEMENT_COLORS.Verdant.main : PALETTE.panelEdge; ctx.lineWidth = 2.5;
    roundRect(ctx, x, y, w, h, 10); ctx.stroke();
  }
  ctx.fillStyle = PALETTE.paper; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 5);
  ctx.restore();
}

// ---------------------------------------------------------------- battle HUD
export function drawBattleHud(ctx, battle, state, t, buttons, hovered) {
  const enemySp = SPECIES[battle.enemy.species];
  // enemy card
  artPanel(ctx, 'enemy_card', 60, 34, 420, 96);
  // art bands measured from enemy_card.png: name plate y~0.26-0.43, hp slot y~0.58-0.74 x~0.09-0.91
  ctx.fillStyle = INK; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'left';
  ctx.fillText(`${enemySp.name}${battle.kind === 'boss' ? ' ‹TRIBUS›' : ''}`, 78, 71);
  ctx.font = '13px monospace'; ctx.fillStyle = INK_SUB;
  ctx.fillText(`Lv ${battle.enemy.level} · ${enemySp.element}`, 78, 88);
  ctx.fillStyle = INK; ctx.font = '12px monospace'; ctx.textAlign = 'right';
  ctx.fillText(`${battle.enemy.hp}/${battle.enemy.stats.hp}`, 462, 88);
  ctx.textAlign = 'left';
  hpBar(ctx, 90, 95, 330, 11, battle.enemy.hp / battle.enemy.stats.hp);

  // player card
  const pSp = SPECIES[battle.player.species];
  artPanel(ctx, 'player_creature_card', VIEW_W - 480, 470, 420, 118);
  ctx.fillStyle = INK; ctx.font = 'bold 20px monospace';
  ctx.fillText(`${battle.player.nickname}`, VIEW_W - 462, 498);
  ctx.font = '13px monospace'; ctx.fillStyle = INK_SUB;
  ctx.fillText(`Lv ${battle.player.level} · ${pSp.element} · focus ${battle.player.focused ? 'ON' : 'off'}`, VIEW_W - 462, 518);
  hpBar(ctx, VIEW_W - 462, 526, 268, 14, battle.player.hp / battle.player.stats.hp);
  // HP numbers beside the bar (was: drawn on top of it — QA defect)
  ctx.fillStyle = INK; ctx.font = '12px monospace'; ctx.textAlign = 'right';
  ctx.fillText(`${battle.player.hp}/${battle.player.stats.hp}`, VIEW_W - 148, 537);
  ctx.textAlign = 'left';
  // xp bar
  ctx.fillStyle = '#0a0f0a'; roundRect(ctx, VIEW_W - 462, 548, 268, 8, 4); ctx.fill();
  ctx.fillStyle = '#6fa8ff'; roundRect(ctx, VIEW_W - 462, 548, Math.max(8, 268 * (battle.player.xp / battle.player.xpNext)), 8, 4); ctx.fill();
  ctx.font = '11px monospace'; ctx.fillStyle = INK_SUB; ctx.textAlign = 'left';
  ctx.fillText(`XP ${battle.player.xp}/${battle.player.xpNext}`, VIEW_W - 462, 572);
  ctx.textAlign = 'left';

  // party pips
  state.team.party.forEach((c, i) => {
    const x = 60 + i * 96, y = VIEW_H - 46;
    ctx.fillStyle = c.hp > 0 ? ELEMENT_COLORS[SPECIES[c.species].element].main : '#3a3f3a';
    ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill();
    ctx.strokeStyle = battle.player === c ? PALETTE.paper : 'rgba(0,0,0,.5)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = PALETTE.paper; ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`L${c.level}`, x, y + 4);
    ctx.textAlign = 'left';
  });

  // action buttons (provided by screens.js layout via `buttons`)
  for (const b of buttons) {
    drawHudButton(ctx, b.x, b.y, b.w, b.h, b.label, hovered === b.id);
    if (b.sub) {
      ctx.fillStyle = '#9fb8a6'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
      ctx.fillText(b.sub, b.x + b.w / 2, b.y + b.h + 15); ctx.textAlign = 'left';
    }
  }

  // message log — pushed below the enemy sprite head (was overlapping it at y=168)
  artPanel(ctx, 'message_log', 520, 220, 660, 112, 0.92);
  ctx.font = '15px monospace';
  const lines = battle.log.slice(-4);
  lines.forEach((l, i) => {
    ctx.fillStyle = i === lines.length - 1 ? INK : INK_SUB;
    ctx.fillText(l.text.slice(0, 74), 540, 248 + i * 24);
  });
}
