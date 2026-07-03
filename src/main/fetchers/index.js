'use strict';

const { fetchNews } = require('./news');
const { fetchVideos } = require('./youtube');
const { fetchPodcasts } = require('./podcasts');

// Runs every enabled content type for one topic. A failure in one source
// never blocks the others; errors are collected and reported.
async function fetchTopic(topic, settings) {
  const jobs = [];
  if (topic.types.includes('article')) jobs.push(fetchNews(topic.query, settings));
  if (topic.types.includes('video')) jobs.push(fetchVideos(topic.query, settings));
  if (topic.types.includes('podcast')) jobs.push(fetchPodcasts(topic.query, settings));

  const results = await Promise.allSettled(jobs);
  const items = [];
  const errors = [];
  for (const r of results) {
    if (r.status === 'fulfilled') items.push(...r.value);
    else errors.push(r.reason.message || String(r.reason));
  }
  return { items, errors };
}

module.exports = { fetchTopic };
