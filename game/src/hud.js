// hud.js — in-game overlay panels drawn on the canvas: field status (zone,
// party hearts, items, mission tracker) and the battle HUD (HP bars, levels,
// XP, action wheel, message log).
import { VIEW_W, VIEW_H, PALETTE, ELEMENT_COLORS } from './config.js';
import { SPECIES, MOVES } from './data.js';
import { MISSIONS } from './data.js';
import { drawSeedstoneIcon, drawPotionIcon } from './art.js';

export function panel(ctx, x, y, w, h, alpha = 0.92) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge; ctx.lineWidth = 3;
  roundRect(ctx, x, y, w, h, 14); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
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
  ctx.fillStyle = '#0a0f0a'; roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = '#31493a'; ctx.lineWidth = 2; roundRect(ctx, x, y, w, h, h / 2); ctx.stroke();
  if (frac > 0.001) {
    ctx.fillStyle = hpColor(frac);
    roundRect(ctx, x + 2, y + 2, Math.max(h - 4, (w - 4) * frac), h - 4, (h - 4) / 2); ctx.fill();
  }
}

function elementChip(ctx, x, y, element, text) {
  const c = ELEMENT_COLORS[element];
  ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
  ctx.fillStyle = c.main; ctx.fillText(`◈ ${text}`, x, y);
}

// ---------------------------------------------------------------- field HUD
export function drawFieldHud(ctx, state, t) {
  const { world, team } = state;
  // top-left: zone + timer
  panel(ctx, 14, 12, 330, 78);
  ctx.fillStyle = PALETTE.paper; ctx.font = 'bold 21px monospace'; ctx.textAlign = 'left';
  const zoneNames = { moss: 'Moss Meadow', cliff: 'Cinder Bluff', temple: 'Gloom Shrine' };
  ctx.fillText(zoneNames[world.zoneId], 30, 40);
  ctx.font = '14px monospace'; ctx.fillStyle = '#9fb8a6';
  const mins = Math.floor(state.stats.time / 60), secs = Math.floor(state.stats.time % 60);
  ctx.fillText(`steps ${world.steps} · ${mins}:${String(secs).padStart(2, '0')} · encounters ${state.stats.encounters}`, 30, 66);

  // top-right: party
  const px = VIEW_W - 292;
  panel(ctx, px, 12, 278, 40 + team.party.length * 40);
  team.party.forEach((c, i) => {
    const y = 40 + i * 40;
    const sp = SPECIES[c.species];
    elementChip(ctx, px + 16, y + 12, sp.element, `${c.nickname} L${c.level}`);
    hpBar(ctx, px + 16, y + 18, 200, 10, c.hp / c.stats.hp);
    ctx.fillStyle = '#cfe3d2'; ctx.font = '12px monospace'; ctx.textAlign = 'right';
    ctx.fillText(`${c.hp}/${c.stats.hp}`, px + 262, y + 27);
    ctx.textAlign = 'left';
  });

  // bottom-left: items + mission tracker
  panel(ctx, 14, VIEW_H - 148, 360, 134);
  drawSeedstoneIcon(ctx, 44, VIEW_H - 112, 22, t);
  ctx.fillStyle = PALETTE.paper; ctx.font = 'bold 17px monospace';
  ctx.fillText(`× ${team.seedstones}`, 66, VIEW_H - 106);
  drawPotionIcon(ctx, 150, VIEW_H - 112, 22);
  ctx.fillText(`× ${team.potions}`, 172, VIEW_H - 106);
  ctx.font = '14px monospace'; ctx.fillStyle = '#9fb8a6';
  ctx.fillText('Codex: press C or click [C]', 220, VIEW_H - 106);
  let my = VIEW_H - 78;
  for (const m of MISSIONS) {
    const done = world.bossDefeated[m.zone];
    ctx.fillStyle = done ? PALETTE.hpGood : '#cfe3d2';
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
  ctx.fillStyle = hot ? '#2a4f38' : PALETTE.panel;
  roundRect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = hot ? ELEMENT_COLORS.Verdant.main : PALETTE.panelEdge; ctx.lineWidth = 2.5;
  roundRect(ctx, x, y, w, h, 10); ctx.stroke();
  ctx.fillStyle = PALETTE.paper; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 5);
  ctx.restore();
}

// ---------------------------------------------------------------- battle HUD
export function drawBattleHud(ctx, battle, state, t, buttons, hovered) {
  const enemySp = SPECIES[battle.enemy.species];
  // enemy card
  panel(ctx, 60, 34, 420, 96);
  ctx.fillStyle = PALETTE.paper; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'left';
  ctx.fillText(`${enemySp.name}${battle.kind === 'boss' ? ' ‹TRIBUS›' : ''}`, 78, 62);
  ctx.font = '13px monospace'; ctx.fillStyle = '#9fb8a6';
  ctx.fillText(`Lv ${battle.enemy.level} · ${enemySp.element}`, 78, 84);
  hpBar(ctx, 78, 96, 350, 14, battle.enemy.hp / battle.enemy.stats.hp);
  ctx.fillStyle = '#cfe3d2'; ctx.font = '12px monospace'; ctx.textAlign = 'right';
  ctx.fillText(`${battle.enemy.hp}/${battle.enemy.stats.hp}`, 462, 92);
  ctx.textAlign = 'left';

  // player card
  const pSp = SPECIES[battle.player.species];
  panel(ctx, VIEW_W - 480, 470, 420, 118);
  ctx.fillStyle = PALETTE.paper; ctx.font = 'bold 20px monospace';
  ctx.fillText(`${battle.player.nickname}`, VIEW_W - 462, 498);
  ctx.font = '13px monospace'; ctx.fillStyle = '#9fb8a6';
  ctx.fillText(`Lv ${battle.player.level} · ${pSp.element} · focus ${battle.player.focused ? 'ON' : 'off'}`, VIEW_W - 462, 520);
  hpBar(ctx, VIEW_W - 462, 532, 320, 14, battle.player.hp / battle.player.stats.hp);
  ctx.fillStyle = '#cfe3d2'; ctx.font = '12px monospace'; ctx.textAlign = 'right';
  ctx.fillText(`${battle.player.hp}/${battle.player.stats.hp}`, VIEW_W - 148, 528);
  // xp bar
  ctx.fillStyle = '#0a0f0a'; roundRect(ctx, VIEW_W - 462, 556, 320, 8, 4); ctx.fill();
  ctx.fillStyle = '#6fa8ff'; roundRect(ctx, VIEW_W - 462, 556, Math.max(8, 320 * (battle.player.xp / battle.player.xpNext)), 8, 4); ctx.fill();
  ctx.font = '11px monospace'; ctx.fillStyle = '#9fb8a6'; ctx.textAlign = 'left';
  ctx.fillText(`XP ${battle.player.xp}/${battle.player.xpNext}`, VIEW_W - 462, 580);
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

  // message log
  panel(ctx, 520, 168, 660, 112, 0.9);
  ctx.font = '15px monospace';
  const lines = battle.log.slice(-4);
  lines.forEach((l, i) => {
    ctx.fillStyle = i === lines.length - 1 ? PALETTE.paper : '#8ba593';
    ctx.fillText(l.text.slice(0, 74), 540, 196 + i * 24);
  });
}
