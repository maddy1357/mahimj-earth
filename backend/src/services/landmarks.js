'use strict';
/** Curated landmarks for the Explore panel and "Surprise me". */
const landmarks = require('../../data/landmarks.json');
const wikipedia = require('./wikipedia');

function all() {
  return landmarks;
}

function byId(id) {
  return landmarks.find((l) => l.id === id) || null;
}

function random(excludeId) {
  const pool = landmarks.filter((l) => l.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Adds Wikipedia thumbnails. Failures are ignored so the list always loads. */
async function withImages() {
  const results = await Promise.allSettled(landmarks.map((l) => wikipedia.summary('en', l.wiki)));
  return landmarks.map((l, i) => ({
    ...l,
    thumbnail: results[i].status === 'fulfilled' ? results[i].value.thumbnail : null,
  }));
}

module.exports = { all, byId, random, withImages };
