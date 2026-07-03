'use strict';

const TIMEOUT_MS = 20000;

async function getJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'NewsGather/1.0', ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  }
  return res.json();
}

async function getText(url, headers = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'NewsGather/1.0', ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  }
  return res.text();
}

module.exports = { getJson, getText };
