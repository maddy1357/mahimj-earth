'use strict';
/** Knowledge endpoints: /api/wiki, /api/explore, /api/explore/random, /api/explore/:id */
const express = require('express');
const wikipedia = require('../services/wikipedia');
const landmarks = require('../services/landmarks');
const v = require('../lib/validate');

const router = express.Router();

// GET /api/wiki?lang=en&title=Taj_Mahal  → summary for a knowledge card
router.get(
  '/wiki',
  v.asyncHandler(async (req, res) => {
    const lang = String(req.query.lang || 'en');
    if (!/^[a-z]{2,3}(-[a-z]{2,8})?$/.test(lang)) throw v.badRequest('"lang" must be a Wikipedia language code like "en"');
    const title = v.string(req.query.title, 'title', { max: 250 });
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(await wikipedia.summary(lang, title));
  })
);

// GET /api/explore?images=0  → curated landmarks (with photos unless images=0)
router.get(
  '/explore',
  v.asyncHandler(async (req, res) => {
    const list = req.query.images === '0' ? landmarks.all() : await landmarks.withImages();
    res.json({ landmarks: list });
  })
);

// GET /api/explore/random?exclude=taj-mahal  → one random landmark ("Surprise me")
router.get('/explore/random', (req, res) => {
  res.json({ landmark: landmarks.random(String(req.query.exclude || '')) });
});

// GET /api/explore/:id
router.get('/explore/:id', (req, res) => {
  const landmark = landmarks.byId(req.params.id);
  if (!landmark) return res.status(404).json({ error: 'Landmark not found' });
  res.json({ landmark });
});

module.exports = router;
