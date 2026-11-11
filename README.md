# 🌍 MahimJ Earth

**MahimJ Earth** is a 3D globe explorer in the style of Google Earth. Spin the planet, fly from space down to street level over real satellite imagery, search any place, read about famous landmarks and save your own placemarks.

It is a full-stack app:

- **Frontend:** [CesiumJS](https://cesium.com/platform/cesiumjs/) 3D globe with a dark interface: navigation rail, slide-out panels, knowledge cards and a compass.
- **Backend:** a [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) API that handles search, place details, Wikipedia summaries, curated landmarks and **My places** storage.

It uses only free, open data, so you don't need an API key or account.

> Looking for a 2D street map with directions? See the sister project **[mahimj-maps](https://github.com/maddy1357/mahimj-maps)**.

---

## ✨ Features

### Interface
| | |
|---|---|
| 🧭 **Navigation rail** | Search, Explore, Surprise me, My places, Map style, Measure and Share, one click away |
| 🔍 **Search** | Suggestions as you type, full search on Enter, recent searches, and coordinates such as `27.1751, 78.0421` |
| 🗂️ **Knowledge cards** | Photo, description and summary from Wikipedia, coordinates (click to copy), plus *Fly here*, *Add to My places* and *Wikipedia* actions |
| 🌐 **Explore** | 24 wonders of the world as photo cards. Each flight ends with a slow cinematic orbit |
| 🎲 **Surprise me** | Fly to a random landmark |
| 📌 **My places** | Save placemarks on the server, see them on the globe, fly to them, delete them, or export as **GeoJSON** |
| 🗺️ **Map style** | Satellite, Streets, Terrain and Dark imagery, plus toggles for labels and borders, roads, gridlines, atmosphere, sun and night shadow, stars and auto-rotate |
| 📏 **Measure** | Click points to measure distance along the curve of the Earth |
| 🖱️ **Right-click menu** | *What's here?*, *Add placemark*, *Zoom in here*, *Measure from here*, copy coordinates |
| 🧭 **Controls** | Live compass (click to face north), 2D/3D tilt toggle, smooth zoom, my location, full screen |
| 🔗 **Shareable views** | The URL tracks the camera (`#@lat,lon,altitude a,heading h,pitch p`), so any view can be shared |
| 📱 **Responsive** | On phones the rail becomes a bottom bar and panels become bottom sheets |

### Backend
- **Geocoding proxy** to OpenStreetMap Photon and Nominatim, with results normalised to one *place* format.
- Sends the **1 request per second** maximum that the Nominatim usage policy allows, with an identifying User-Agent.
- **Caching** in memory: an LRU cache with expiry that also merges duplicate requests made at the same time.
- **Wikipedia summaries** for the knowledge cards.
- **Curated landmarks** API.
- **My places REST API** saved to a JSON file with atomic writes, plus a GeoJSON export.
- Input **validation**, per-IP **rate limiting**, security headers, JSON errors and a health check.
- **Automated tests** that need no internet access (`npm test`).

---

## 🤔 Why we built this

- **Learning:** to understand how 3D geospatial apps work end to end: globe rendering, camera maths, imagery tiles, geocoding, and a backend that talks to third-party APIs responsibly.
- **Open and free:** Google Earth is closed-source. MahimJ Earth is built entirely from **open-source software and open data**, with no API keys, billing or sign-up.
- **A proper backend:** keeping third-party calls on the server lets us cache, rate-limit, follow the providers' usage policies and store user data, which a browser-only app cannot do well.
- **A base to build on:** easy to extend with 3D terrain, buildings, KML import, user accounts or a database.

---

## 🚀 Getting started

### Prerequisites
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) **18.17 or newer**
- A modern browser with WebGL (Chrome, Edge, Firefox or Safari)
- An internet connection (imagery and data services are online)

### 1. Clone the repository
```bash
git clone https://github.com/maddy1357/mahimj-earth.git
cd mahimj-earth
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the app (frontend and backend together)
```bash
npm start
```
Open **http://localhost:3000**. The same server serves the frontend and the API at `/api`.

| Command | What it does |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start with auto-restart when backend files change |
| `npm test` | Run the backend API tests |

---

## ⚙️ Configuration

You can set these optional environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` | Folder where `placemarks.json` is stored |
| `RATE_LIMIT_PER_MIN` | `120` | API requests allowed per minute per IP |
| `MAX_PLACEMARKS` | `500` | Maximum number of saved places |
| `NOMINATIM_URL` | `https://nominatim.openstreetmap.org` | Use your own Nominatim instance |
| `PHOTON_URL` | `https://photon.komoot.io` | Use your own Photon instance |
| `USER_AGENT` | `MahimJ-Earth/<version> (+repo URL)` | User-Agent sent to upstream services |

```bash
# macOS / Linux
PORT=8080 npm start
# Windows PowerShell
$env:PORT=8080; npm start
```

---

## 🔌 API reference

All responses are JSON. Errors look like `{ "error": "message" }` with a matching HTTP status.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service status and version |
| `GET` | `/api/suggest?q=&lat=&lon=` | Suggestions as you type (`lat`/`lon` optional, to prefer nearby results) |
| `GET` | `/api/search?q=&viewbox=w,n,e,s` | Full place search (`viewbox` optional) |
| `GET` | `/api/reverse?lat=&lon=&zoom=` | What is at a point (`zoom` 3–18) |
| `GET` | `/api/lookup?osm=W375257537` | Details such as website, phone, hours and Wikipedia link for an OSM object |
| `GET` | `/api/wiki?lang=en&title=Taj_Mahal` | Wikipedia summary: title, description, extract, image, url |
| `GET` | `/api/explore[?images=0]` | Curated landmarks, with photos unless `images=0` |
| `GET` | `/api/explore/random[?exclude=id]` | One random landmark |
| `GET` | `/api/explore/:id` | One landmark |
| `GET` | `/api/placemarks` | List My places |
| `POST` | `/api/placemarks` | Create: `{ "name", "lat", "lon", "description"? }` |
| `GET` | `/api/placemarks/:id` | Get one |
| `PATCH` | `/api/placemarks/:id` | Update: `{ "name"?, "description"? }` |
| `DELETE` | `/api/placemarks/:id` | Delete one |
| `DELETE` | `/api/placemarks` | Delete all |
| `GET` | `/api/placemarks/export` | Download all as GeoJSON |

A *place* object looks like this:
```json
{
  "name": "Taj Mahal", "category": "Tomb", "kind": "tomb",
  "address": "Taj East Gate Road, Agra, Uttar Pradesh, India",
  "lat": 27.175, "lon": 78.0421,
  "tags": { "website": "…", "wikipedia": "en:Taj Mahal" },
  "osm": { "type": "W", "id": 375257537 },
  "bbox": [27.1745, 27.1755, 78.0416, 78.0427]
}
```

---

## 📁 Project structure

```
mahimj-earth/
├── frontend/                 # Static web app (served by the backend)
│   ├── index.html            # Layout: rail, panels, knowledge card, controls
│   ├── styles.css            # Dark theme UI
│   └── app.js                # CesiumJS globe, panels, search, measure, placemarks
├── backend/
│   ├── server.js             # Entry point (starts HTTP server)
│   ├── data/landmarks.json   # Curated landmarks
│   ├── src/
│   │   ├── app.js            # Express app: middleware, routes, static files
│   │   ├── config.js         # Environment-based configuration
│   │   ├── lib/              # cache, http client + throttle, JSON store, validation, middleware
│   │   ├── services/         # geocoding, wikipedia, landmarks
│   │   └── routes/           # geo, explore, placemarks
│   └── test/api.test.js      # API tests (node:test)
├── data/                     # Runtime data (placemarks.json), git-ignored
├── package.json
├── LICENSE
└── README.md
```

---

## 🎮 Controls

| Action | Mouse | Touch |
|---|---|---|
| Rotate globe | Left-drag | One-finger drag |
| Zoom | Scroll wheel, or the + / − buttons | Pinch |
| Tilt / look around | Middle-drag or Ctrl + left-drag, or the 2D/3D button | Two-finger drag |
| Zoom towards a point | Double-click | Double-tap |
| Context menu | Right-click | – |
| Face north | Click the compass | Tap the compass |
| Focus search | Press `/` | – |

---

## 🛠️ Tech stack

- **Frontend:** CesiumJS 1.121, vanilla JavaScript, Material Symbols icons, Roboto font
- **Backend:** Node.js 18+, Express 4, `node:test`
- **Data:** [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9), [OpenStreetMap](https://www.openstreetmap.org/), [OpenTopoMap](https://opentopomap.org/), Esri Dark Gray Canvas, [Photon](https://photon.komoot.io/), [Nominatim](https://nominatim.org/) and the [Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/)

---

## 🙏 Attribution & usage policies

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Imagery © Esri, Maxar, Earthstar Geographics. Terrain style © OpenTopoMap (CC-BY-SA). Text and images from Wikipedia under their respective licences.

The backend follows the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) (maximum 1 request per second, identifying User-Agent, caching). For heavy public use, host your own Nominatim and Photon instances and point `NOMINATIM_URL` and `PHOTON_URL` at them.

## 📄 License

Copyright (c) 2026 mahimj. All rights reserved. Proprietary software — see [LICENSE](LICENSE).
