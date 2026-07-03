'use strict';

// Articles & blog posts. Uses the Brave News Search API when a key is
// configured (better relevance and freshness control); otherwise falls back
// to the keyless Google News RSS feed.

const { XMLParser } = require('fast-xml-parser');
const { getJson, getText } = require('./http');

async function fetchBraveNews(query, apiKey, limit) {
  const url =
    'https://api.search.brave.com/res/v1/news/search?' +
    new URLSearchParams({
      q: query,
      count: String(limit),
      freshness: 'pd', // past day; the fetch runs daily
      search_lang: 'en'
    });
  const data = await getJson(url, {
    Accept: 'application/json',
    'X-Subscription-Token': apiKey
  });
  return (data.results || []).map((r) => ({
    type: 'article',
    title: r.title,
    url: r.url,
    source: (r.meta_url && r.meta_url.hostname) || '',
    description: stripTags(r.description || ''),
    thumbnail: (r.thumbnail && r.thumbnail.src) || '',
    publishedAt: r.page_age ? Date.parse(r.page_age) : Date.now()
  }));
}

async function fetchGoogleNewsRss(query, limit) {
  const url =
    'https://news.google.com/rss/search?' +
    new URLSearchParams({ q: query, hl: 'en-US', gl: 'US', ceid: 'US:en' });
  const xml = await getText(url);
  return parseGoogleNewsRss(xml, limit);
}

function parseGoogleNewsRss(xml, limit) {
  const parser = new XMLParser({ ignoreAttributes: false });
  const doc = parser.parse(xml);
  let items = doc?.rss?.channel?.item || [];
  if (!Array.isArray(items)) items = [items];
  return items.slice(0, limit).map((it) => ({
    type: 'article',
    title: typeof it.title === 'string' ? it.title : '',
    url: it.link || '',
    source: (it.source && it.source['#text']) || '',
    description: stripTags(String(it.description || '')),
    thumbnail: '',
    publishedAt: it.pubDate ? Date.parse(it.pubDate) : Date.now()
  }));
}

function stripTags(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

async function fetchNews(query, settings) {
  const limit = settings.maxItemsPerTopicPerFetch || 15;
  if (settings.braveApiKey) {
    try {
      return await fetchBraveNews(query, settings.braveApiKey, limit);
    } catch (err) {
      // Bad key, rate limit, outage — fall back to the keyless source
      // rather than returning nothing for the day.
      console.warn(`Brave news failed for "${query}": ${err.message}`);
    }
  }
  return fetchGoogleNewsRss(query, limit);
}

module.exports = { fetchNews, fetchGoogleNewsRss, fetchBraveNews, parseGoogleNewsRss };
