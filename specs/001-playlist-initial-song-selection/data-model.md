# Data Model: Playlist Initial Song Selection

## Entities

### Active Playlist

- **Description**: The playlist currently selected or activated in the Worship Console.
- **Fields**:
  - `id`: Stable playlist identifier
  - `name`: Operator-visible playlist label
  - `songs`: Ordered list of playlist song entries
  - `reusable`: Indicates reusable versus saved/working playlist behavior where already supported
- **Relationships**:
  - Owns an ordered collection of `Playlist Song` entries
  - Drives the operator-facing `Current Song Preview` initialization for this feature
- **Validation Rules**:
  - A playlist may be `null` when nothing is active
  - A playlist may contain zero songs, which must clear preview state
  - Song ordering is authoritative for determining the first preview song

### Playlist Song

- **Description**: A song entry contained in the active playlist order.
- **Fields**:
  - `id`: Song identifier used to resolve canonical song details
  - Position within playlist order
  - Existing song metadata already available to the operator UI
- **Relationships**:
  - Belongs to one `Active Playlist`
  - May resolve to the canonical `Song Preview Candidate` from the full song collection
- **Validation Rules**:
  - The first valid song entry becomes the preview candidate for non-empty playlists
  - If a first entry cannot be resolved for preview, live projection still must not change

### Current Song Preview

- **Description**: The operator-facing song selection shown in the Current Song/preview area.
- **Fields**:
  - Selected song identity
  - Resolved display data used for lyrics and metadata preview
  - Optional source marker indicating how the current song was chosen
- **Relationships**:
  - Derived from the `Active Playlist` when a playlist becomes active
  - Remains separate from `Live Projected Content`
- **Validation Rules**:
  - Non-empty active playlists set preview to the first song
  - Empty active playlists clear preview state
  - Preview changes alone must not imply live projection changes

### Live Projected Content

- **Description**: The content currently shown to the congregation in the projector window.
- **Fields**:
  - Content type (song or Bible content in current behavior)
  - Projected song or passage identity
  - Current visible section/verse position
  - Projection mode and existing presentation settings
- **Relationships**:
  - Updated only by explicit projection actions
  - Persisted and synchronized across operator/projector windows
- **Validation Rules**:
- Playlist activation clears its song or Bible content while preserving projector background settings
  - Existing projector persistence and synchronization continue to depend on explicit live changes

## State Transitions

### Transition 1: Activate non-empty playlist

1. `Active Playlist` changes to a playlist with one or more songs
2. First ordered `Playlist Song` resolves to a `Current Song Preview`
3. `Current Song Preview` updates immediately
4. `Live Projected Content` clears while projector background settings remain unchanged

### Transition 2: Activate empty playlist

1. `Active Playlist` changes to a playlist with zero songs
2. `Current Song Preview` clears
3. `Live Projected Content` clears while projector background settings remain unchanged

### Transition 3: Explicitly project after playlist activation

1. Operator selects/projects a song section from the current preview song
2. `Live Projected Content` updates to the chosen song/section
3. Existing persistence and synchronization behavior runs as it does today

## Invariants

- Playlist activation never sends lyrics live by itself
- Operator selection, staged projector preview, and live projection state remain logically separate
- Existing playlist ordering determines which song is chosen first
- Playlist activation clears live content without replacing it with the prepared song
