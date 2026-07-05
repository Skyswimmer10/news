// Local-first persistence: each store (library / active project) saves its
// whole state under its own IndexedDB key, debounced after every change.
// Under Electron this module is the seam to swap for fs-based project files.
//
// IndexedDB is the primary store, but Chrome blocks it on file:// origins.
// So the offline single-file build (opened by double-click) falls back to
// localStorage, which does work from file://. localStorage is capped at
// ~5MB, so heavy image libraries may not fit — the File > Save .json export
// remains the durable, unlimited path either way.
import { get, set, del } from 'idb-keyval';

const ls = (() => {
  try {
    const k = '__larpcraft_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
})();

export async function loadKey(key) {
  try {
    const v = await get(key);
    if (v != null) return v;
  } catch {
    // IndexedDB unavailable (e.g. file://) — fall through to localStorage.
  }
  if (ls) {
    try {
      const raw = ls.getItem(key);
      if (raw != null) return JSON.parse(raw);
    } catch {
      /* corrupt or unreadable — treat as empty */
    }
  }
  return null;
}

const timers = {};
export function saveKeyDebounced(key, state) {
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => {
    set(key, state).catch((err) => {
      // IndexedDB failed (blocked on file://, or quota) — try localStorage.
      if (!ls) { console.warn(`LARP Craft: save failed (${key})`, err); return; }
      try {
        ls.setItem(key, JSON.stringify(state));
      } catch (lsErr) {
        console.warn(`LARP Craft: save failed (${key}) — data too large for offline storage; use File > Save to keep your work.`, lsErr);
      }
    });
  }, 400);
}

export async function clearKey(key) {
  try {
    await del(key);
  } catch {
    /* ignore */
  }
  if (ls) {
    try { ls.removeItem(key); } catch { /* ignore */ }
  }
}
