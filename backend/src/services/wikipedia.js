'use strict';
/** Wikipedia page summaries (title, description, extract, photo) for knowledge cards. */
const config = require('../config');
const TTLCache = require('../lib/cache');
const { fetchJSON } = require('../lib/http');

const cache = new TTLCache({ max: 1000, ttl: 24 * 60 * 60 * 1000 });

/**
 * Ask Wikimedia for a 500px rendition instead of the default ~330px thumbnail.
 * Wikimedia only serves standard widths (e.g. 330, 500, 960); others return HTTP 400.
 */
function largerImage(summary) {
  const thumb = summary.thumbnail?.source;
  const original = summary.originalimage;
  if (!thumb) return null;
  if (original && original.width <= 500) return original.source;
  return thumb.replace(/\/\d+px-([^/?]+)(\?.*)?$/, '/500px-$1$2');
}

async function summary(lang, title) {
  const key = `${lang}|${title}`;
  return cache.wrap(key, async () => {
    const url = `https://${lang}.${config.wikipediaHost}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const s = await fetchJSON(url, { timeout: 8000 });
    const page = s.content_urls?.desktop?.page || '';
    return {
      title: s.title || title,
      description: s.description || '',
      extract: s.extract || '',
      thumbnail: s.thumbnail?.source || null,
      image: largerImage(s),
      // Only pass through genuine Wikipedia links.
      url: /^https:\/\/[a-z-]+\.wikipedia\.org\//.test(page) ? page : null,
    };
  });
}

module.exports = { summary };
