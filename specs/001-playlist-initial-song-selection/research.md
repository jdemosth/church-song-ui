# Research: Playlist Initial Song Selection

## Decision 1: Separate operator preview selection from live projection updates

- **Decision**: Introduce or adapt a helper path that updates the selected/current preview song for
  the operator without updating live projector state, section navigation state, or persisted
  projector content.
- **Rationale**: The existing `selectPlaylistSong` path updates `selectedSong`, `currentSong`,
  `projectionSong`, `projectionContentType`, Bible projection state, and section index together.
  Reusing that path for playlist activation would violate the feature requirement that playlist
  changes must not replace or interrupt live projected content.
- **Alternatives considered**:
  - Continue using `selectPlaylistSong`: rejected because it couples preview selection to live
    projection updates.
  - Suppress the projector sync after calling `selectPlaylistSong`: rejected because it would still
    mutate live projection state locally and make persistence behavior harder to reason about.

## Decision 2: Apply the new behavior from the existing playlist activation flows

- **Decision**: Hook the feature into the existing places that make a playlist active, including
  default playlist loading, explicit playlist selection in the operator console, and actions that
  promote a playlist into the active Worship Console session.
- **Rationale**: The spec defines behavior in terms of when a playlist becomes selected or active,
  not only when a user clicks a single control. The current UI sets `selectedPlaylist` from several
  flows such as initial playlist load, "make active", "continue existing today service", and
  creating a working playlist.
- **Alternatives considered**:
  - Handle only the dropdown/list click path: rejected because activation also occurs through other
    supported operator flows and would create inconsistent behavior.
  - Use a broad effect on every playlist state refresh: rejected because ordinary playlist reloads
    could unexpectedly reset operator preview when the active playlist itself did not meaningfully
    change.

## Decision 3: Preserve projector persistence and cross-window synchronization by not changing live projection state during playlist activation

- **Decision**: Keep projector persistence and cross-window sync driven only by actual live
  projection state, not by operator-only preview changes caused by playlist activation.
- **Rationale**: The current synchronization effect persists and broadcasts `previewSong`, which is
  derived from live projector state (`projectionSong`) or currently projected Bible content. If the
  feature keeps live projection state unchanged, playlist activation can update the operator preview
  without broadcasting new lyrics to the projector window.
- **Alternatives considered**:
  - Broadcast operator preview changes to projector clients: rejected because it breaks the spec's
    guarantee that the projector remains unchanged until explicit projection.
  - Add a second persisted preview channel for this feature: rejected as unnecessary complexity for
    a localized workflow change.

## Decision 4: Reuse existing song resolution rules for preview selection

- **Decision**: When a playlist becomes active, resolve the first song through the existing song
  collection and preserve the current language-aware selection behavior where applicable.
- **Rationale**: The application already resolves songs from the canonical collection and has
  preferred-language behavior tied to session defaults. Reusing those rules avoids introducing a
  second interpretation of what the "first song" means in preview.
- **Alternatives considered**:
  - Use the raw embedded playlist song object without resolution: rejected because it may diverge
    from the canonical song collection and language-aware display behavior.
  - Add a new feature-specific language rule: rejected because the spec does not request a
    multilingual behavior change.

## Decision 5: Validate with build plus scenario-driven manual checks

- **Decision**: Treat `vite build` and targeted manual workflow validation as the Phase 1
  validation baseline, while noting the absence of an existing automated frontend test harness.
- **Rationale**: The repo currently exposes `dev`, `build`, `lint`, and `preview` scripts only.
  The constitution prefers automated tests where practical, but introducing a test harness is a
  separate scope decision and is not required to design this feature.
- **Alternatives considered**:
  - Block planning until an automated test framework exists: rejected because the feature can still
    be specified and planned responsibly with explicit validation guidance.
  - Assume automated UI tests already exist elsewhere: rejected because the repository context does
    not show any configured frontend test runner.
