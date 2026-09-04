# Quickstart: Playlist Initial Song Selection

## Purpose

Validate that playlist activation prepares operator preview correctly while clearing live
projected content and preserving its background.

## Prerequisites

- Install project dependencies:

```bash
npm install
```

- Ensure the Church Song backend is running so playlists and songs can load in the UI.
- Have at least:
  - one non-empty playlist with an ordered song list
  - one empty playlist
  - optional live projector content already active for interruption checks

## Validation Commands

Run the frontend build check:

```bash
npm run build
```

If local lint validation is part of the implementation work, also run:

```bash
npm run lint
```

Run the app for manual validation:

```bash
npm run dev
```

## Validation Scenarios

### Scenario 1: Non-empty playlist prepares first song and clears live content

1. Open the Worship Console operator view.
2. Select or activate a playlist that contains songs.
3. Confirm the first song in that playlist appears in the Current Song/preview area.
4. Confirm Projector Preview shows the prepared song and first section.
5. Confirm the live projector clears automatically without showing the prepared song.

Expected outcome:
- Operator preview updates immediately to the first song.
- Projector Preview shows the staged song and selected section.
- Live projector content is clear and its background remains selected.

### Scenario 2: Empty playlist clears preview and live content

1. Start from any state with a selected current song.
2. Select or activate an empty playlist.
3. Confirm the Current Song/preview area clears to its existing empty state.
4. Confirm the live projector content clears while its background remains selected.

Expected outcome:
- No stale preview song remains visible.
- Live projector content is clear and its background remains selected.

### Scenario 3: Explicit projection still controls live updates

1. Select a non-empty playlist and verify the first song appears only in preview.
2. Explicitly select/project a section from that song using existing controls.
3. Confirm the live projector updates only after that explicit action.

Expected outcome:
- Playlist activation alone does not project lyrics.
- Explicit projection behaves exactly as before.

### Scenario 4: Existing activation paths stay consistent

1. Trigger playlist activation through each existing supported flow used in the console
   (for example direct selection, making a playlist active from management, or continuing a working
   playlist).
2. Verify each activated non-empty playlist picks its first song for preview.
3. Verify each activated empty playlist clears preview.
4. Confirm live projector content clears in every case without changing the selected background.

Expected outcome:
- The contract in [contracts/playlist-initial-song-selection.md](./contracts/playlist-initial-song-selection.md)
  holds across all supported activation paths.

## Notes

- The repository does not currently expose an automated frontend test runner in `package.json`, so
  manual workflow validation plus `npm run build` is the current minimum completion bar for this
  feature.
- Build validation passed in this implementation session.
- Manual browser verification of the four scenarios above is still pending because no interactive
  browser session is available in this terminal environment.
