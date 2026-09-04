# Tasks: Playlist Initial Song Selection

**Input**: Design documents from `/specs/001-playlist-initial-song-selection/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No dedicated automated test tasks are included because the current feature specification
does not explicitly require a TDD workflow and the repo does not yet expose a configured frontend
test runner. Validation tasks include `npm run build` and the manual scenarios from `quickstart.md`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Frontend source lives in `src/`
- Feature documentation lives in `specs/001-playlist-initial-song-selection/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the implementation target and validation references before code changes

- [X] T001 Review `specs/001-playlist-initial-song-selection/spec.md`, `specs/001-playlist-initial-song-selection/plan.md`, and `specs/001-playlist-initial-song-selection/quickstart.md` before editing `src/App.jsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared preview-versus-live selection boundary that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Refactor playlist-selection state handling in `src/App.jsx` to introduce a dedicated operator-preview update path that does not mutate live projector state
- [X] T003 [P] Document the preview-versus-live state invariant for this feature in `specs/001-playlist-initial-song-selection/contracts/playlist-initial-song-selection.md`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Ready First Song on Playlist Select (Priority: P1) 🎯 MVP

**Goal**: Automatically prepare the first song from a non-empty active playlist in the operator preview

**Independent Test**: Select or activate a non-empty playlist in the Worship Console and verify the
first song appears in the Current Song/preview area immediately without any additional operator action.

### Implementation for User Story 1

- [X] T004 [US1] Update non-empty playlist activation flows in `src/App.jsx` so the active playlist's first song becomes the operator's selected preview song
- [X] T005 [US1] Apply existing canonical song resolution and language-aware preview behavior to the playlist's first song in `src/App.jsx`
- [X] T006 [US1] Verify the Current Song/preview area in `src/App.jsx` reflects the automatically prepared first song for all supported active-playlist entry points

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Clear Live Projection During Playlist Changes (Priority: P1)

**Goal**: Clear live projected content while playlist changes prepare only operator preview state

**Independent Test**: Start with live projected content active, change playlists through supported
Worship Console flows, and confirm the live projector does not change until the operator explicitly
projects a song section after the live content has cleared.

### Implementation for User Story 2

- [X] T007 [US2] Update playlist change handling in `src/App.jsx` so every activation clears live song and Bible content without clearing operator preview or projector background
- [X] T008 [US2] Preserve projector synchronization and persisted background state in `src/App.jsx` while broadcasting the intentional clear to projector windows
- [X] T009 [US2] Confirm explicit song-section projection controls in `src/App.jsx` still remain the only path that sends new lyrics live after a playlist change

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Clear Preview for Empty Playlists (Priority: P2)

**Goal**: Clear stale operator preview state when an active playlist has no songs

**Independent Test**: Select or activate an empty playlist and verify the current song selection
and preview clear while live projector content clears and its selected background remains intact.

### Implementation for User Story 3

- [X] T010 [US3] Update empty-playlist activation handling in `src/App.jsx` to clear the current song selection and operator preview state
- [X] T011 [US3] Ensure empty-playlist activation in `src/App.jsx` clears live projected content without clearing the selected background, projector synchronization state, or persisted background state

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and small cross-story cleanup

- [X] T012 [P] Review `src/App.jsx` for duplicated playlist activation logic and consolidate any remaining repeated preview-selection code paths
- [X] T013 Run `npm run build` in `/Users/jeankennedydemosthene/Dev/church-song-ui` and address any build issues caused by `src/App.jsx` changes
- [ ] T014 Run the manual validation scenarios from `specs/001-playlist-initial-song-selection/quickstart.md` and record any follow-up notes in `specs/001-playlist-initial-song-selection/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on Foundational completion and should be validated against User Story 1 behavior because both touch playlist activation
- **User Story 3 (Phase 5)**: Depends on Foundational completion and can proceed after User Story 1 establishes the preview-selection path
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - establishes the non-empty playlist preview behavior and MVP
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) but should land with or immediately after US1 because it protects the same activation flows from live projector regressions
- **User Story 3 (P2)**: Depends on the shared playlist activation path introduced for US1 and can be added without changing US2's live-projection rules

### Within Each User Story

- Shared preview/live state separation must exist before story implementation
- Playlist activation behavior changes before final validation
- Build and manual workflow validation after implementation

### Parallel Opportunities

- T003 can run in parallel with T002 because it updates documentation rather than source behavior
- T012 can run in parallel with validation preparation once implementation is stable
- If multiple developers are available after Phase 2, one can focus on US1 preview selection while another reviews US2 projector-safety implications, but both changes converge in `src/App.jsx` and require careful coordination

---

## Parallel Example: User Story 1

```bash
Task: "Update non-empty playlist activation flows in src/App.jsx so the active playlist's first song becomes the operator's selected preview song"
Task: "Apply existing canonical song resolution and language-aware preview behavior to the playlist's first song in src/App.jsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Verify non-empty playlist selection prepares the first song in preview without extra operator action

### Incremental Delivery

1. Complete Setup + Foundational to establish preview/live separation
2. Add User Story 1 and validate non-empty playlist preview preparation
3. Add User Story 2 and validate projector protection across playlist changes
4. Add User Story 3 and validate empty playlist clearing
5. Finish with build and manual quickstart validation

### Parallel Team Strategy

With multiple developers:

1. One developer establishes the shared preview/live helper changes in `src/App.jsx`
2. Once that is stable:
   - Developer A: non-empty playlist preview preparation
   - Developer B: projector-state preservation review and validation
   - Developer C: empty-playlist clearing and final manual validation updates

---

## Notes

- [P] tasks = different files or coordination-light work
- [Story] labels map each implementation task back to the approved spec
- `src/App.jsx` is the primary implementation surface for all three user stories
- User Story 1 is the suggested MVP scope
- All tasks above follow the required checklist format with task ID, optional markers, story labels where required, and exact file paths
