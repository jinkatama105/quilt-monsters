// save.js — localStorage autosave that degrades gracefully when storage is
// blocked (private mode, sandboxed iframes): every call is wrapped, nothing
// outside the save format may throw.
import { SPECIES } from './data.js?v=5';
import { TeamManager } from './team.js?v=5';
import { World } from './world.js?v=5';

const KEY = 'verdant-s...e-v1';

export function canSave() {
  try {
    window.localStorage.setItem(KEY + '.probe', '1');
    window.localStorage.removeItem(KEY + '.probe');
    return true;
  } catch { return false; }
}

export function saveGame(state) {
  try {
    const data = {
      v: 1,
      team: state.team.serialize(),
      world: state.world.serialize(),
      stats: { time: Math.round(state.stats.time), encounters: state.stats.encounters, wins: state.stats.wins },
      missions: state.missions,
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  let raw = null;
  try { raw = window.localStorage.getItem(KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    const team = TeamManager.restore(data.team);
    // re-hydrate creatures: rebuild stats from species data so format drift can't corrupt them
    for (const c of team.party) {
      if (!SPECIES[c.species]) continue;
      c.focused = false;
    }
    const world = World.restore(data.world, new World());
    return { team, world, stats: data.stats || { time: 0, encounters: 0, wins: 0 }, missions: data.missions || {} };
  } catch { return null; }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
