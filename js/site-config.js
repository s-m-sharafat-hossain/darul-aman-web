/**
 * Darul Aman Academy — public website API config.
 * Same convention as portal/js/config.js: localhost during local dev,
 * otherwise assumes the backend is served at /api on the same domain.
 * Change here once when deploying if the API lives on a different host.
 */
window.DAA_SITE_CONFIG = {
  API_BASE_URL: (function () {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'http://localhost:4000/api';
    }
    return '/api';
  })(),
  // Contact form submission endpoint (e.g. a Formspree form URL:
  // https://formspree.io/f/xxxxxxxx). Left empty by default — the contact
  // page detects this and shows a "not yet configured" message rather than
  // pretending the form works or POSTing to a fake endpoint. Set this once
  // per deployment.
  CONTACT_FORM_ENDPOINT: '',
};
