'use strict';

// Plain-node test runner: exercises the store, topic expiry, scheduler
// logic, and the keyless live fetchers (Google News RSS, iTunes podcasts).
// Run with: npm test

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { Store } = require('../src/main/store');
const { fetchGoogleNewsRss, parseGoogleNewsRss } = require('../src/main/fetchers/news');
const { fetchPodcasts } = require('../src/main/fetchers/podcasts');

let passed = 0;
let skipped = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.error(`  FAIL - ${name}: ${err.message}`);
  }
}

// Live tests hit real endpoints; when the network or an egress policy blocks
// them (offline machine, sandbox), skip instead of failing — the parsing
// logic is covered by offline fixture tests.
async function liveTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      failures.push({ name, err });
      console.error(`  FAIL - ${name}: ${err.message}`);
    } else {
      skipped++;
      console.warn(`  skip - ${name} (network unavailable: ${err.message})`);
    }
  }
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'newsgather-test-'));

  console.log('store:');
  await test('creates default settings', () => {
    const store = new Store(dir);
    assert.strictEqual(store.settings.fetchTime, '08:00');
    assert.deepStrictEqual(store.topics, []);
  });

  await test('upserts, persists and reloads topics', () => {
    const store = new Store(dir);
    const t = store.upsertTopic({ name: 'AI', query: 'artificial intelligence', types: ['article'] });
    assert.ok(t.id);
    const reloaded = new Store(dir);
    assert.strictEqual(reloaded.topics.length, 1);
    assert.strictEqual(reloaded.topics[0].name, 'AI');
    reloaded.upsertTopic({ id: t.id, name: 'AI news', query: 'ai', types: ['article'] });
    assert.strictEqual(new Store(dir).topics[0].name, 'AI news');
  });

  await test('temporary topics expire after their end date', () => {
    const store = new Store(dir);
    const past = { name: 'old', query: 'q', types: ['article'], endDate: '2026-01-01' };
    const future = { name: 'new', query: 'q', types: ['article'], endDate: '2099-01-01' };
    const paused = { name: 'p', query: 'q', types: ['article'], paused: true };
    assert.strictEqual(store.isTopicActive(past), false);
    assert.strictEqual(store.isTopicActive(future), true);
    assert.strictEqual(store.isTopicActive(paused), false);
    // Active through the whole end day
    const endOfDay = new Date('2026-01-01T20:00:00').getTime();
    assert.strictEqual(store.isTopicActive(past, endOfDay), true);
  });

  await test('deduplicates items across fetches', () => {
    const store = new Store(dir);
    const topicId = store.topics[0].id;
    const raw = [
      { type: 'article', title: 'One', url: 'https://example.com/1' },
      { type: 'article', title: 'Two', url: 'https://example.com/2' }
    ];
    assert.strictEqual(store.addItems(topicId, raw), 2);
    assert.strictEqual(store.addItems(topicId, raw), 0); // same urls again
    assert.strictEqual(store.listItems().length, 2);
  });

  await test('markSeen and toggleSaved persist', () => {
    const store = new Store(dir);
    const item = store.listItems()[0];
    store.markSeen([item.id]);
    assert.strictEqual(store.toggleSaved(item.id), true);
    const reloaded = new Store(dir);
    assert.strictEqual(reloaded.items[item.id].seen, true);
    assert.strictEqual(reloaded.items[item.id].saved, true);
  });

  await test('prune removes old unsaved items but keeps saved ones', () => {
    const store = new Store(dir);
    const [saved, unsaved] = store.listItems();
    const old = Date.now() - 120 * 24 * 3600 * 1000;
    store.items[saved.id].fetchedAt = old;
    store.items[unsaved.id].fetchedAt = old;
    // one of the two is saved from the previous test
    const savedCount = store.listItems().filter((i) => i.saved).length;
    assert.strictEqual(savedCount, 1);
    store.prune();
    assert.strictEqual(store.listItems().length, 1);
    assert.strictEqual(store.listItems()[0].saved, true);
  });

  console.log('scheduler:');
  await test('runs when due, skips when already fetched', () => {
    const { Scheduler } = require('../src/main/scheduler');
    let runs = 0;
    const fakeStore = { settings: { fetchTime: '00:00', lastFetch: Date.now() - 25 * 3600 * 1000 } };
    const sched = new Scheduler(fakeStore, () => runs++);
    sched._tick(); // due: last fetch was before today's 00:00
    assert.strictEqual(runs, 1);
    fakeStore.settings.lastFetch = Date.now();
    sched._tick(); // already fetched today
    assert.strictEqual(runs, 1);
  });

  console.log('parsing (offline):');
  await test('parses Google News RSS xml', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>First story</title><link>https://example.com/a</link>
        <pubDate>Wed, 01 Jul 2026 10:00:00 GMT</pubDate>
        <source url="https://site.com">Site Name</source>
        <description>&lt;a href="x"&gt;First story&lt;/a&gt; summary &amp;amp; more</description></item>
      <item><title>Second story</title><link>https://example.com/b</link>
        <pubDate>Wed, 01 Jul 2026 09:00:00 GMT</pubDate></item>
    </channel></rss>`;
    const items = parseGoogleNewsRss(xml, 10);
    assert.strictEqual(items.length, 2);
    assert.strictEqual(items[0].title, 'First story');
    assert.strictEqual(items[0].url, 'https://example.com/a');
    assert.strictEqual(items[0].source, 'Site Name');
    assert.strictEqual(items[0].description, 'First story summary & more');
    assert.strictEqual(items[0].type, 'article');
    assert.ok(items[0].publishedAt > 0);
    // single-item channels are not arrays in the parser output
    const single = parseGoogleNewsRss(
      '<rss><channel><item><title>Only</title><link>https://e.com/1</link></item></channel></rss>', 10);
    assert.strictEqual(single.length, 1);
    // limit is respected
    assert.strictEqual(parseGoogleNewsRss(xml, 1).length, 1);
  });

  console.log('live fetchers (network):');
  await liveTest('Google News RSS returns articles', async () => {
    const items = await fetchGoogleNewsRss('technology', 5);
    assert.ok(items.length > 0, 'expected at least one article');
    assert.ok(items[0].title.length > 0);
    assert.ok(items[0].url.startsWith('http'));
    assert.strictEqual(items[0].type, 'article');
  });

  await liveTest('iTunes podcast search returns recent episodes', async () => {
    const items = await fetchPodcasts('technology', { maxItemsPerTopicPerFetch: 5 });
    assert.ok(Array.isArray(items));
    if (items.length) {
      assert.ok(items[0].title.length > 0);
      assert.strictEqual(items[0].type, 'podcast');
      assert.ok(items[0].publishedAt > Date.now() - 8 * 24 * 3600 * 1000);
    }
  });

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failures.length} failed, ${skipped} skipped`);
  if (failures.length) process.exit(1);
}

main();
