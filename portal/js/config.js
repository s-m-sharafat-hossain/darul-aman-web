/**
 * Darul Aman Academy Portal — environment config.
 * Change API_BASE_URL once here when deploying (e.g. to your production API domain).
 */
window.DAA_CONFIG = {
  API_BASE_URL: (function () {
    // For development without backend, use mock mode
    // When backend is running, change this to: 'http://localhost:4000/api'
    return 'http://localhost:4000/api';
  })(),
  
  // Enable mock mode for testing without backend
  MOCK_MODE: true,
};
