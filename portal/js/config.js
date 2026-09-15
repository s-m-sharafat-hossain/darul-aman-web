/**
 * Darul Aman Academy Portal — environment config.
 * Change API_BASE_URL once here when deploying (e.g. to your production API domain).
 */
window.DAA_CONFIG = {
  // For LOCAL testing: 'http://localhost:4000/api'
  // For PRODUCTION on Render: 'https://darul-aman-api.onrender.com/api' (replace with your actual Render URL)
  API_BASE_URL: 'http://localhost:4000/api',

  // Set to true ONLY if you want to run without the backend server (uses demo data)
  MOCK_MODE: false,
};
