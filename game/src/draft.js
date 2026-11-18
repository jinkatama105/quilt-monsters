// draft.js — pre-battle squad draft (pick up to 6 from your full roster, merge
// duplicates) — the team-building loop that keeps auto-battlers addictive.
import { VIEW_W, VIEW_H, PALETTE, ELEMENT_COLORS } from './config.js?v=run5';
import { SPECIES, MOVES } from './data.js?v=run5';
import { PARTY_MAX } from './config.js?v=run5';
import { drawCreature } from './art.js?v=run5';
import { panel, roundRect } from './hud.js?v=run5';

const COLS = 8;
const CW = 152, CH = 128;
const X0 = (VIEW_W - COLS * CW) / 2, Y0 = 112;

export function openDraft(team) {
  const pool = [...team.party, ...team.box].filter((c) => c.hp > 0);
  const sel = team.party.filter((c) => c.hp > 0).slice(0, 6);
  return { pool, sel: sel.map((c) => pool.indexOf(c)).filter((i) => i >= 0) };
}

export function draftButtons(draft) {
  const btns = [];
  draft.pool.forEach((c, i) => {
    const x = X0 + (i % COLS) * CW, y = Y0 + Math.floor(i / COLS) * CH;
    const bx = x + 8, by2 = y + 8, bh = CH - 16;
    btns.push({ id: `sel:${i}`, x: bx, y: by2, w: CW - 16, h: bh });
    if (team_canMerge(draft, i)) btns.push({ id: `merge:${i}`, x: bx + 12, y: by2 + bh - 34, w: 78, h: 26 });
  });
  const by = Y0 + Math.ceil(draft.pool.length / COLS) * CH + 18;
  btns.push({ id: 'auto', x: VIEW_W / 2 - 260, y: by, w: 150, h: 42 });
  btns.push({ id: 'deploy', x: VIEW_W / 2 - 80, y: by, w: 170, h: 42 });
  btns.push({ id: 'cancel', x: VIEW_W / 2 + 115, y: by, w: 145, h: 42 });
  draft._by = by;
  return btns;
}

function team_canMerge(draft, i) {
  const c = draft.pool[i];
  if (!c || (c.stars || 0) >= 3) return false;
  return draft.pool.some((o, j) => j !== i && o.species === c.species && o.hp > 0);
}

/** Perform the merge of duplicates right onto the chosen card. */
export function doMerge(draft, i, team) {
  const keep = draft.pool[i];
  const j = draft.pool.findIndex((c, k) => k !== i && c.species === keep.species && c.hp > 0);
  if (j < 0 || (keep.stars || 0) >= 3) return null;
  const dup = draft.pool[j];
  const survivor = team.mergeInto(draft.pool, i); // consumes dup via splice
  if (!survivor) return null;
  // keep sel indices valid after splice
  draft.sel = draft.sel.filter((k) => k !== j).map((k) => (k > j ? k - 1 : k));
  if (!draft.sel.includes(i) && survivor.hp > 0) draft.sel.push(i);
  return survivor;
}

/** Commit: selected creatures become the party (order kept), rest go to box. */
export function commitDraft(team, draft) {
  const chosen = draft.sel.map((i) => draft.pool[i]).filter(Boolean);
  const party = (chosen.length ? chosen : team.party.filter((c) => c.hp > 0).slice(0, 6)).slice(0, PARTY_MAX);
  const inSet = new Set(party);
  team.party = party;
  // pool holds every ALIVE roster member (merge consumed dups by splice); keep faint box rows untouched
  team.box = draft.pool.filter((c) => !inSet.has(c)).concat(team.box.filter((c) => c.hp <= 0 && !inSet.has(c)));
  return party;
}

export function drawDraft(ctx, draft, t) {
  panel(ctx, 0, 0, VIEW_W, VIEW_H, 0.86);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8f2e4'; ctx.font = 'bold 30px monospace';
  ctx.fillText('DRAFT YOUR SQUAD', VIEW_W / 2, 52);
  ctx.font = '15px monospace'; ctx.fillStyle = '#9fd8c8';
  ctx.fillText(`pick up to 6 · MERGE fuses two identical monsters (+30% stats each star, max ★★★) · ${draft.sel.length}/6 chosen`, VIEW_W / 2, 80);
  ctx.textAlign = 'left';

  const btns = draftButtons(draft);
  draft.pool.forEach((c, i) => {
    const b = btns.find((x) => x.id === `sel:${i}`);
    const sp = SPECIES[c.species];
    const col = ELEMENT_COLORS[sp.element];
    const chosen = draft.sel.includes(i);
    ctx.fillStyle = chosen ? 'rgba(142,242,160,.16)' : 'rgba(255,255,255,.05)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill();
    ctx.strokeStyle = chosen ? '#8ef2a0' : col.main; ctx.lineWidth = chosen ? 3 : 2; ctx.stroke();
    ctx.save(); ctx.translate(b.x + 34, b.y + 60); ctx.scale(0.5, 0.5);
    drawCreature(ctx, c.species, 0, 0, t + i, 'idle');
    ctx.restore();
    ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#e8f2e4';
    const stars = '★'.repeat(c.stars || 0);
    ctx.fillText(`${c.nickname}${stars ? ' ' + stars : ''}`, b.x + 84, b.y + 40);
    ctx.font = '13px monospace'; ctx.fillStyle = '#9fb8a6';
    ctx.fillText(`Lv ${c.level} · ${sp.element}`, b.x + 84, b.y + 60);
    ctx.fillText(`HP ${c.hp}/${c.stats.hp} · SPD ${c.stats.spd}`, b.x + 84, b.y + 78);
    if (team_canMerge(draft, i)) {
      const m = { x: b.x + 12, y: b.y + b.h - 34 };
      ctx.fillStyle = 'rgba(255,209,102,.2)'; roundRect(ctx, m.x, m.y, 78, 26, 8); ctx.fill();
      ctx.strokeStyle = '#ffd26a'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffe9b1'; ctx.font = 'bold 13px monospace';
      ctx.fillText('MERGE', m.x + 14, m.y + 18);
    }
  });

  // bottom action row
  const bottom = draftButtons(draft).filter((x) => !x.id.startsWith('sel:') && !x.id.startsWith('merge:'));
  for (const bt of bottom) {
    const label = bt.id === 'deploy' ? 'DEPLOY ⚔' : bt.id === 'auto' ? 'AUTO-PICK' : 'BACK';
    ctx.fillStyle = bt.id === 'deploy' ? 'rgba(142,242,160,.22)' : 'rgba(255,255,255,.07)';
    roundRect(ctx, bt.x, bt.y, bt.w, bt.h, 10); ctx.fill();
    ctx.strokeStyle = bt.id === 'deploy' ? '#8ef2a0' : bt.id === 'cancel' ? '#ff9d6a' : '#9fd8c8';
    ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#e8f2e4'; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center';
    ctx.fillText(label, bt.x + bt.w / 2, bt.y + bt.h / 2 + 6);
    ctx.textAlign = 'left';
  }
}
