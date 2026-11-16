// Extends app.json. When EXPO_BASE_URL is set (e.g. "/omniroute" for GitHub Pages),
// the web build is served from that sub-path.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
