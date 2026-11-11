/* MahimJ Earth – interactive 3D globe explorer powered by CesiumJS.
 * Uses free, key-less imagery (Esri World Imagery, OpenStreetMap, CARTO)
 * and OpenStreetMap Nominatim for place search.
 */

// ---------- Imagery layers ----------
const IMAGERY = {
  satellite: () =>
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maximumLevel: 19,
      credit: 'Imagery © Esri, Maxar, Earthstar Geographics',
    }),
  streets: () =>
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      maximumLevel: 19,
      credit: '© OpenStreetMap contributors',
    }),
  dark: () =>
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      subdomains: ['a', 'b', 'c', 'd'],
      maximumLevel: 19,
      credit: '© OpenStreetMap contributors © CARTO',
    }),
};

const LABELS = () =>
  new Cesium.UrlTemplateImageryProvider({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    maximumLevel: 19,
    credit: 'Labels © Esri',
  });

// ---------- Viewer ----------
const viewer = new Cesium.Viewer('globe', {
  baseLayer: new Cesium.ImageryLayer(IMAGERY.satellite()),
  baseLayerPicker: false, // default picker needs a Cesium ion token
  geocoder: false, // we provide our own search (Nominatim)
  animation: false,
  timeline: false,
  homeButton: false,
  navigationHelpButton: false,
  sceneModePicker: true, // 3D / 2D / Columbus view
  fullscreenButton: true,
  infoBox: true,
  selectionIndicator: true,
});

viewer.scene.globe.enableLighting = false;
viewer.scene.skyAtmosphere.show = true;
viewer.scene.globe.showGroundAtmosphere = true;
viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

let baseLayer = viewer.imageryLayers.get(0);
let labelsLayer = viewer.imageryLayers.addImageryProvider(LABELS());

const HOME = { lon: 78.9629, lat: 20.5937, height: 20000000 };
function goHome() {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(HOME.lon, HOME.lat, HOME.height),
    duration: 2,
  });
}
viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(HOME.lon, HOME.lat, HOME.height) });

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km` : `${Math.round(meters)} m`;
}

function formatLatLon(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(5)}° ${ns}, ${Math.abs(lon).toFixed(5)}° ${ew}`;
}

function flyToPlace(lat, lon, height = 2500, pitchDeg = -45) {
  // Offset the camera south of the target so the tilted view centres on it.
  const offsetLat = height / Math.tan(Cesium.Math.toRadians(-pitchDeg)) / 111320;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat - offsetLat, height),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(pitchDeg), roll: 0 },
    duration: 3,
  });
}

function addPin(lat, lon, name, description = '') {
  return viewer.entities.add({
    name,
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    point: {
      pixelSize: 12,
      color: Cesium.Color.fromCssColorString('#ef4444'),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: name,
      font: '14px system-ui, sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -14),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    description: `<p>${description}</p><p><b>Coordinates:</b> ${formatLatLon(lat, lon)}</p>`,
  });
}

// ---------- Search (OpenStreetMap Nominatim) ----------
const resultsEl = $('#searchResults');

$('#searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('#searchInput').value.trim();
  if (!q) return;
  resultsEl.innerHTML = '<li>Searching…</li>';
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const places = await res.json();
    resultsEl.innerHTML = '';
    if (!places.length) {
      resultsEl.innerHTML = '<li>No results found</li>';
      return;
    }
    places.forEach((p) => {
      const li = document.createElement('li');
      li.textContent = p.display_name;
      li.addEventListener('click', () => {
        const lat = parseFloat(p.lat);
        const lon = parseFloat(p.lon);
        const [south, north, west, east] = p.boundingbox.map(Number);
        const rect = Cesium.Rectangle.fromDegrees(west, south, east, north);
        viewer.camera.flyTo({ destination: rect, duration: 3 });
        addPin(lat, lon, p.name || q, p.display_name);
        resultsEl.innerHTML = '';
      });
      resultsEl.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    resultsEl.innerHTML = '<li>Search failed – check your connection</li>';
  }
});

// ---------- Layer switching ----------
$('#layerChips').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-layer]');
  if (!btn) return;
  document.querySelectorAll('#layerChips button').forEach((b) => b.classList.toggle('active', b === btn));
  viewer.imageryLayers.remove(baseLayer, true);
  baseLayer = new Cesium.ImageryLayer(IMAGERY[btn.dataset.layer]());
  viewer.imageryLayers.add(baseLayer, 0);
});

$('#labelsToggle').addEventListener('change', (e) => {
  labelsLayer.show = e.target.checked;
});

$('#lightingToggle').addEventListener('change', (e) => {
  viewer.scene.globe.enableLighting = e.target.checked;
  // Show the real current sun position
  viewer.clock.currentTime = Cesium.JulianDate.now();
  viewer.clock.shouldAnimate = e.target.checked;
});

let spinning = false;
$('#spinToggle').addEventListener('change', (e) => {
  spinning = e.target.checked;
});
viewer.clock.onTick.addEventListener(() => {
  if (spinning && viewer.scene.mode === Cesium.SceneMode.SCENE3D) {
    viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, -0.0015);
  }
});
viewer.clock.shouldAnimate = true;

// ---------- Famous places tour ----------
const TOUR = [
  { name: 'Taj Mahal', lat: 27.1751, lon: 78.0421, h: 900 },
  { name: 'Eiffel Tower', lat: 48.8584, lon: 2.2945, h: 900 },
  { name: 'Mount Everest', lat: 27.9881, lon: 86.925, h: 15000 },
  { name: 'Grand Canyon', lat: 36.1069, lon: -112.1129, h: 12000 },
  { name: 'Sydney Opera House', lat: -33.8568, lon: 151.2153, h: 900 },
  { name: 'Statue of Liberty', lat: 40.6892, lon: -74.0445, h: 700 },
  { name: 'Great Pyramid', lat: 29.9792, lon: 31.1342, h: 1200 },
  { name: 'Burj Khalifa', lat: 25.1972, lon: 55.2744, h: 1500 },
];

const tourEl = $('#tour');
TOUR.forEach((place) => {
  const b = document.createElement('button');
  b.textContent = place.name;
  b.addEventListener('click', () => {
    $('#spinToggle').checked = spinning = false;
    flyToPlace(place.lat, place.lon, place.h);
  });
  tourEl.appendChild(b);
});

// ---------- Buttons ----------
$('#homeBtn').addEventListener('click', goHome);
$('#clearPins').addEventListener('click', () => viewer.entities.removeAll());
$('#togglePanel').addEventListener('click', () => {
  const panel = $('#panel');
  panel.classList.toggle('collapsed');
  $('#togglePanel').textContent = panel.classList.contains('collapsed') ? '+' : '−';
});

$('#myLocation').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocation is not supported by your browser.');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      addPin(latitude, longitude, 'You are here', 'Your current location');
      flyToPlace(latitude, longitude, 3000);
    },
    (err) => alert(`Could not get your location: ${err.message}`),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

// ---------- Cursor coordinates & camera altitude ----------
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

function pickLatLon(position) {
  const cartesian = viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
  if (!cartesian) return null;
  const carto = Cesium.Cartographic.fromCartesian(cartesian);
  return { lat: Cesium.Math.toDegrees(carto.latitude), lon: Cesium.Math.toDegrees(carto.longitude) };
}

handler.setInputAction((movement) => {
  const p = pickLatLon(movement.endPosition);
  $('#cursorPos').textContent = p ? formatLatLon(p.lat, p.lon) : 'Space';
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

handler.setInputAction((click) => {
  const p = pickLatLon(click.position);
  if (!p) return;
  const pin = addPin(p.lat, p.lon, `Pin ${viewer.entities.values.length + 1}`, 'Dropped pin');
  viewer.selectedEntity = pin;
}, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

viewer.camera.changed.addEventListener(updateAltitude);
viewer.camera.percentageChanged = 0.01;
function updateAltitude() {
  const h = viewer.camera.positionCartographic.height;
  $('#cameraAlt').textContent = `Eye altitude: ${formatDistance(h)}`;
}
updateAltitude();
