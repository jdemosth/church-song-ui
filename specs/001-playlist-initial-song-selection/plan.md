# Implementation Plan: Playlist Initial Song Selection

**Branch**: `[001-playlist-initial-song-selection]` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-playlist-initial-song-selection/spec.md`

## Summary

Update the Worship Console so playlist activation prepares the operator preview with the playlist's
first song when available, clears preview state for empty playlists, and clears live projector
content while preserving projector background settings. The implementation should separate
operator preview selection from live projection updates and reuse the existing playlist activation
paths rather than introducing a broad UI rewrite.

## Technical Context

**Language/Version**: JavaScript (ES modules) on React 19

**Primary Dependencies**: React 19, React DOM 19, Vite 8, browser Web APIs for storage and
cross-window synchronization

**Storage**: Browser local persistence for projector/session state; no new backend or database
storage

**Testing**: Existing manual validation plus `vite build`; no automated frontend test runner is
currently configured in `package.json`

**Target Platform**: Browser-based Worship Console and projector window

**Project Type**: Single-page web application

**Performance Goals**: Playlist selection should update operator preview within the same interaction
flow and must not introduce noticeable delay when moving between playlists during live use

**Constraints**: Preserve offline Bible behavior, existing projector synchronization, persisted
session compatibility, multilingual song handling, and current operator/projector separation

**Scale/Scope**: Single feature change centered in `src/App.jsx` with validation across operator
playlist selection, active playlist changes, and projector window behavior

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- `Workflow Stability First`: PASS. The feature changes only playlist-to-preview initialization and
  explicitly preserves live projection, keyboard, and existing worship workflows elsewhere.
- `Incremental Frontend Change`: PASS. The planned change is localized to existing playlist and song
  selection logic in `src/App.jsx` without an architectural rewrite.
- `Backward-Compatible UI Behavior`: PASS. The only intended behavior change is the initial preview
  song chosen after playlist activation; no existing control is removed.
- `Backend-Aware UI Contracts`: PASS. No backend contract change is required; the feature uses the
  existing playlist payload and ordering semantics.
- `Core Worship Workflow Preservation`: PASS with focused attention. Playlist switches must clear
  live content without replacing it with the prepared song or changing the selected background.
- `Offline-First Bible Operation`: PASS. The design does not alter Bible flows or network
  assumptions.
- `Multilingual Experience Preservation`: PASS. The current preferred-language song resolution
  behavior remains applicable when preparing the operator preview.
- `Clear Component and State Boundaries`: PASS. The design should introduce a dedicated
  preview-selection path instead of continuing to mix preview and live projection side effects.
- `No Silent Feature Removal`: PASS. No controls or persistence features are removed.
- `Testable UI Behavior`: PARTIAL PASS. Manual validation and build verification are available now;
  implementation should add automated coverage only if a practical test harness is introduced
  within scope.
- `Accessibility and Predictable Interaction`: PASS. Current visible controls and interaction model
  remain intact.
- `Safe Persistence and Synchronization Evolution`: PASS with focused attention. Preview changes
  must not overwrite persisted projector state or cross-window live content during playlist changes.
- `Multi-Church Ready Without Premature Complexity`: PASS. No tenant-specific work is introduced.
- `Specification and Plan Traceability`: PASS. This plan directly traces to the approved feature
  spec.
- `Verified Frontend Completion Gates`: PASS. The plan includes `vite build` and scenario-based
  validation before implementation is considered complete.

## Project Structure

### Documentation (this feature)

```text
specs/001-playlist-initial-song-selection/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── playlist-initial-song-selection.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── App.jsx
├── App.css
├── backgroundStorage.js
├── index.css
├── main.jsx
└── assets/
```

**Structure Decision**: This feature stays within the existing single-page frontend structure.
`src/App.jsx` owns playlist activation, current song preview state, and projector synchronization,
so the implementation should remain there unless a very small extracted helper improves clarity
without changing architecture.

## Complexity Tracking

No constitution violations or exceptions are currently required.
