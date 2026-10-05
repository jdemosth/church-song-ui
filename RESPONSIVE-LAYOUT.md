# Operator responsive layout

The responsive changes retain the existing visual design and application handlers.
`src/responsive.css` is imported after `App.css`; every rule is scoped to
`.app-shell`, which is absent from the standalone projector document.
`App.jsx` adds native panel jump links and target IDs only.

## Audit findings

- The existing 850px rule hid the sidebar, making management destinations inaccessible.
- Desktop viewport/card heights were retained when panels stacked, clipping content.
- Three-column grids and reserved section-control widths crowded laptop controls.
- Unshrinkable flex children, nowrap buttons and service-row actions crowded long titles.
- Dialog grids and controls needed wrapping and viewport-height limits on phones.

## Layout behavior

| Viewport width | Operator layout |
| --- | --- |
| Above 1440px | Existing three-column console and full sidebar. |
| 1121–1440px | Compact sidebar, three shrinkable columns, wrapping controls and service actions below titles. |
| 851–1120px | Library/service in two columns; preparation/live controls below; sticky panel jump links. |
| 601–850px | Two-column console; all application navigation visible above the workspace. |
| 600px and below | Single-column console, stacked forms, wrapping buttons and phone-sized dialogs. |

Coarse pointers and widths up to 850px receive minimum 44px button heights and
native scrollbars. Dynamic viewport units and safe-area padding accommodate
short landscape viewports. Lists remain scrollable; the preparation panel retains
its original keyboard-scroll target. No state, keyboard handler, API, playlist,
WebSocket or projector logic was changed. Explicit Send Live remains required.

## Verification

- Production UI build passed; 28 UI unit tests passed.
- All 16 existing browser suites passed, including the real WebSocket suite;
  all three storage-fallback variants passed.
- API Maven verification passed: 137 tests, zero failures/errors/skips.
- The new `tests/responsiveLayout.cjs` passed with both mouse and touch contexts
  at 1920x1080, 1440x900, 1280x800, 1024x768, 768x1024, 1024x600,
  430x932, 390x844, 360x740, 932x430, 844x390 and 740x360.
- Checks covered horizontal overflow, navigation, management screens, input and
  modal fit, Bible controls, keyboard scrolling and phone pointer controls.
- Projector screenshots matched pre-change screenshots byte-for-byte at all
  twelve sizes. Phone checks included projector refresh blanking and fresh send.
- The real server/WebSocket suite also passed with a 390px touch operator and
  a desktop projector, including friendly `.local` discovery and reconnect safety.

The responsive test uses disposable HTTP fixtures. Set `EVENTS_TEST_URL` to the
UI test server (default `http://127.0.0.1:5188`) and `PLAYWRIGHT_MODULE` if
Playwright is installed outside this repository. Run `node tests/responsiveLayout.cjs`;
repeat with `RESPONSIVE_TOUCH=1`. Optional `RESPONSIVE_BASELINE` points to a
directory of pre-change projector screenshots; `RESPONSIVE_OUTPUT` sets the
screenshot output directory. Set `NETWORK_OPERATOR_WIDTH=390` when running
`tests/networkProjector.cjs` to exercise the real server with a phone-sized operator.

## Remaining physical checks

Automated viewport tests used Chromium. Confirm Safari on the Mac/iPhone and
Android browsers on physical devices, particularly soft-keyboard resizing,
browser chrome and touch scrolling during a live-service rehearsal.
No release package, commit, tag or deployment was created for this work.
