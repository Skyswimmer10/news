'use strict';

// Videos via the YouTube Data API v3 (requires a free API key from
// Google Cloud Console). Without a key this source is skipped.

const { getJson } = require('./http');

async function fetchVideos(query, settings) {
  if (!settings.youtubeApiKey) return [];
  const limit = Math.min(settings.maxItemsPerTopicPerFetch || 15, 25);
  // Only videos published in the last 3 days, so the daily fetch surfaces
  // fresh uploads instead of re-ranking old popular videos.
  const publishedAfter = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const url =
    'https://www.googleapis.com/youtube/v3/search?' +
    new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      order: 'date',
      publishedAfter,
      maxResults: String(limit),
      relevanceLanguage: 'en',
      key: settings.youtubeApiKey
    });
  const data = await getJson(url);
  return (data.items || [])
    .filter((it) => it.id && it.id.videoId)
    .map((it) => ({
      type: 'video',
      title: decodeEntities(it.snippet.title),
      url: `https://www.youtube.com/watch?v=${it.id.videoId}`,
      source: it.snippet.channelTitle || 'YouTube',
      description: it.snippet.description || '',
      thumbnail: it.snippet.thumbnails?.medium?.url || '',
      publishedAt: Date.parse(it.snippet.publishedAt) || Date.now()
    }));
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

module.exports = { fetchVideos };
