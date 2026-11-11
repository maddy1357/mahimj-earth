'use strict';
const path = require('path');
const pkg = require('../../package.json');

const ROOT = path.resolve(__dirname, '..', '..');
const env = process.env;

/** Central configuration. Every value can be overridden with an environment variable. */
module.exports = {
  appName: 'MahimJ Earth',
  version: pkg.version,
  port: Number(env.PORT) || 3000,
  frontendDir: path.join(ROOT, 'frontend'),
  dataDir: env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(ROOT, 'data'),

  // Identifies this app to the public OpenStreetMap / Wikipedia services, as their usage policies require.
  userAgent: env.USER_AGENT || `MahimJ-Earth/${pkg.version} (+https://github.com/maddy1357/mahimj-earth)`,
  nominatimUrl: env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
  photonUrl: env.PHOTON_URL || 'https://photon.komoot.io',
  wikipediaHost: env.WIKIPEDIA_HOST || 'wikipedia.org',

  rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MIN) || 120,
  maxPlacemarks: Number(env.MAX_PLACEMARKS) || 500,
};
