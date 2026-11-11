'use strict';
/** "My places" REST API: /api/placemarks */
const path = require('path');
const express = require('express');
const config = require('../config');
const JsonStore = require('../lib/store');
const v = require('../lib/validate');

function createPlacemarksRouter(store = new JsonStore(path.join(config.dataDir, 'placemarks.json'))) {
  const router = express.Router();

  const parse = (body, { partial = false } = {}) => {
    if (!body || typeof body !== 'object') throw v.badRequest('Request body must be a JSON object');
    const out = {};
    if (!partial || body.name !== undefined) out.name = v.string(body.name, 'name', { max: 120 });
    if (!partial || body.description !== undefined) out.description = v.string(body.description, 'description', { max: 500, optional: true });
    if (!partial) {
      out.lat = v.lat(body.lat);
      out.lon = v.lon(body.lon);
    }
    return out;
  };

  // GET /api/placemarks
  router.get(
    '/',
    v.asyncHandler(async (req, res) => {
      res.json({ placemarks: await store.all() });
    })
  );

  // GET /api/placemarks/export  → GeoJSON download
  router.get(
    '/export',
    v.asyncHandler(async (req, res) => {
      const items = await store.all();
      const geojson = {
        type: 'FeatureCollection',
        features: items.map((p) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: { id: p.id, name: p.name, description: p.description, createdAt: p.createdAt },
        })),
      };
      res.set('Content-Type', 'application/geo+json');
      res.set('Content-Disposition', 'attachment; filename="mahimj-earth-places.geojson"');
      res.send(JSON.stringify(geojson, null, 2));
    })
  );

  // GET /api/placemarks/:id
  router.get(
    '/:id',
    v.asyncHandler(async (req, res) => {
      const item = await store.get(req.params.id);
      if (!item) throw new v.HttpError(404, 'Placemark not found');
      res.json({ placemark: item });
    })
  );

  // POST /api/placemarks  { name, lat, lon, description? }
  router.post(
    '/',
    v.asyncHandler(async (req, res) => {
      const data = parse(req.body);
      if ((await store.count()) >= config.maxPlacemarks) {
        throw new v.HttpError(409, `You can save up to ${config.maxPlacemarks} places. Remove some first.`);
      }
      res.status(201).json({ placemark: await store.insert(data) });
    })
  );

  // PATCH /api/placemarks/:id  { name?, description? }
  router.patch(
    '/:id',
    v.asyncHandler(async (req, res) => {
      const item = await store.update(req.params.id, parse(req.body, { partial: true }));
      if (!item) throw new v.HttpError(404, 'Placemark not found');
      res.json({ placemark: item });
    })
  );

  // DELETE /api/placemarks/:id
  router.delete(
    '/:id',
    v.asyncHandler(async (req, res) => {
      if (!(await store.remove(req.params.id))) throw new v.HttpError(404, 'Placemark not found');
      res.status(204).end();
    })
  );

  // DELETE /api/placemarks  → remove all
  router.delete(
    '/',
    v.asyncHandler(async (req, res) => {
      await store.clear();
      res.status(204).end();
    })
  );

  return router;
}

module.exports = createPlacemarksRouter;
