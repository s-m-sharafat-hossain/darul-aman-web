/**
 * Darul Aman Academy Portal — environment config.
 * Change API_BASE_URL once here when deploying (e.g. to your production API domain).
 */
window.DAA_CONFIG = {
  API_BASE_URL: (function () {
    // Defaults to localhost:4000 (backend's default PORT) during local dev.
    // On any other host, assumes the API is served at /api on the same domain.
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'http://localhost:4000/api';
    }
    return '/api';
  })(),
};
