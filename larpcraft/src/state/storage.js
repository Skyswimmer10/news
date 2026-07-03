// Local-first persistence. The whole project state (including image data URLs)
// lives in IndexedDB under one key — survives reloads, no server required.
// Under Electron this module is the seam to swap for fs-based project files.
import { get, set, del } from 'idb-keyval';

const KEY = 'larpcraft:project';

export async function loadProject() {
  try {
    return (await get(KEY)) ?? null;
  } catch {
    return null;
  }
}

let timer = null;
export function saveProjectDebounced(state) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    set(KEY, state).catch((err) => console.warn('LARP Craft: save failed', err));
  }, 400);
}

export async function clearProject() {
  await del(KEY);
}
