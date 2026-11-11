'use strict';
/* MahimJ Earth frontend: a 3D globe explorer powered by CesiumJS.
 * Imagery tiles load directly from free, key-less providers. Everything else
 * (search, place details, Wikipedia cards, landmarks and My places) comes from
 * the MahimJ Earth backend under /api.
 */

// =====================================================================
// Utilities
// =====================================================================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ms = (name, cls = '') => `<span class="ms ${cls}">${name}</span>`;
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;
const debounce = (fn, t) => {
  let h;
  return (...a) => {
    clearTimeout(h);
    h = setTimeout(() => fn(...a), t);
  };
};
const isMobile = () => matchMedia('(max-width: 720px)').matches;
const coordRe = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
const C = Cesium;

function fmtLL(lat, lon) {
  return `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'E' : 'W'}`;
}
function fmtDist(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km.toLocaleString(undefined, { maximumFractionDigits: km < 100 ? 2 : 0 })} km`;
}
const clip = (s, n) => (s.length > n ? `${s.slice(0, s.lastIndexOf(' ', n))}…` : s);

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* storage unavailable */
    }
  },
};

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), 2800);
}
async function copyText(text, msg = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg);
  } catch {
    toast(text);
  }
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// =====================================================================
// Imagery
// =====================================================================
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const IMAGERY = {
  satellite: {
    label: 'Satellite',
    thumb: `${ESRI}/World_Imagery/MapServer/tile/3/3/5`,
    make: () =>
      new C.UrlTemplateImageryProvider({
        url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
        maximumLevel: 19,
        credit: 'Imagery © Esri, Maxar, Earthstar Geographics',
      }),
  },
  streets: {
    label: 'Streets',
    thumb: 'https://tile.openstreetmap.org/3/5/3.png',
    make: () =>
      new C.UrlTemplateImageryProvider({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        maximumLevel: 19,
        credit: '© OpenStreetMap contributors',
      }),
  },
  terrain: {
    label: 'Terrain',
    thumb: 'https://a.tile.opentopomap.org/3/5/3.png',
    make: () =>
      new C.UrlTemplateImageryProvider({
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        subdomains: ['a', 'b', 'c'],
        maximumLevel: 17,
        credit: '© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)',
      }),
  },
  dark: {
    label: 'Dark',
    thumb: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/3/3/5`,
    make: () =>
      new C.UrlTemplateImageryProvider({
        url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
        maximumLevel: 16,
        credit: 'Basemap © Esri, HERE, Garmin, © OpenStreetMap contributors',
      }),
  },
};
const OVERLAYS = {
  labels: () =>
    new C.UrlTemplateImageryProvider({
      url: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
      maximumLevel: 19,
      credit: 'Labels © Esri',
    }),
  roads: () =>
    new C.UrlTemplateImageryProvider({
      url: `${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`,
      maximumLevel: 19,
      credit: 'Roads © Esri',
    }),
  grid: () =>
    new C.GridImageryProvider({
      cells: 4,
      color: C.Color.WHITE.withAlpha(0.35),
      glowColor: C.Color.WHITE.withAlpha(0.05),
      backgroundColor: C.Color.TRANSPARENT,
    }),
};

const prefs = Object.assign(
  { base: 'satellite', labels: true, roads: false, grid: false, atmosphere: true, lighting: false, stars: true },
  store.get('mahimj-earth:prefs', {})
);
if (!IMAGERY[prefs.base]) prefs.base = 'satellite';
const savePrefs = () => store.set('mahimj-earth:prefs', prefs);

// =====================================================================
// Viewer
// =====================================================================
const viewer = new C.Viewer('globe', {
  baseLayer: new C.ImageryLayer(IMAGERY[prefs.base].make()),
  baseLayerPicker: false,
  geocoder: false,
  animation: false,
  timeline: false,
  homeButton: false,
  navigationHelpButton: false,
  sceneModePicker: false,
  fullscreenButton: false,
  infoBox: false,
  selectionIndicator: false,
  creditContainer: $('#credits'),
});
const scene = viewer.scene;
const camera = viewer.camera;
const globe = scene.globe;
globe.maximumScreenSpaceError = 1.5;
viewer.clock.shouldAnimate = true;
viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(C.ScreenSpaceEventType.LEFT_CLICK);
scene.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

let baseLayer = viewer.imageryLayers.get(0);
const overlayLayers = {};

function setBase(id) {
  viewer.imageryLayers.remove(baseLayer, true);
  baseLayer = new C.ImageryLayer(IMAGERY[id].make());
  viewer.imageryLayers.add(baseLayer, 0);
  prefs.base = id;
  savePrefs();
  renderStyle();
}
function setOverlay(name, on) {
  if (on && !overlayLayers[name]) overlayLayers[name] = viewer.imageryLayers.addImageryProvider(OVERLAYS[name]());
  if (!on && overlayLayers[name]) {
    viewer.imageryLayers.remove(overlayLayers[name], true);
    delete overlayLayers[name];
  }
}
function applyEffects() {
  scene.skyAtmosphere.show = prefs.atmosphere;
  globe.showGroundAtmosphere = prefs.atmosphere;
  scene.fog.enabled = prefs.atmosphere;
  globe.enableLighting = prefs.lighting;
  scene.skyBox.show = prefs.stars;
  if (prefs.lighting) viewer.clock.currentTime = C.JulianDate.now();
}
['labels', 'roads', 'grid'].forEach((n) => setOverlay(n, prefs[n]));
applyEffects();

// =====================================================================
// Camera helpers
// =====================================================================
const DEG = C.Math.toDegrees;
const RAD = C.Math.toRadians;

function screenCenterCartesian() {
  const c = new C.Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2);
  return camera.pickEllipsoid(c, globe.ellipsoid);
}
function cartToLL(cart) {
  const g = C.Cartographic.fromCartesian(cart);
  return { lat: DEG(g.latitude), lon: DEG(g.longitude) };
}
function pickLL(pos) {
  const cart = camera.pickEllipsoid(pos, globe.ellipsoid);
  return cart ? { cart, ...cartToLL(cart) } : null;
}

let orbitRemove = null;
function startOrbit(center, range, pitch) {
  stopOrbit();
  let heading = camera.heading;
  orbitRemove = viewer.clock.onTick.addEventListener(() => {
    heading += 0.0012;
    camera.lookAt(center, new C.HeadingPitchRange(heading, pitch, range));
  });
}
function stopOrbit() {
  if (!orbitRemove) return;
  orbitRemove();
  orbitRemove = null;
  camera.lookAtTransform(C.Matrix4.IDENTITY);
}

function flyToPlace(lat, lon, { range = 1500, pitch = -35, orbit = true, duration } = {}) {
  stopOrbit();
  const center = C.Cartesian3.fromDegrees(lon, lat, 0);
  const p = RAD(pitch);
  camera.flyToBoundingSphere(new C.BoundingSphere(center, 1), {
    offset: new C.HeadingPitchRange(0, p, range),
    duration,
    complete: () => orbit && startOrbit(center, range, p),
  });
}
function flyToRect([s, n, w, e]) {
  stopOrbit();
  camera.flyTo({ destination: C.Rectangle.fromDegrees(w, s, e, n), duration: 3 });
}
function orbitAround(center, { heading = camera.heading, pitch = camera.pitch, rangeFactor = 1, duration = 0.8 } = {}) {
  stopOrbit();
  const range = C.Cartesian3.distance(camera.positionWC, center) * rangeFactor;
  if (range > 6e7) return;
  camera.flyToBoundingSphere(new C.BoundingSphere(center, 0), {
    offset: new C.HeadingPitchRange(heading, pitch, range),
    duration,
  });
}

// Any direct interaction with the globe takes over from an orbit animation.
const input = new C.ScreenSpaceEventHandler(scene.canvas);
[
  C.ScreenSpaceEventType.LEFT_DOWN,
  C.ScreenSpaceEventType.RIGHT_DOWN,
  C.ScreenSpaceEventType.MIDDLE_DOWN,
  C.ScreenSpaceEventType.WHEEL,
  C.ScreenSpaceEventType.PINCH_START,
].forEach((t) => input.setInputAction(() => stopOrbit(), t));

// =====================================================================
// Markers (selection pin, My places, my location)
// =====================================================================
const pinSvg = (fill, dot) =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="29" height="45" viewBox="-1 -1 29 45"><path d="M13.5 0C6 0 0 6 0 13.5 0 23.6 13.5 43 13.5 43S27 23.6 27 13.5C27 6 21 0 13.5 0z" fill="${fill}" stroke="#fff" stroke-width="1.5"/><circle cx="13.5" cy="13.5" r="5" fill="${dot}"/></svg>`
  );
const PIN_RED = pinSvg('#ea4335', '#a50e0e');
const PIN_YELLOW = pinSvg('#fbbc04', '#b06000');

function markerEntity(id, lat, lon, name, image) {
  return viewer.entities.add({
    id,
    position: C.Cartesian3.fromDegrees(lon, lat, 1),
    billboard: { image, verticalOrigin: C.VerticalOrigin.BOTTOM, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    label: name
      ? {
          text: name,
          font: '500 13px Roboto, Arial, sans-serif',
          fillColor: C.Color.WHITE,
          outlineColor: C.Color.fromCssColorString('#202124'),
          outlineWidth: 4,
          style: C.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: C.VerticalOrigin.BOTTOM,
          pixelOffset: new C.Cartesian2(0, -48),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new C.DistanceDisplayCondition(0, 9e6),
        }
      : undefined,
  });
}

// Billboards ignore depth so they never sink into the globe; hide the ones on the far side manually.
const occludable = new Set();
function updateOcclusion() {
  const occ = new C.EllipsoidalOccluder(globe.ellipsoid, camera.positionWC);
  const now = viewer.clock.currentTime;
  occludable.forEach((e) => {
    const p = e.position?.getValue(now);
    if (p) e.show = occ.isPointVisible(p);
  });
}
camera.percentageChanged = 0.01;
camera.changed.addEventListener(updateOcclusion);
camera.moveEnd.addEventListener(updateOcclusion);

let selection = null;
function setSelection(p) {
  if (selection) {
    occludable.delete(selection);
    viewer.entities.remove(selection);
  }
  selection = p ? markerEntity('selection', p.lat, p.lon, null, PIN_RED) : null;
  if (selection) occludable.add(selection);
  updateOcclusion();
}

// =====================================================================
// Panels
// =====================================================================
let activePanel = null;
const onPanelOpen = {
  search: () => {
    setTimeout(() => $('#searchInput').focus(), 220);
    if (!$('#searchInput').value) renderSearchHome();
  },
  explore: loadExplore,
  places: renderPlaces,
  style: renderStyle,
  measure: startMeasure,
};

function openPanel(name) {
  if (activePanel === name) return closePanel();
  if (activePanel === 'measure') stopMeasure();
  activePanel = name;
  document.body.classList.add('panel-open');
  $$('.panel-page').forEach((p) => p.classList.toggle('active', p.dataset.page === name));
  $$('.rail-btn[data-panel]').forEach((b) => b.classList.toggle('active', b.dataset.panel === name));
  onPanelOpen[name]?.();
}
function closePanel() {
  if (activePanel === 'measure') stopMeasure();
  activePanel = null;
  document.body.classList.remove('panel-open');
  $$('.rail-btn[data-panel]').forEach((b) => b.classList.remove('active'));
}
$$('.rail-btn[data-panel]').forEach((b) => b.addEventListener('click', () => openPanel(b.dataset.panel)));
$$('.panel-close').forEach((b) => b.addEventListener('click', closePanel));

const loadingHtml = (msg) => `<div class="state"><div class="spinner"></div>${msg}</div>`;
const emptyHtml = (icon, msg) => `<div class="state">${ms(icon)}${msg}</div>`;

// =====================================================================
// Search
// =====================================================================
const searchInput = $('#searchInput');
const searchBody = $('#searchBody');
let searchToken = 0;
let listItems = [];
let listActive = -1;

const PLACE_ICONS = {
  city: 'location_city', town: 'location_city', village: 'holiday_village', country: 'flag', state: 'map',
  administrative: 'map', peak: 'landscape', volcano: 'landscape', attraction: 'photo_camera', museum: 'museum',
  aerodrome: 'flight', airport: 'flight', station: 'train', island: 'landscape', water: 'water', river: 'water',
  park: 'park', beach: 'beach_access',
};
const placeIcon = (k) => PLACE_ICONS[k] || 'location_on';

function renderList(items, label, icon) {
  listItems = items;
  listActive = -1;
  searchBody.innerHTML =
    `<div class="list-label">${esc(label)}</div>` +
    items
      .map(
        (p, i) => `<div class="result" data-i="${i}">${ms(icon || placeIcon(p.kind))}<div><b>${esc(p.name)}</b>
          <small>${esc(p.address || p.category || fmtLL(p.lat, p.lon))}</small></div></div>`
      )
      .join('');
}
searchBody.addEventListener('click', (e) => {
  const r = e.target.closest('.result');
  if (r) goToPlace(listItems[+r.dataset.i]);
});

function renderSearchHome() {
  const recent = store.get('mahimj-earth:recent', []);
  if (recent.length) renderList(recent, 'Recent', 'history');
  else {
    listItems = [];
    searchBody.innerHTML = emptyHtml(
      'travel_explore',
      'Search for cities, landmarks and addresses,<br>or type coordinates like <b>27.1751, 78.0421</b>'
    );
  }
}
function addRecent(p) {
  const slim = { name: p.name, address: p.address || p.where || '', category: p.category || '', kind: p.kind, lat: p.lat, lon: p.lon, bbox: p.bbox || null, osm: p.osm || null, wiki: p.wiki || null };
  const list = store.get('mahimj-earth:recent', []).filter((r) => !(r.name === slim.name && Math.abs(r.lat - slim.lat) < 1e-4));
  store.set('mahimj-earth:recent', [slim, ...list].slice(0, 8));
}

function cameraCenterLL() {
  const c = screenCenterCartesian();
  return c ? cartToLL(c) : null;
}

const suggest = debounce(async () => {
  const q = searchInput.value.trim();
  const t = ++searchToken;
  if (q.length < 2) return renderSearchHome();
  if (coordRe.test(q)) {
    const [, la, lo] = q.match(coordRe);
    return renderList([{ name: q, address: 'Go to these coordinates', lat: +la, lon: +lo, kind: 'coords' }], 'Coordinates', 'pin_drop');
  }
  try {
    const c = cameraCenterLL();
    const { results } = await api(`/api/suggest?q=${enc(q)}${c ? `&lat=${c.lat.toFixed(3)}&lon=${c.lon.toFixed(3)}` : ''}`);
    if (t !== searchToken) return;
    if (results.length) renderList(results, 'Suggestions');
    else searchBody.innerHTML = emptyHtml('search_off', 'No suggestions. Press Enter for a full search.');
  } catch {
    /* suggestions are best-effort */
  }
}, 250);

searchInput.addEventListener('input', () => {
  $('#searchClear').hidden = !searchInput.value;
  suggest();
});
$('#searchClear').addEventListener('click', () => {
  searchInput.value = '';
  $('#searchClear').hidden = true;
  searchToken++;
  renderSearchHome();
  searchInput.focus();
});
searchInput.addEventListener('keydown', (e) => {
  const rows = $$('.result', searchBody);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!rows.length) return;
    e.preventDefault();
    listActive = e.key === 'ArrowDown' ? (listActive + 1) % rows.length : (listActive - 1 + rows.length) % rows.length;
    rows.forEach((r, i) => r.classList.toggle('active', i === listActive));
    rows[listActive].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (listActive >= 0 && listItems[listActive]) goToPlace(listItems[listActive]);
    else fullSearch(searchInput.value.trim());
  }
});

async function fullSearch(q) {
  if (!q) return;
  const m = q.match(coordRe);
  if (m) return whatsHere(+m[1], +m[2], { fly: true });
  const t = ++searchToken;
  searchBody.innerHTML = loadingHtml('Searching…');
  try {
    const { results } = await api(`/api/search?q=${enc(q)}`);
    if (t !== searchToken) return;
    if (!results.length) {
      searchBody.innerHTML = emptyHtml('search_off', `No results for “${esc(q)}”`);
      return;
    }
    renderList(results, `Results for “${q}”`);
    if (results.length === 1) goToPlace(results[0]);
  } catch (e) {
    if (t === searchToken) searchBody.innerHTML = emptyHtml('cloud_off', esc(e.message));
  }
}

function isArea(p) {
  if (!p.bbox) return false;
  const [s, n, w, e] = p.bbox;
  return Math.abs(n - s) > 0.03 || Math.abs(e - w) > 0.03;
}

function goToPlace(p) {
  if (p.kind === 'coords') return whatsHere(p.lat, p.lon, { fly: true });
  addRecent(p);
  if (isArea(p)) flyToRect(p.bbox);
  else flyToPlace(p.lat, p.lon, { range: p.range || 1400, pitch: p.pitch || -35 });
  setSelection(p);
  showCard(p);
  if (isMobile()) closePanel();
}

// =====================================================================
// Knowledge card
// =====================================================================
let cardToken = 0;
let cardPlace = null;

function parseWikiTag(tag) {
  if (!tag || !tag.includes(':')) return null;
  const [lang, ...rest] = tag.split(':');
  return { lang, title: rest.join(':') };
}

async function showCard(p) {
  const t = ++cardToken;
  cardPlace = p;
  renderCard(p, null, true);
  let details = p;
  if (p.osm && !p.tags) {
    try {
      const { place } = await api(`/api/lookup?osm=${p.osm.type}${p.osm.id}`);
      if (place) details = { ...p, tags: place.tags, address: p.address || place.address };
    } catch {
      /* details are optional */
    }
  }
  const w = p.wiki ? { lang: 'en', title: p.wiki } : parseWikiTag(details.tags?.wikipedia);
  let wiki = null;
  if (w) {
    try {
      wiki = await api(`/api/wiki?lang=${enc(w.lang)}&title=${enc(w.title)}`);
    } catch {
      /* no summary available */
    }
  }
  if (t !== cardToken) return;
  cardPlace = details;
  renderCard(details, wiki, false);
}

function renderCard(p, wiki, loading) {
  const k = $('#kcard');
  const img = wiki?.image || wiki?.thumbnail;
  const sub = wiki?.description || p.where || p.category || '';
  k.innerHTML = `
    ${img ? `<div class="kc-img" style="background-image:url('${esc(img)}')"></div>` : ''}
    <button class="icon-btn kc-close ${img ? 'on-img' : ''}" title="Close">${ms('close')}</button>
    <div class="kc-body">
      <h2>${esc(p.name)}</h2>
      ${sub ? `<div class="kc-sub">${esc(sub)}</div>` : ''}
      ${wiki?.extract ? `<p class="kc-text">${esc(clip(wiki.extract, 440))}</p>` : loading ? '<p class="kc-text">Loading details…</p>' : ''}
      ${p.address && !p.where ? `<p class="kc-text">${esc(p.address)}</p>` : ''}
      <div class="kc-meta" id="kcCoords" title="Copy coordinates">${ms('my_location')}<span>${fmtLL(p.lat, p.lon)}</span>${ms('content_copy')}</div>
      <div class="kc-actions">
        <button class="text-btn filled" id="kcFly">${ms('flight_takeoff')} Fly here</button>
        ${p.placemarkId ? `<button class="text-btn danger" id="kcRemove">${ms('delete')} Remove</button>` : `<button class="text-btn" id="kcPin">${ms('add_location_alt')} Add to My places</button>`}
        ${wiki?.url ? `<a class="text-btn" href="${esc(wiki.url)}" target="_blank" rel="noopener">${ms('open_in_new')} Wikipedia</a>` : ''}
      </div>
    </div>`;
  k.hidden = false;
  k.querySelector('.kc-close').onclick = hideCard;
  $('#kcCoords').onclick = () => copyText(`${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`, 'Coordinates copied');
  $('#kcFly').onclick = () => (isArea(p) ? flyToRect(p.bbox) : flyToPlace(p.lat, p.lon, { range: p.range || 1400, pitch: p.pitch || -35 }));
  $('#kcPin')?.addEventListener('click', () => addPlacemark({ name: p.name, lat: p.lat, lon: p.lon, description: wiki?.description || p.where || p.address || '' }));
  $('#kcRemove')?.addEventListener('click', () => deletePlacemark(p.placemarkId).then(hideCard));
}
function hideCard() {
  cardToken++;
  cardPlace = null;
  $('#kcard').hidden = true;
  setSelection(null);
}

async function whatsHere(lat, lon, { fly = false } = {}) {
  if (fly) flyToPlace(lat, lon, { range: 3000, orbit: false });
  const base = { name: 'Dropped pin', category: 'Location', lat, lon };
  setSelection(base);
  const t = ++cardToken;
  renderCard(base, null, true);
  try {
    const h = camera.positionCartographic.height;
    const zoom = h > 5e6 ? 3 : h > 1e6 ? 5 : h > 2e5 ? 8 : h > 3e4 ? 12 : 18;
    const { place } = await api(`/api/reverse?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&zoom=${zoom}`);
    if (t !== cardToken) return;
    showCard({ ...place, lat, lon, bbox: null });
  } catch {
    if (t === cardToken) renderCard(base, null, false);
  }
}

// =====================================================================
// Explore & Surprise me
// =====================================================================
let landmarks = null;
async function loadExplore() {
  const grid = $('#exploreGrid');
  if (landmarks) return;
  grid.innerHTML = loadingHtml('Loading places…');
  try {
    ({ landmarks } = await api('/api/explore'));
    grid.innerHTML = landmarks
      .map(
        (l, i) => `<button class="xcard" data-i="${i}">
          <div class="xcard-img" style="${l.thumbnail ? `background-image:url('${esc(l.thumbnail)}')` : ''}"></div>
          <div class="xcard-body"><b>${esc(l.name)}</b><small>${esc(l.where)}</small></div></button>`
      )
      .join('');
  } catch (e) {
    landmarks = null;
    grid.innerHTML = emptyHtml('cloud_off', esc(e.message));
  }
}
$('#exploreGrid').addEventListener('click', (e) => {
  const c = e.target.closest('.xcard');
  if (c) goToLandmark(landmarks[+c.dataset.i]);
});

function goToLandmark(l) {
  flyToPlace(l.lat, l.lon, { range: l.range, pitch: l.pitch || -35 });
  const p = { name: l.name, where: l.where, lat: l.lat, lon: l.lon, range: l.range, pitch: l.pitch, wiki: l.wiki, category: 'Landmark' };
  setSelection(p);
  showCard(p);
  if (isMobile()) closePanel();
}

let lastLucky = '';
$('#luckyBtn').addEventListener('click', async () => {
  try {
    const { landmark } = await api(`/api/explore/random?exclude=${enc(lastLucky)}`);
    lastLucky = landmark.id;
    toast(`Flying to ${landmark.name}…`);
    goToLandmark(landmark);
  } catch (e) {
    toast(e.message);
  }
});

// =====================================================================
// My places (stored by the backend)
// =====================================================================
let placemarks = [];
const pinEntities = new Map();

function syncPins() {
  for (const [id, ent] of pinEntities) {
    if (!placemarks.some((p) => p.id === id)) {
      viewer.entities.remove(ent);
      occludable.delete(ent);
      pinEntities.delete(id);
    }
  }
  placemarks.forEach((p) => {
    if (pinEntities.has(p.id)) return;
    const ent = markerEntity(`pin:${p.id}`, p.lat, p.lon, p.name, PIN_YELLOW);
    pinEntities.set(p.id, ent);
    occludable.add(ent);
  });
  updateOcclusion();
}

async function loadPlacemarks() {
  try {
    ({ placemarks } = await api('/api/placemarks'));
    syncPins();
    if (activePanel === 'places') renderPlaces();
  } catch {
    toast('Could not load My places from the server');
  }
}

async function addPlacemark(data) {
  try {
    const { placemark } = await api('/api/placemarks', { method: 'POST', body: data });
    placemarks.unshift(placemark);
    syncPins();
    renderPlaces();
    toast(`Added “${placemark.name}” to My places`);
  } catch (e) {
    toast(e.message);
  }
}
async function deletePlacemark(id) {
  try {
    await api(`/api/placemarks/${enc(id)}`, { method: 'DELETE' });
    placemarks = placemarks.filter((p) => p.id !== id);
    syncPins();
    renderPlaces();
    toast('Removed from My places');
  } catch (e) {
    toast(e.message);
  }
}

function renderPlaces() {
  $('#placesList').innerHTML = placemarks.length
    ? placemarks
        .map(
          (p) => `<li data-id="${esc(p.id)}">${ms('location_on')}<div><b>${esc(p.name)}</b><small>${esc(p.description || fmtLL(p.lat, p.lon))}</small></div>
            <button class="icon-btn" data-del title="Remove">${ms('delete')}</button></li>`
        )
        .join('')
    : `<li class="empty">${ms('bookmark_add')} No places saved yet</li>`;
}
$('#placesList').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-id]');
  if (!li) return;
  const p = placemarks.find((x) => x.id === li.dataset.id);
  if (!p) return;
  if (e.target.closest('[data-del]')) return deletePlacemark(p.id);
  openPlacemark(p);
});
function openPlacemark(p) {
  flyToPlace(p.lat, p.lon, { range: 2000, orbit: false });
  setSelection(null);
  showCard({ name: p.name, category: 'My place', where: p.description, lat: p.lat, lon: p.lon, placemarkId: p.id });
  if (isMobile()) closePanel();
}
$('#exportPins').addEventListener('click', () => {
  if (!placemarks.length) return toast('Nothing to export yet');
  location.href = '/api/placemarks/export';
});
$('#clearPins').addEventListener('click', async () => {
  if (!placemarks.length || !confirm('Remove all of your saved places?')) return;
  try {
    await api('/api/placemarks', { method: 'DELETE' });
    placemarks = [];
    syncPins();
    renderPlaces();
  } catch (e) {
    toast(e.message);
  }
});

// =====================================================================
// Map style panel
// =====================================================================
function renderStyle() {
  $('#styleGrid').innerHTML = Object.entries(IMAGERY)
    .map(
      ([id, b]) => `<button class="style-card ${id === prefs.base ? 'active' : ''}" data-base="${id}">
        <span class="sc-img" style="background-image:url('${b.thumb}')"></span>
        <span class="sc-name">${b.label}${ms('check_circle', 'filled')}</span></button>`
    )
    .join('');
}
$('#styleGrid').addEventListener('click', (e) => {
  const b = e.target.closest('.style-card');
  if (b && b.dataset.base !== prefs.base) setBase(b.dataset.base);
});

const SWITCHES = { optLabels: 'labels', optRoads: 'roads', optGrid: 'grid', optAtmosphere: 'atmosphere', optLighting: 'lighting', optStars: 'stars' };
Object.entries(SWITCHES).forEach(([elId, key]) => {
  const el = $(`#${elId}`);
  el.checked = prefs[key];
  el.addEventListener('change', () => {
    prefs[key] = el.checked;
    savePrefs();
    if (['labels', 'roads', 'grid'].includes(key)) setOverlay(key, el.checked);
    else applyEffects();
  });
});

let spinning = false;
$('#optSpin').addEventListener('change', (e) => (spinning = e.target.checked));
viewer.clock.onTick.addEventListener(() => {
  if (spinning && !orbitRemove) camera.rotate(C.Cartesian3.UNIT_Z, -0.0012);
});

// =====================================================================
// Measure
// =====================================================================
let measure = null;
const groundLines = C.GroundPolylinePrimitive.isSupported(scene);

function startMeasure() {
  stopMeasure();
  measure = { pts: [], ents: [], line: null };
  scene.canvas.style.cursor = 'crosshair';
  updateMeasureUI();
}
function stopMeasure() {
  if (!measure) return;
  measure.ents.forEach((e) => viewer.entities.remove(e));
  if (measure.line) viewer.entities.remove(measure.line);
  measure = null;
  scene.canvas.style.cursor = '';
}
function measureTotal() {
  let total = 0;
  for (let i = 1; i < measure.pts.length; i++) {
    const g = new C.EllipsoidGeodesic(C.Cartographic.fromCartesian(measure.pts[i - 1]), C.Cartographic.fromCartesian(measure.pts[i]));
    total += g.surfaceDistance;
  }
  return total;
}
function redrawMeasure() {
  if (measure.line) viewer.entities.remove(measure.line);
  measure.line = null;
  if (measure.pts.length > 1) {
    measure.line = viewer.entities.add({
      polyline: {
        positions: measure.pts.slice(),
        width: 3,
        material: C.Color.fromCssColorString('#fbbc04'),
        clampToGround: groundLines,
        arcType: C.ArcType.GEODESIC,
      },
    });
  }
  updateMeasureUI();
}
function addMeasurePoint(cart) {
  measure.pts.push(cart);
  measure.ents.push(
    viewer.entities.add({
      position: cart,
      point: {
        pixelSize: 10,
        color: C.Color.WHITE,
        outlineColor: C.Color.fromCssColorString('#1a73e8'),
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  );
  redrawMeasure();
}
function updateMeasureUI() {
  const total = measure ? measureTotal() : 0;
  $('#mDist').textContent = total ? `${fmtDist(total)}` : '0 m';
  $('#mDist').title = total ? `${(total / 1609.344).toFixed(2)} miles` : '';
  $('#mPts').textContent = measure ? measure.pts.length : 0;
}
$('#mUndo').addEventListener('click', () => {
  if (!measure?.pts.length) return;
  measure.pts.pop();
  viewer.entities.remove(measure.ents.pop());
  redrawMeasure();
});
$('#mClear').addEventListener('click', () => {
  if (activePanel === 'measure') startMeasure();
});

// =====================================================================
// Globe interactions: click, double-click, right-click menu, cursor readout
// =====================================================================
input.setInputAction((e) => {
  hideCtx();
  if (measure) {
    const p = pickLL(e.position);
    if (p) addMeasurePoint(p.cart);
    return;
  }
  const picked = scene.pick(e.position);
  const id = picked?.id?.id;
  if (typeof id === 'string' && id.startsWith('pin:')) {
    const p = placemarks.find((x) => x.id === id.slice(4));
    if (p) openPlacemark(p);
  }
}, C.ScreenSpaceEventType.LEFT_CLICK);

input.setInputAction((e) => {
  if (measure) return;
  const p = pickLL(e.position);
  if (p) orbitAround(p.cart, { rangeFactor: 0.4, duration: 0.9 });
}, C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

input.setInputAction((e) => {
  const p = pickLL(e.position);
  if (!p) return;
  const m = $('#ctxMenu');
  m.innerHTML = `
    <button data-a="copy" class="ctx-coords">${fmtLL(p.lat, p.lon)}</button>
    <button data-a="what">${ms('help')} What's here?</button>
    <button data-a="pin">${ms('add_location_alt')} Add placemark</button>
    <button data-a="fly">${ms('zoom_in_map')} Zoom in here</button>
    <button data-a="measure">${ms('straighten')} Measure from here</button>`;
  m.hidden = false;
  m.style.left = `${Math.min(e.position.x + scene.canvas.getBoundingClientRect().left, innerWidth - m.offsetWidth - 8)}px`;
  m.style.top = `${Math.min(e.position.y + scene.canvas.getBoundingClientRect().top, innerHeight - m.offsetHeight - 8)}px`;
  m.onclick = async (ev) => {
    const a = ev.target.closest('button')?.dataset.a;
    if (!a) return;
    hideCtx();
    if (a === 'copy') copyText(`${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`, 'Coordinates copied');
    if (a === 'what') whatsHere(p.lat, p.lon);
    if (a === 'fly') orbitAround(p.cart, { rangeFactor: 0.25, duration: 1.2 });
    if (a === 'measure') {
      if (activePanel !== 'measure') openPanel('measure');
      addMeasurePoint(p.cart);
    }
    if (a === 'pin') {
      let name = `Placemark ${placemarks.length + 1}`;
      try {
        const { place } = await api(`/api/reverse?lat=${p.lat.toFixed(6)}&lon=${p.lon.toFixed(6)}&zoom=16`);
        if (place?.name) name = place.name;
      } catch {
        /* fall back to a numbered name */
      }
      addPlacemark({ name, lat: p.lat, lon: p.lon, description: fmtLL(p.lat, p.lon) });
    }
  };
}, C.ScreenSpaceEventType.RIGHT_CLICK);

function hideCtx() {
  $('#ctxMenu').hidden = true;
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('#ctxMenu')) hideCtx();
});

let moveFrame = 0;
input.setInputAction((e) => {
  if (moveFrame) return;
  moveFrame = requestAnimationFrame(() => {
    moveFrame = 0;
    const p = pickLL(e.endPosition);
    $('#cursorPos').textContent = p ? fmtLL(p.lat, p.lon) : '';
  });
}, C.ScreenSpaceEventType.MOUSE_MOVE);

// =====================================================================
// Right-hand controls & status bar
// =====================================================================
$('#zoomIn').addEventListener('click', () => {
  const c = screenCenterCartesian();
  if (c) orbitAround(c, { rangeFactor: 0.5, duration: 0.6 });
});
$('#zoomOut').addEventListener('click', () => {
  const c = screenCenterCartesian();
  if (c) orbitAround(c, { rangeFactor: 2, duration: 0.6 });
  else camera.zoomOut(camera.positionCartographic.height);
});
$('#compass').addEventListener('click', () => {
  const c = screenCenterCartesian();
  if (c) orbitAround(c, { heading: 0 });
  else camera.flyTo({ destination: camera.positionWC.clone(), orientation: { heading: 0, pitch: camera.pitch, roll: 0 }, duration: 0.8 });
});
$('#tiltBtn').addEventListener('click', () => {
  const c = screenCenterCartesian();
  if (!c) return toast('Point the camera at the globe first');
  const tilted = DEG(camera.pitch) > -75;
  orbitAround(c, { pitch: RAD(tilted ? -90 : -45), duration: 1.2 });
});
$('#fsBtn').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
});
document.addEventListener('fullscreenchange', () => {
  $('#fsBtn .ms').textContent = document.fullscreenElement ? 'fullscreen_exit' : 'fullscreen';
});

let meEntity = null;
$('#locateBtn').addEventListener('click', () => {
  const btn = $('#locateBtn');
  if (!navigator.geolocation) return toast('Geolocation is not supported by this browser');
  btn.classList.add('busy');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      btn.classList.remove('busy');
      btn.classList.add('active');
      const { latitude: lat, longitude: lon } = pos.coords;
      if (meEntity) {
        viewer.entities.remove(meEntity);
        occludable.delete(meEntity);
      }
      meEntity = viewer.entities.add({
        position: C.Cartesian3.fromDegrees(lon, lat, 1),
        point: {
          pixelSize: 16,
          color: C.Color.fromCssColorString('#1a73e8'),
          outlineColor: C.Color.WHITE,
          outlineWidth: 3,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      occludable.add(meEntity);
      flyToPlace(lat, lon, { range: 3000, orbit: false });
    },
    (err) => {
      btn.classList.remove('busy');
      toast(`Couldn't get your location: ${err.message}`);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

$('#shareBtn').addEventListener('click', () => copyText(location.href, 'Link to this view copied'));

let lastAlt = '';
let lastHeading = NaN;
let lastTilt = '';
scene.postRender.addEventListener(() => {
  const h = camera.positionCartographic.height;
  const alt = `Camera: ${fmtDist(h)}`;
  if (alt !== lastAlt) $('#cameraAlt').textContent = lastAlt = alt;
  const heading = Math.round(DEG(camera.heading) * 10) / 10;
  if (heading !== lastHeading) {
    $('#compassRose').style.transform = `rotate(${-heading}deg)`;
    lastHeading = heading;
  }
  const tilt = DEG(camera.pitch) > -75 ? '2D' : '3D';
  if (tilt !== lastTilt) $('#tiltBtn').textContent = lastTilt = tilt;
});

globe.tileLoadProgressEvent.addEventListener((n) => ($('#loading').hidden = n === 0));

// Keep the URL in sync with the camera so views can be shared.
camera.moveEnd.addEventListener(() => {
  if (orbitRemove) return;
  const g = camera.positionCartographic;
  const hash = `#@${DEG(g.latitude).toFixed(5)},${DEG(g.longitude).toFixed(5)},${Math.round(g.height)}a,${Math.round(DEG(camera.heading))}h,${Math.round(DEG(camera.pitch))}p`;
  history.replaceState(null, '', hash);
  $('#locateBtn').classList.remove('active');
});

document.addEventListener('keydown', (e) => {
  const typing = /input|textarea/i.test(document.activeElement?.tagName);
  if (e.key === 'Escape') {
    hideCtx();
    if (!$('#kcard').hidden) hideCard();
    else if (activePanel) closePanel();
  }
  if (!typing && e.key === '/') {
    e.preventDefault();
    if (activePanel !== 'search') openPanel('search');
  }
});

// =====================================================================
// Boot
// =====================================================================
function restoreFromHash() {
  const m = location.hash.match(/@(-?[\d.]+),(-?[\d.]+),([\d.]+)a,(-?[\d.]+)h,(-?[\d.]+)p/);
  if (!m) return false;
  const [lat, lon, h, heading, pitch] = m.slice(1).map(Number);
  if (![lat, lon, h, heading, pitch].every(Number.isFinite)) return false;
  camera.setView({
    destination: C.Cartesian3.fromDegrees(lon, lat, h),
    orientation: { heading: RAD(heading), pitch: RAD(pitch), roll: 0 },
  });
  return true;
}

if (!restoreFromHash()) {
  // Intro: start far out in space and glide in towards the home view.
  camera.setView({ destination: C.Cartesian3.fromDegrees(30, 15, 4.2e7) });
  camera.flyTo({ destination: C.Cartesian3.fromDegrees(78.9629, 20.5937, 1.8e7), duration: 3 });
}
renderStyle();
loadPlacemarks();
