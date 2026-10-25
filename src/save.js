// localStorage persistence. Every access is wrapped; the game runs fine without storage.
import { startingGear } from './items.js';

const KEY = 'highkeep-road.save.v1';
const SKEY = 'highkeep-road.settings.v1';

export function defaultSettings() {
  let coarse = false;
  try { coarse = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700; } catch (e) { /* ignore */ }
  return { gfx: coarse ? 'low' : 'high' };
}

export function newSave(cls) {
  return {
    v: 1, cls, level: 1, xp: 0, gold: 60, potions: 3,
    equip: startingGear(cls), bag: [],
    cleared: 0, vaultBest: 0, story: false,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || !s.cls) return null;
    return s;
  } catch (e) { return null; }
}

export function writeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); return true; } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SKEY);
    if (raw) return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return defaultSettings();
}

export function writeSettings(s) {
  try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}
