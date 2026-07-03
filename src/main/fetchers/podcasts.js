'use strict';

// Podcast episodes via the iTunes Search API — keyless and free.
// Returns recent episodes matching the topic query.

const { getJson } = require('./http');

const RECENT_DAYS = 7; // episodes are less frequent than news, so a wider window

async function fetchPodcasts(query, settings) {
  const limit = settings.maxItemsPerTopicPerFetch || 15;
  const url =
    'https://itunes.apple.com/search?' +
    new URLSearchParams({
      term: query,
      media: 'podcast',
      entity: 'podcastEpisode',
      limit: '50',
      country: 'US'
    });
  const data = await getJson(url);
  const cutoff = Date.now() - RECENT_DAYS * 24 * 3600 * 1000;
  return (data.results || [])
    .filter((r) => r.releaseDate && Date.parse(r.releaseDate) >= cutoff)
    .sort((a, b) => Date.parse(b.releaseDate) - Date.parse(a.releaseDate))
    .slice(0, limit)
    .map((r) => ({
      type: 'podcast',
      title: r.trackName || '',
      url: r.trackViewUrl || r.episodeUrl || '',
      source: r.collectionName || '',
      description: r.description || '',
      thumbnail: r.artworkUrl160 || r.artworkUrl60 || '',
      publishedAt: Date.parse(r.releaseDate)
    }));
}

module.exports = { fetchPodcasts };
