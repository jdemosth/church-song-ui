// Actual Vite modules in LAN-origin browser contexts; no operational data.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const hostname of ['localhost', '192.168.1.50', '10.20.30.40']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
      const ui = `http://${hostname}:5173`, api = `http://${hostname}:8080`;
      const requests = [], sockets = [], errors = [];
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === ui) {
          const response = await route.fetch({ url: (process.env.EVENTS_TEST_URL || 'http://localhost:5188') + url.pathname + url.search });
          return route.fulfill({ response });
        }
        requests.push(url.href);
        assert.equal(url.origin, api, 'HTTP request must use the UI hostname');
        const data = url.pathname === '/projector/capabilities' ? { protocol: 'church-projector-v1' }
          : url.pathname === '/settings' ? { churchName: 'LAN Test', churchAbbreviation: 'TEST' } : [];
        await route.fulfill({ json: data });
      });
      await context.routeWebSocket('**/*', socket => {
        if (!socket.url().includes('/projector/ws')) return; // Vite HMR is unrelated.
        sockets.push(socket.url());
        socket.onMessage(raw => {
          const message = JSON.parse(raw);
          if (message.type === 'HELLO') socket.send(JSON.stringify({ type: 'WELCOME', connection: 'test', epoch: 'test', revision: 0, state: {} }));
          if (message.type === 'PING') socket.send(JSON.stringify({ type: 'PONG' }));
        });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(ui);
      await page.waitForFunction(() => document.querySelector('.app-shell'));
      await page.waitForFunction(async () => {
        const { API_BASE_URL } = await import('/src/apiOrigin.js');
        return API_BASE_URL === `http://${location.hostname}:8080`;
      });
      await page.waitForTimeout(500);
      assert(requests.includes(api + '/songs'));
      assert(requests.includes(api + '/projector/capabilities'));
      assert.deepEqual(sockets, [`ws://${hostname}:8080/projector/ws`]);
      assert.deepEqual(errors, []);
      await context.close();
      console.log('PASS actual Vite phone HTTP/WebSocket host resolution: ' + hostname);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
