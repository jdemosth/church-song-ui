# UI Contract: Playlist Initial Song Selection

## Purpose

Define the user-visible contract for how playlist activation affects operator preview state and
live projector state in the Worship Console.

## Contract

### Trigger

- A playlist becomes the active playlist through an existing Worship Console workflow.

### Non-empty playlist outcome

- The first song in the active playlist becomes the operator's selected preview song.
- The Current Song/preview area updates to show that first song immediately.
- The local Projector Preview stages that selected song and section without sending it live.
- No prepared song lyrics or song section are sent live as part of playlist activation; existing
  live content is cleared instead.

### Empty playlist outcome

- The operator's current song selection clears.
- The Current Song/preview area shows its existing empty state.
- The live projector clears its content while preserving its background settings.

### Live projection protection

- If the projector is already showing song lyrics, Bible content, or any other supported live
  content, activating or changing playlists clears that content without replacing it with the new
  preview song. The selected projector background remains unchanged.
- The projector shows new song lyrics only after the operator explicitly sends a song to the
  projector through existing controls.

### Compatibility expectations

- Existing playlist workflows remain intact outside the initial preview selection behavior defined
  here.
- Existing song-selection, persistence, cross-window synchronization, multilingual song handling,
  and projector behaviors remain unchanged unless they are directly required to support this
  contract.

### State invariant

- Playlist activation may update operator preview selection, but it must not change live projector
  content by itself.
- Live song or Bible projection state remains owned by the existing explicit projection actions.

## Validation References

- See [quickstart.md](../quickstart.md) for manual verification scenarios.
- See [data-model.md](../data-model.md) for state relationships and invariants.
