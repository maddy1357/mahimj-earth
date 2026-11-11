'use strict';
/* API tests that need no internet access: health, validation, landmarks and the My places CRUD. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mahimj-earth-test-'));
const { createApp } = require('../src/app');

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

const call = async (method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
};

test('health check reports ok', async () => {
  const r = await call('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'ok');
  assert.equal(r.body.app, 'MahimJ Earth');
});

test('serves the frontend', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /MahimJ Earth/);
});

test('unknown API route returns JSON 404', async () => {
  const r = await call('GET', '/api/does-not-exist');
  assert.equal(r.status, 404);
  assert.ok(r.body.error);
});

test('geocoding endpoints validate their input', async () => {
  assert.equal((await call('GET', '/api/suggest?q=a')).status, 400);
  assert.equal((await call('GET', '/api/search')).status, 400);
  assert.equal((await call('GET', '/api/reverse?lat=95&lon=10')).status, 400);
  assert.equal((await call('GET', '/api/reverse?lat=10')).status, 400);
  assert.equal((await call('GET', '/api/lookup?osm=X12')).status, 400);
  assert.equal((await call('GET', '/api/wiki?lang=en')).status, 400);
  assert.equal((await call('GET', '/api/wiki?lang=<x>&title=Paris')).status, 400);
});

test('landmarks list, lookup and random', async () => {
  const list = await call('GET', '/api/explore?images=0');
  assert.equal(list.status, 200);
  assert.ok(list.body.landmarks.length >= 20);
  const first = list.body.landmarks[0];
  assert.equal((await call('GET', `/api/explore/${first.id}`)).body.landmark.name, first.name);
  assert.equal((await call('GET', '/api/explore/nope')).status, 404);
  const rnd = await call('GET', `/api/explore/random?exclude=${first.id}`);
  assert.notEqual(rnd.body.landmark.id, first.id);
});

test('placemarks CRUD and export', async () => {
  assert.equal((await call('POST', '/api/placemarks', { name: 'Bad', lat: 200, lon: 0 })).status, 400);
  assert.equal((await call('POST', '/api/placemarks', { lat: 1, lon: 1 })).status, 400);

  const created = await call('POST', '/api/placemarks', { name: 'Taj Mahal', lat: 27.1751, lon: 78.0421, description: 'Agra' });
  assert.equal(created.status, 201);
  const id = created.body.placemark.id;
  assert.ok(id);

  const list = await call('GET', '/api/placemarks');
  assert.equal(list.body.placemarks.length, 1);

  const renamed = await call('PATCH', `/api/placemarks/${id}`, { name: 'Taj' });
  assert.equal(renamed.body.placemark.name, 'Taj');
  assert.equal(renamed.body.placemark.lat, 27.1751);

  const exp = await fetch(`${base}/api/placemarks/export`);
  assert.match(exp.headers.get('content-type'), /geo\+json/);
  const geo = await exp.json();
  assert.deepEqual(geo.features[0].geometry.coordinates, [78.0421, 27.1751]);

  // Persisted to disk
  const onDisk = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR, 'placemarks.json'), 'utf8'));
  assert.equal(onDisk[0].name, 'Taj');

  assert.equal((await call('DELETE', `/api/placemarks/${id}`)).status, 204);
  assert.equal((await call('DELETE', `/api/placemarks/${id}`)).status, 404);
  assert.equal((await call('GET', '/api/placemarks')).body.placemarks.length, 0);
});

test('malformed JSON body is a 400', async () => {
  const res = await fetch(`${base}/api/placemarks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  assert.equal(res.status, 400);
});
