'use strict';

// Simple JSON-file persistence. No native modules, so the app builds on any
// machine without a compiler toolchain. Data volume stays small because old
// unsaved items are pruned.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEEP_DAYS = 90;

class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    fs.mkdirSync(dataDir, { recursive: true });
    this.topics = this._load('topics.json', []);
    this.items = this._load('items.json', {});
    this.settings = this._load('settings.json', {
      braveApiKey: '',
      youtubeApiKey: '',
      fetchTime: '08:00',
      lastFetch: 0,
      maxItemsPerTopicPerFetch: 15
    });
  }

  _file(name) {
    return path.join(this.dataDir, name);
  }

  _load(name, fallback) {
    try {
      return JSON.parse(fs.readFileSync(this._file(name), 'utf8'));
    } catch {
      return fallback;
    }
  }

  _save(name, data) {
    // Atomic write: write to a temp file, then rename over the target.
    const file = this._file(name);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
    fs.renameSync(tmp, file);
  }

  saveTopics() { this._save('topics.json', this.topics); }
  saveItems() { this._save('items.json', this.items); }
  saveSettings() { this._save('settings.json', this.settings); }

  // ---- Topics ----

  upsertTopic(topic) {
    const existing = topic.id && this.topics.find((t) => t.id === topic.id);
    if (existing) {
      Object.assign(existing, topic);
    } else {
      topic.id = topic.id || crypto.randomUUID();
      topic.createdAt = Date.now();
      this.topics.push(topic);
    }
    this.saveTopics();
    return topic;
  }

  deleteTopic(id) {
    this.topics = this.topics.filter((t) => t.id !== id);
    for (const key of Object.keys(this.items)) {
      if (this.items[key].topicId === id && !this.items[key].saved) {
        delete this.items[key];
      }
    }
    this.saveTopics();
    this.saveItems();
  }

  // A topic is active when it isn't paused and hasn't passed its end date.
  isTopicActive(topic, now = Date.now()) {
    if (topic.paused) return false;
    if (topic.endDate) {
      // endDate is a YYYY-MM-DD string; the topic stays active through that day.
      const end = new Date(topic.endDate + 'T23:59:59');
      if (now > end.getTime()) return false;
    }
    return true;
  }

  activeTopics() {
    return this.topics.filter((t) => this.isTopicActive(t));
  }

  // ---- Items ----

  static itemId(url) {
    return crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
  }

  // Returns the number of genuinely new items added.
  addItems(topicId, rawItems) {
    let added = 0;
    for (const raw of rawItems) {
      if (!raw.url || !raw.title) continue;
      const id = Store.itemId(raw.url);
      if (this.items[id]) continue; // already seen in a previous fetch
      this.items[id] = {
        id,
        topicId,
        type: raw.type, // 'article' | 'video' | 'podcast'
        title: raw.title,
        url: raw.url,
        source: raw.source || '',
        description: (raw.description || '').slice(0, 500),
        thumbnail: raw.thumbnail || '',
        publishedAt: raw.publishedAt || Date.now(),
        fetchedAt: Date.now(),
        seen: false,
        saved: false
      };
      added++;
    }
    if (added) this.saveItems();
    return added;
  }

  markSeen(ids) {
    for (const id of ids) {
      if (this.items[id]) this.items[id].seen = true;
    }
    this.saveItems();
  }

  toggleSaved(id) {
    if (this.items[id]) {
      this.items[id].saved = !this.items[id].saved;
      this.saveItems();
      return this.items[id].saved;
    }
    return false;
  }

  prune() {
    const cutoff = Date.now() - KEEP_DAYS * 24 * 3600 * 1000;
    let removed = 0;
    for (const [id, item] of Object.entries(this.items)) {
      if (!item.saved && item.fetchedAt < cutoff) {
        delete this.items[id];
        removed++;
      }
    }
    if (removed) this.saveItems();
    return removed;
  }

  listItems() {
    return Object.values(this.items).sort((a, b) => b.publishedAt - a.publishedAt);
  }
}

module.exports = { Store };
