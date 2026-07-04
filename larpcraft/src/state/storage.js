// Local-first persistence: each store (library / active project) saves its
// whole state under its own IndexedDB key, debounced after every change.
// Under Electron this module is the seam to swap for fs-based project files.
import { get, set, del } from 'idb-keyval';

export async function loadKey(key) {
  try {
    return (await get(key)) ?? null;
  } catch {
    return null;
  }
}

const timers = {};
export function saveKeyDebounced(key, state) {
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => {
    set(key, state).catch((err) => console.warn(`LARP Craft: save failed (${key})`, err));
  }, 400);
}

export async function clearKey(key) {
  await del(key);
}
