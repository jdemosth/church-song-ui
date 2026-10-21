# Browser verification

The existing scenarios use the Playwright library directly. npm and
`package-lock.json` manage the exact development dependency and its matching
Chromium browser; no globally installed Playwright or personal browser profile is
needed.

```sh
npm ci
npm run browser:install
npm run test:unit
npm run test:projector:local
npm run test:projector:network
```

Chromium installs inside `node_modules` by default. `PLAYWRIGHT_BROWSERS_PATH` can
select another cache. The network suite requires sibling `church-song-api`, Java
21, and cached Maven dependencies/wrapper for its offline package step. It copies
the API source to a disposable directory, builds a fresh JAR there, and uses only
temporary databases, media/reference directories, and isolated browser contexts.
It removes its temporary API build afterwards. Test server diagnostics are printed
by the scenario and kept separately. Local scenarios start their own loopback Vite
server and mock the API. The runner does not accept an external production UI URL.
macOS is the verified platform for this orchestration; Windows wrapper execution
has not been verified.

Run a reviewed individual local scenario by its filename without `.cjs`:

```sh
npm run test:projector:local -- projectorStartup projectorConnection eventsProjector
NO_BROADCAST=1 npm run test:projector:local -- projectorStartup projectorConnection eventsProjector operatorFeatures
npm run test:projector:local -- browserExport
npm run test:projector:local -- mobileBibleLayout mobileEventsLayout mobileSongBadge networkAccess notesArchive notePrint playlistAddLayout responsiveLayout lanAccess developmentLan
```

`NO_BROADCAST=1` is the macOS/POSIX command syntax. In PowerShell set
`$env:NO_BROADCAST='1'` before the npm command and remove it afterwards.

Default local suite: 18 existing projector/operator scenarios. Additional reviewed
standalone fixtures and the new synthetic browser-export round trip can be selected
explicitly. Exported helper modules such as `hat1985Projection.cjs` are run by the
network scenario, not directly as standalone tests.

Baseline on 2026-10-20:

- Network projector suite: passed, including reconnects, 35-second frozen browser
  sessions, note archive/scrolling, production background transport, bilingual and
  trilingual Bible/reference scenarios.
- Default local suite: 17/18 passed. `backgroundPersistence` times out when checking
  the `sunrise` background during the stale BIBLE cache case at line 24. The active
  Bible design uses a black background; this is a candidate expectation conflict,
  not a confirmed application defect. The test is unchanged and still fails alone.
- Storage fallback selection: 3/4 passed. `operatorFeatures` times out at
  `noteScrollScenarios.cjs:64` waiting for a projector ArrowDown to advance the note.
  Operator scrolling checks pass before this. It reproduces alone; the same feature
  scenarios pass with BroadcastChannel and the real network hub.
- Browser-export round trip: passed with synthetic data; no real profile was read.
- Additional selected layout/archive/print/LAN fixtures: 10/10 passed.
- Unit tests: 48 passed. Lint remains 44 errors / 9 warnings; application code and
  lint rules have not been refactored or suppressed.

For the runtime inventory, exact backup/restore commands, remaining browser-export
coverage, full results, and proposed migration milestone, see the sibling API's
`docs/preservation-baseline.md`.

## Read-only browser export

At each original browser profile/origin, paste the complete reviewed contents of
`tools/export-browser-storage.js` into DevTools Console. It downloads a JSON export
of WorshipView localStorage plus custom-background Blob bytes/metadata from
IndexedDB. It does not clear, overwrite, or import storage. Retain any memory-only
draft separately before refreshing the page. Actual exports contain private notes:
save them outside Git in private backup storage.

The synthetic round-trip test checks absent database handling, unchanged source
storage, exact note/history strings, image bytes/metadata and restoration into a
fresh test context. It does not import into an existing personal browser profile.

## First-church preservation milestone

The network fixture now explicitly migrates its new disposable database before
starting Java. The API's normal startup validates migration versions/checksums and
does not apply a migration. Python 3 is therefore also required by the fixture.
The runner passes the migration tool from its disposable API source copy.

`tests/historyPreservation.cjs` is included in the full network suite and can be
run alone using:

```sh
HISTORY_ONLY=1 npm run test:projector:network
```

It uses real HTTP and UI against the temporary database: completed contents survive
a library edit while cached, deletion/reload retains ordered historical songs,
completed update/delete endpoints reject mutation, and reuse creates new records
from frozen lyrics. History Delete controls were removed; reconstruction and
missing/unsupported-content notices are shown. This is preservation, not church
authentication or isolation.

The new unit checks increase the total to 50 passing tests. The affected existing
local fixtures (`adminKeyboard`, `sidebarKeyboard`, `projectorStartup`,
`projectorConnection`) passed 4/4. See the API's `docs/hosted-milestone-1.md` for
separate Mac/Windows rehearsal results, backend verification and backup status.

## Authentication fixtures

`npm run test:hosted-ui` exercises login, CSRF headers, access denied, logout, church
switching and scoped drafts/backgrounds with disposable mocked identities.
`test:projector:local` explicitly enables the Vite-only standalone fixture bootstrap.
The real network fixture explicitly selects the backend standalone profile and
forwards `/auth/*` bootstrap requests to its temporary API. Hosted projector
WebSockets are deliberately denied; transport regression uses local compatibility.
The real HTTP auth/isolation/session suite is `HostedIsolationTests` in the API.


## Milestone 3 final verification (October 20, 2026)

The historical statement above that hosted projection is disabled describes
milestone 2. Hosted projection now uses authenticated church/session hubs and
single-use WebSocket tickets. The global hosted hub remains denied.

Final results: UI units 54/54; production build passed; hosted authentication
fixture 1/1; real hosted browser and API follow-up 33/33 test executions; full
standalone network/history scenario passed (exit 0), including Bible formatting,
all six Kreyòl references and bold subtitles. Default local suite remains 17/18,
with the documented `backgroundPersistence` Bible/sunrise expectation failure.
Lint remains 44 errors / 9 warnings. No failing assertion was suppressed.

`tests/hostedMilestone.cjs` is launched by the API's
`HostedMilestoneBrowserTests` against a newly migrated disposable SQLite database,
generated identities, real authenticated sockets and a production UI build. It
checks three simultaneous church/session displays, blank startup, refresh/reconnect,
closure/logout, submission, exact platform approval and cross-church revision use.
Run it using the exact commands in the sibling API's
[final milestone report](../church-song-api/docs/hosted-milestone-3.md).
The JUnit browser class requires `-Dchurchsong.test.ui-location=file:<build>/`;
without this property it is skipped. The recorded complete verification includes it.

The count progression is 48 baseline tests → 50 with two service-history tests →
52 with two authentication/browser-scope tests → 54 with session-scoping and
transient-ticket-retry tests. All use `node --test tests/*.test.js`.

## Authorized hosted publication follow-up — 2026-10-20

`npm run test:projector:local -- backgroundPersistence`: **1/1 passed**. The previous
failure incorrectly expected the song background on Bible. The corrected test
requires a black Bible surface/no image, retains saved-background and blank-startup
checks, and requires fresh Send Live after refresh. Bible rendering was not changed.
The previous 17 other passing scenarios were not needlessly repeated; this is a
focused rerun, not a new all-scenarios invocation.

`npm run test:hosted-ui`: **1/1 passed**, including the new mocked Cognito logout
browser navigation following successful CSRF-protected local logout. Default local
logout remains unchanged. Real Cognito/TLS acceptance is still pending.
`npm run test:unit`: **54/54 passed**. Production build passed with
`npm run build -- --outDir /private/tmp/boc-current-ui-build`.
The API's final hosted browser/isolation/configuration run passed **41 tests**.
See API `docs/hosted-milestone-3.md` and `deployment/lightsail/README.md` for exact
commands, deployment templates and remaining gates. No deployment was performed.
