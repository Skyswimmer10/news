# 📰 NewsGather

A personal news-gathering desktop app for Windows. It automatically searches
the internet every day for **articles & blog posts, YouTube videos, and
podcast episodes** on the topics you choose, and shows everything in one feed.

- **Permanent topics** — subjects you follow all the time (fetched daily).
- **Temporary topics** — things you care about only for a while (e.g. the
  football World Cup). Give them an end date and they stop searching
  automatically; or pause/resume any topic manually.
- **Feed** — newest items first, unread items highlighted until you open them,
  filter by topic / content type / unread.
- **Saved** — click ☆ on any item to bookmark it permanently.
- **Scheduler** — fetches at your chosen time every day, and catches up on
  launch if the computer was off. Manual "Fetch now" any time.

Everything is stored locally on your computer. No account, no server.

## Getting started

Requires [Node.js](https://nodejs.org) (LTS version) installed.

```bash
npm install
npm start
```

To build a Windows installer / portable .exe:

```bash
npm run dist          # installer + portable, in dist/
```

## Content sources & API keys

The app works out of the box with **no keys**:

| Content  | Keyless source            | Better with a free key            |
|----------|---------------------------|-----------------------------------|
| Articles | Google News RSS           | [Brave Search API](https://brave.com/search/api/) — free tier |
| Videos   | — (key required)          | [YouTube Data API v3](https://console.cloud.google.com/) — free quota |
| Podcasts | iTunes Search API (free)  | —                                 |

Paste keys into **Settings** inside the app. If the Brave key is missing or
fails, article search silently falls back to Google News RSS.

### Getting the keys (both free)

- **Brave Search**: go to <https://brave.com/search/api/>, sign up for the
  free plan ("Free" tier, 2,000 queries/month), create a key, paste it into
  Settings → Brave Search API key.
- **YouTube**: go to <https://console.cloud.google.com/>, create a project,
  enable **YouTube Data API v3**, create an **API key** under Credentials,
  paste it into Settings → YouTube Data API key.

## Tips

- The **search query** of a topic is what gets sent to the search engines —
  make it specific. `"world cup" football 2026` finds better results than
  `world cup`.
- Old unsaved items are cleaned up after 90 days automatically; saved items
  are kept forever.
- Data lives in `%APPDATA%/newsgather/data/` as plain JSON files, easy to
  back up.

## Development

```bash
npm test    # store, scheduler and live fetcher tests (plain Node, no GUI)
```

Structure:

- `main.js` / `preload.js` — Electron main process, IPC, window
- `src/main/store.js` — JSON persistence (topics, items, settings)
- `src/main/scheduler.js` — daily fetch scheduling with launch catch-up
- `src/main/fetchers/` — one module per content source
- `renderer/` — the UI (vanilla HTML/CSS/JS, no build step)
