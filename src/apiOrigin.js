// Development uses the UI host so remote LAN clients reach the same computer.
// Production keeps relative, same-origin API and WebSocket URLs.
export const API_BASE_URL = import.meta.env.DEV
  ? `http://${window.location.hostname}:8080`
  : ''
