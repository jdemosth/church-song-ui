// Existing scenarios, disposable browser contexts and test servers only.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

const root = path.resolve(__dirname, '..');
const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '0' };
delete env.PLAYWRIGHT_MODULE;
const scenarios = [
  'projectorStartup', 'projectorConnection', 'eventsProjector',
  'eventsProjectorDates', 'eventsContrast', 'backgroundPersistence',
  'operatorFeatures', 'notePreview', 'noteProjectorLayout', 'notesStorage',
  'notesCompatibility', 'birthdayYears', 'eventsHost', 'keyboardWorkflow',
  'keyboardScope', 'eventsListKeyboard', 'adminKeyboard', 'sidebarKeyboard',
];
const additionalScenarios = ['hostedAuthentication','browserExport', 'mobileBibleLayout', 'mobileEventsLayout',
  'mobileSongBadge', 'networkAccess', 'notesArchive', 'notePrint', 'playlistAddLayout',
  'responsiveLayout', 'lanAccess', 'developmentLan'];

function run(args, cwd = root, childEnv = env, executable = process.execPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env: childEnv, stdio: 'inherit' });
    const stop = () => child.kill('SIGTERM');
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(args[0])}: exit ${code}, signal ${signal || 'none'}`));
    });
  });
}

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

(async () => {
  const [mode, ...names] = process.argv.slice(2);
  if (mode === '--install') {
    const cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
    return run([cli, 'install', 'chromium']);
  }
  if (mode === '--network') {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'boc-browser-api-'));
    const source = path.resolve(root, '../church-song-api');
    const api = path.join(temp, 'church-song-api');
    fs.cpSync(source, api, { recursive: true, filter: file => {
      const relative = path.relative(source, file);
      if (relative.split(path.sep).some(part => ['.git', '.agents', '.specify', 'target', 'local'].includes(part))) return false;
      return !/\.db(?:-wal|-shm)?$/.test(file) || relative === path.join('src', 'main', 'resources', 'bible', 'bible.db');
    } });
    console.log(`Disposable API build: ${temp}`);
    try {
      // No application startup occurs during packaging; no operational database is copied.
      const wrapper = process.platform === 'win32' ? 'mvnw.cmd' : './mvnw';
      await run(['-o', '-DskipTests', 'package'], api, env, wrapper);
      const networkEnv = { ...env,
        API_TEST_JAR: path.join(api, 'target', 'church-song-api-0.0.1-SNAPSHOT.jar'),
        API_MIGRATION_TOOL: path.join(api, 'tools/migrate_standalone.py'),
        NETWORK_TEST_HOST: '127.0.0.1', NETWORK_TEST_PORT: String(await unusedPort()),
      };
      delete networkEnv.NETWORK_TEST_MDNS;
      await run([path.join(root, 'tests/networkProjector.cjs')], root, networkEnv);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
    return;
  }
  if (!['--local','--hosted'].includes(mode)) throw new Error('Use --install, --network, or --local [scenario names].');
  const selected = mode === '--hosted' ? ['hostedAuthentication'] : names.length ? names : scenarios;
  if (selected.some(name => !scenarios.includes(name) && !additionalScenarios.includes(name))) throw new Error('Unknown or non-isolated scenario.');
  if (mode === '--local') process.env.VITE_STANDALONE_FIXTURES = 'true';
  else delete process.env.VITE_STANDALONE_FIXTURES;
  const { createServer } = await import('vite');
  const server = await createServer({ root, server: { host: '127.0.0.1', port: await unusedPort(), strictPort: true } });
  await server.listen();
  const localEnv = { ...env, EVENTS_TEST_URL: `http://127.0.0.1:${server.httpServer.address().port}`,
    RESPONSIVE_OUTPUT: fs.mkdtempSync(path.join(os.tmpdir(), 'boc-browser-layout-')) };
  let failed = 0;
  try {
    for (const name of selected) {
      console.log(`SCENARIO ${name} (NO_BROADCAST=${localEnv.NO_BROADCAST || '0'})`);
      try { await run([path.join(root, 'tests', `${name}.cjs`)], root, localEnv); }
      catch (error) { failed++; console.error(error.message); }
    }
  } finally { await server.close(); }
  console.log(`RESULT: ${selected.length - failed}/${selected.length} scenarios passed`);
  if (failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
