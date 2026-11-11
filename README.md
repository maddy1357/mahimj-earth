# 🌍 MahimJ Earth

**MahimJ Earth** is an interactive 3D globe explorer, similar to Google Earth, that runs in the browser. You can spin the planet, zoom from space down to street level over real satellite imagery, search any place on Earth and fly there in 3D.

It is built with [CesiumJS](https://cesium.com/platform/cesiumjs/) and uses only free, open data sources, so you don't need an API key or account.

> Looking for a 2D street map with directions? See the sister project **[mahimj-maps](https://github.com/maddy1357/mahimj-maps)**.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🌐 **3D globe** | Full 3D Earth with atmosphere. Rotate, zoom and tilt the camera freely |
| 🛰️ **Satellite imagery** | High-resolution world imagery (Esri World Imagery) |
| 🗺️ **Map styles** | Switch between *Satellite*, *Streets* (OpenStreetMap) and *Dark* themes |
| 🏷️ **Labels & borders** | Toggle country borders, city and place-name overlays |
| 🔍 **Place search** | Search any city, address or landmark (OpenStreetMap Nominatim) and fly to it |
| ✈️ **World tour** | One-click cinematic fly-to for famous landmarks: Taj Mahal, Eiffel Tower, Mount Everest, Grand Canyon and more |
| 🌗 **Day / night** | Realistic sun lighting based on the current time |
| 🔄 **Auto-rotate** | Let the globe spin slowly, like a screensaver |
| 📍 **My location** | Fly to your current location using the browser's geolocation |
| 📌 **Drop pins** | Double-click anywhere on the globe to drop a labelled pin |
| 🧭 **Live coordinates** | See the latitude/longitude under your cursor and the camera's eye altitude |
| 🔀 **3D / 2D / Columbus view** | Switch the projection with the built-in scene-mode picker |
| 📱 **Responsive** | Works on desktop and mobile browsers |

---

## 🤔 Why we built this

- **Learning:** to learn how 3D geospatial apps work, including globes, camera control, imagery tiles, geocoding and coordinate systems.
- **Open and free:** Google Earth is closed-source. MahimJ Earth shows that a capable Earth viewer can be built with **open-source software and open data**, with no API keys, billing or sign-up.
- **Simple to run:** the whole app is plain HTML, CSS and JavaScript with a tiny Node.js server. There's no build step and nothing to install from npm.
- **A base to build on:** it's easy to extend with 3D buildings, terrain, KML/GeoJSON import, flight paths, weather layers and similar features.

---

## 🚀 Getting started

### Prerequisites

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) **v16 or newer** (only used to serve the files)
- A modern browser with WebGL (Chrome, Edge, Firefox or Safari)
- An internet connection (map tiles and CesiumJS load from public CDNs)

### 1. Clone the repository

```bash
git clone https://github.com/maddy1357/mahimj-earth.git
cd mahimj-earth
```

### 2. Run the app

```bash
npm start
```

There are no dependencies to install. The server uses only built-in Node.js modules.

### 3. Open it in your browser

```
http://localhost:3000
```

To use a different port:

```bash
# macOS / Linux
PORT=8080 npm start

# Windows PowerShell
$env:PORT=8080; npm start
```

> 💡 You can also open `public/index.html` with any static server (for example the VS Code *Live Server* extension, or `npx serve public`).

---

## 🎮 Controls

| Action | Mouse | Touch |
|---|---|---|
| Rotate globe | Left-drag | One-finger drag |
| Zoom | Scroll wheel / right-drag | Pinch |
| Tilt / look around | Middle-drag or Ctrl + left-drag | Two-finger drag |
| Drop a pin | Double-click | Double-tap |
| Pin details | Click a pin | Tap a pin |

---

## 📁 Project structure

```
mahimj-earth/
├── public/
│   ├── index.html   # App layout & CDN includes (CesiumJS)
│   ├── styles.css   # UI styling (glass panel, chips, status bar)
│   └── app.js       # Globe setup, layers, search, tour, pins, controls
├── server.js        # Zero-dependency Node.js static file server
├── package.json
├── LICENSE
└── README.md
```

---

## 🛠️ Tech stack

- **[CesiumJS 1.121](https://cesium.com/platform/cesiumjs/)**: open-source 3D globe and map engine (WebGL)
- **[Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9)**: satellite and aerial imagery
- **[OpenStreetMap](https://www.openstreetmap.org/)**: street map tiles
- **[CARTO](https://carto.com/basemaps/)**: dark basemap
- **[Nominatim](https://nominatim.org/)**: place search (geocoding)
- **Node.js `http` module**: local static server

---

## 🗺️ Roadmap

- [ ] 3D terrain (mountains in real elevation)
- [ ] 3D buildings (OSM Buildings)
- [ ] Measure distance and area tools
- [ ] Import KML / GeoJSON files
- [ ] Save favourite places
- [ ] Guided tours with narration

---

## 🙏 Attribution

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Imagery © Esri, Maxar, Earthstar Geographics. Dark basemap © CARTO. Please follow the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) (max 1 request per second) and the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/) if you deploy this app publicly.

## 📄 License

Released under the [MIT License](LICENSE).
