# Selected events, live Bible navigation, and sermon notes

## Events

Upcoming events start selected to preserve the existing workflow. Use each event's
Include in projection checkbox, Select All Events, or Clear Event Selection.
Selection changes only preparation. Send to Projector reads current saved events,
filters by the selected IDs, and creates a detached live snapshot, ordered by date
and time. Existing four-event paging navigates that snapshot. An explicitly empty
selection cannot be sent. Event records are never changed by selection.
Birthday lists retain their existing presentation selector and eight-name paging.

## Live Bible jump

Prepare > Bible includes Live verse number and Go to Verse. Enter submits only this
control. The field is enabled for an established live Bible passage, independently
of the passage being prepared. A valid verse maps to the existing live passage;
there is no new send or chapter fetch. Both language texts stay in the same verse
object. Local transport updates the existing live index; LAN transport uses
BIBLE_VERSE_JUMP, validated by the server against the live-send ID and verse list.
Invalid numbers leave the display unchanged. Existing arrow navigation continues.
LAN keyboard selection now waits for the server's state echo, avoiding a transient
mismatch between the prepared selection and live index during rapid navigation.

## Notes

Prepare > Notes provides Note text, Preview Note, Send Note Live, and Clear Draft.
Changing a draft invalidates its preview for sending. Preview and restored drafts
never update the live display. Notes use a separate NOTE snapshot through the same
SEND_LIVE flow and startup gate as songs, Bible, and events. Black Screen and
Clear/Show Lyrics use the existing commands. A projector reopened during a note
starts blank and requires a new explicit send.

The limit is 2,000 characters and 40 lines per note. Entered line breaks are
preserved. Existing automatic text fitting is reused, with a note-specific dark
contrast panel over the selected background. Long notes use smaller text; operators
should prefer concise statements for readability at a distance.

Drafts and the 50 most recent send requests are saved in this browser's localStorage,
keyed by active service-plan ID, playlist ID, or a general session key. Selecting the
same service exposes its notes; Load as Draft never projects a history item.
These notes are not stored in the server database, synchronized between operators,
or included in database backups/service-history records. The existing history
schema contains service metadata and ordered songs, not a notes collection; no new
persistence subsystem or database migration was introduced. If browser storage is
unavailable, drafts survive tab switches during the current page session and a
warning asks the operator to copy them before refresh/close. Changing browser,
origin, or clearing site data does not preserve browser-local notes.

## Verification coverage

New helper/unit, local browser, real WebSocket and server tests cover selection
sizes 1/4/5, non-contiguous selections, empty selection, explicit-send isolation,
verse boundaries/gaps/invalid input, bilingual jumps followed by arrows, Notes
preview/send/edit/refresh/black/clear/content switching, long-note fitting,
mobile layouts, and unavailable browser storage. Existing tests remain in place.

Final automated verification passed:

- 34 UI unit tests.
- 139 API tests (Maven verify), zero failures/errors/skips.
- All 22 non-network browser scripts, including the new feature/storage suites.
- Complete responsive matrix with touch: 12 full-app viewport sizes plus targeted
  320px Complete Service coverage; feature tests additionally cover 320px Notes.
- Real production UI/WebSocket suite through a private-LAN `.local` hostname with
  a 390px remote operator, including Notes disconnect/reconnect and rejected-send
  non-replay checks.
- All three existing storage-fallback variants plus the new operator feature
  scenario with BroadcastChannel disabled.
- Production UI build and whitespace/diff checks.

The test additions did not remove or weaken existing assertions. Browser automation
used Chromium; physical Windows/Mac/iPhone acceptance remains a separate check.

Long-note resizing exposed ResizeObserver delivery warnings. Notes now defer their
resize-driven font fitting to the next animation frame; existing song/Bible fitting
retains its original immediate behavior. Normal and storage-fallback retests passed
with clean captured Vite diagnostics.

## Notes proofreading and backend compatibility update

Preview Note now opens a wide, viewport-bounded Review Note dialog, clearly marked
PREVIEW — NOT LIVE. It uses readable 18–24px text, preserves paragraphs/numbered
lines with pre-wrap, and scrolls the complete note without projector auto-fitting.
The current background is shown behind a high-contrast reading panel. Return to
Editing or Escape closes the dialog and returns focus to the editor. Closing does
not invalidate the reviewed snapshot; editing does. Both panel and dialog Send
Note Live buttons invoke the same validated send handler. The inline miniature
projector preview has been removed. Projector rendering itself is unchanged.

The physical test's backend process on port 8080 was started September 18 at
23:00:21, before the Notes hub was compiled at 23:15:22. Its in-memory validator
therefore predates NOTE support even though the current source/JAR supports it.
The hub now shares its accepted content-type set with /projector/capabilities.
The UI requires advertised NOTE support for a network Note send and reports an
explicit backend-restart instruction for an older process. This check does not
replace or bypass the authoritative snapshot validator.

To activate the updated backend in the existing development setup, stop/restart
the backend using its existing launch command and datasource/LAN arguments, then
refresh the operator page to reload capabilities. Preserve the current paths and
profile. Building alone cannot update classes already loaded by a running JVM.
The existing backend was not stopped automatically during this work; verification
used a separately started server and disposable test data.

Notes proofreading/update verification: 35 UI unit tests and 140 API tests passed;
7 existing browser regression scripts, the feature scenarios, new proofreading and
old-backend compatibility tests, the responsive touch matrix, and the real LAN
WebSocket suite passed. All 3 existing storage-fallback variants and both Notes
feature/proofreading fallback scenarios passed. Production UI build passed. No
validation rules were relaxed and no existing test assertions were removed.

## Note reading layout and continuous scrolling

Notes remain a single left-aligned, top-positioned document. Paragraphs and manual
line breaks are preserved. The projector scrollbar is hidden using scrollbar-width
and the WebKit scrollbar pseudo-element; overflow-y remains auto, so mouse wheels
and trackpads still scroll normally. The proofreading dialog is unchanged.

Up/Down and Page Up/Down move approximately one viewport, with at least one rendered
line of overlap when there is room. The projector measures actual wrapped lines
using DOM Range rectangles. It prefers a stop whose bottom coincides with a complete
paragraph/manual-line block, provided that advances at least 45% of the viewport.
Oversized paragraphs fall back to whole rendered-line stops; fitting an entire
paragraph is not always possible. Top and bottom remain bounded. Native wheel
scrolling remains free rather than snapping on every input.

Remote operators send existing ordered Note navigation commands through the shared
projector transport. Geometry is measured on the projector, not the operator's
screen. Black/Clear retain the mounted document and its scroll position. Explicit
Send Note Live resets to the top, including identical text. Temporary reconnects
retain the already-admitted display; a fresh projector document remains blank until
a new explicit send. Draft editing and operator refresh never replace live content.
Song, Bible and Event rendering/navigation are unchanged.

Regression coverage includes hidden-scrollbar computed styles, native wheel input,
paragraph-aware target selection, oversized-block fallback, wrapped glyph bounds at
seven sizes, keyboard navigation, Black/Clear, explicit resets and reconnect safety.
