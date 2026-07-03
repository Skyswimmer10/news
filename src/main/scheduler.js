'use strict';

// Daily scheduler. Checks once a minute whether the configured fetch time
// has been reached and no fetch has run in the last 20 hours. Also catches
// up on app launch if the computer was off at the scheduled time.

const CHECK_INTERVAL_MS = 60 * 1000;
const MIN_GAP_MS = 20 * 3600 * 1000;

class Scheduler {
  constructor(store, runFetch) {
    this.store = store;
    this.runFetch = runFetch;
    this.timer = null;
  }

  start() {
    this.timer = setInterval(() => this._tick(), CHECK_INTERVAL_MS);
    // Catch-up shortly after launch so first results appear quickly.
    setTimeout(() => this._catchUp(), 3000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  _catchUp() {
    const last = this.store.settings.lastFetch || 0;
    if (Date.now() - last > MIN_GAP_MS) this.runFetch('startup catch-up');
  }

  _tick() {
    const { fetchTime, lastFetch } = this.store.settings;
    const [h, m] = (fetchTime || '08:00').split(':').map(Number);
    const now = new Date();
    const scheduledToday = new Date(now);
    scheduledToday.setHours(h, m, 0, 0);
    const due =
      now.getTime() >= scheduledToday.getTime() &&
      (lastFetch || 0) < scheduledToday.getTime();
    if (due && Date.now() - (lastFetch || 0) > MIN_GAP_MS) {
      this.runFetch('daily schedule');
    }
  }
}

module.exports = { Scheduler };
