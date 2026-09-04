# Feature Specification: Playlist Initial Song Selection

**Feature Branch**: `[001-playlist-initial-song-selection]`

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "Feature: Playlist Initial Song Selection

When the operator selects or activates a playlist in the Worship Console:

- If the playlist contains songs, automatically select the first song in that playlist.
- Show that first song in the operator's Current Song/preview area so it is immediately ready for use.
- Do NOT automatically send the first song or any of its lyrics to the live projector.
- If the live projector is already displaying content, selecting or changing a playlist must clear
  that live projected content without changing projector background settings.
- The operator must explicitly select/project a song section before new lyrics are sent to the live projector.
- If the selected playlist is empty, clear the current song selection and operator preview.
- Preserve all existing playlist, song-selection, projector, BroadcastChannel, and persistence behavior unless this specification explicitly changes it.

The intended behavior is:

Select non-empty playlist
→ first song becomes selected
→ first song appears in operator preview
→ live projector content clears

Select empty playlist
→ current song selection is cleared
→ operator preview is cleared
→ live projector content clears"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ready First Song on Playlist Select (Priority: P1)

As a worship operator, I want the first song in a selected playlist to become the current preview
song automatically so that I can begin working from the playlist immediately without sending
anything live by accident.

**Why this priority**: This is the primary workflow change and the main value of the feature.

**Independent Test**: Can be fully tested by selecting a playlist that contains songs and
verifying that the first song appears in the Current Song/preview area while the live projector
content clears without displaying that prepared song.

**Acceptance Scenarios**:

1. **Given** the operator is in the Worship Console and selects a playlist with at least one song,
   **When** the playlist becomes the active playlist, **Then** the first song in that playlist
   becomes the current selected song for the operator preview.
2. **Given** a playlist with at least one song becomes active, **When** the first song is selected
   automatically for preview, **Then** the operator can immediately see that song in the Current
   Song and Projector Preview areas without taking any extra action.
3. **Given** a playlist with at least one song becomes active, **When** the first song is selected
   automatically for preview, **Then** no song lyrics or song section are sent to the live
   projector as part of that playlist change.

---

### User Story 2 - Clear Live Projection During Playlist Changes (Priority: P1)

As a worship operator, I want live projected content cleared when I change playlists so that a
prepared next song can never appear to the congregation before I explicitly send it.

**Why this priority**: Protecting live projection is essential to avoid service disruption.

**Independent Test**: Can be fully tested by projecting any live content, changing playlists, and
verifying that the projected content becomes clear while the new first song remains preview-only.

**Acceptance Scenarios**:

1. **Given** the live projector is currently displaying lyrics or Bible content, **When** the
   operator selects a different playlist, **Then** the live projector clears its content while
   preserving its selected background.
2. **Given** a new playlist is selected and its first song is shown in the operator preview,
   **When** the operator does not explicitly project a song section, **Then** the live projector
   remains clear.
3. **Given** the operator wants new lyrics on the live projector after a playlist change,
   **When** the operator explicitly selects and projects a song section, **Then** the live
   projector updates only in response to that explicit action.

---

### User Story 3 - Clear Preview for Empty Playlists (Priority: P2)

As a worship operator, I want empty playlists to clear the current song preview so that the UI
accurately reflects that there is nothing ready to present from that playlist.

**Why this priority**: It prevents stale preview state from suggesting a song is available when the
selected playlist has none.

**Independent Test**: Can be fully tested by selecting an empty playlist and verifying that the
current song selection and operator preview are cleared while the live projector content clears and
its selected background remains intact.

**Acceptance Scenarios**:

1. **Given** the operator selects a playlist with no songs, **When** that playlist becomes active,
   **Then** the current song selection is cleared.
2. **Given** the operator selects a playlist with no songs, **When** the current song selection is
   cleared, **Then** the operator preview area no longer shows a previously selected song.
3. **Given** the live projector is displaying content and the operator selects an empty playlist,
   **When** the operator preview is cleared, **Then** the live projector content clears while its
   selected background remains intact.

### Edge Cases

- What happens when a playlist change re-selects the same non-empty playlist? The first song is
  shown in the operator preview again only if the application treats that action as a fresh
  playlist activation; a fresh activation clears live projected content either way.
- How does the system handle a playlist whose first entry is unavailable or cannot be displayed in
  the preview? The application clears live projection and presents no new live content until the
  operator explicitly selects and sends a valid song section.
- What happens when the operator changes playlists while another song is selected in preview but
  nothing is projected live? The new playlist follows the same rule: first song for non-empty,
  cleared preview for empty, and no automatic live projection.
- What happens when the selected playlist contents have changed since they were last viewed? The
  current preview reflects the current first song in the active playlist at the time of selection.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST automatically select the first song in a playlist when the operator
  selects or activates a playlist in the Worship Console and that playlist contains one or more
  songs.
- **FR-002**: The system MUST display the automatically selected first song in the operator's
  Current Song and staged Projector Preview areas immediately after the playlist becomes active.
- **FR-003**: The system MUST NOT automatically send the first song, its lyrics, or any song
  section to the live projector as a result of selecting or activating a playlist.
- **FR-004**: If the live projector is already displaying content, the system MUST clear live song
  lyrics or Bible content when the operator selects or changes playlists while preserving the
  selected projector background.
- **FR-005**: The system MUST require an explicit operator action to select and project a song
  section before new lyrics are sent to the live projector after a playlist change.
- **FR-006**: If the selected playlist is empty, the system MUST clear the current song selection
  and operator preview.
- **FR-007**: The system MUST preserve existing playlist behavior, song-selection behavior,
  projector behavior, cross-window synchronization behavior, and persistence behavior except for
  the explicit preview-selection change defined in this specification.
- **FR-008**: The system MUST apply the same behavior whenever a playlist becomes the active
  playlist through supported operator flows in the Worship Console, including direct playlist
  selection and playlist activation actions already present in the product.
- **FR-009**: The system MUST keep operator preview state and live projector state independent
  during playlist changes so that preview updates do not imply a live projection update.

### Key Entities *(include if feature involves data)*

- **Active Playlist**: The playlist currently selected or activated by the operator in the Worship
  Console, including its ordered list of songs.
- **Current Song Preview**: The operator-facing selected song state shown in the Current
  Song/preview area and used to prepare the next projection action.
- **Staged Projector Preview**: The local projector preview of the selected song and section that
  the operator can review before sending it live.
- **Live Projected Content**: The content currently visible on the projector, which may be song
  lyrics, a song section, Bible content, or other supported projected content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tested non-empty playlist selections, the operator sees the first song in
  the Current Song/preview area immediately after the playlist becomes active.
- **SC-002**: In 100% of tested playlist changes, live projected content becomes clear and remains
  clear until the operator explicitly sends a song to the projector.
- **SC-003**: In 100% of tested empty playlist selections, the current song selection and operator
preview are cleared while live projector content is cleared and the selected background remains.
- **SC-004**: Operators can prepare the next song from a playlist in a single playlist-selection
action without accidentally projecting the prepared song.

## Assumptions

- Playlist order already defines which song counts as the first song for operator preview.
- Existing supported playlist selection and activation flows in the Worship Console remain in scope,
  while unrelated navigation or editing workflows are not changed by this feature.
- The Current Song/preview area already has an established empty state that can be shown when no
  song is selected.
- Existing live projector, cross-window synchronization, and persisted session behavior remain
unchanged except for the intentional live-content clear and preview-versus-live separation
described in this feature.
