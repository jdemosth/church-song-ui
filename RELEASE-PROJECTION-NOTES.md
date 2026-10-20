# Projection release fixes

Song Previous/Next stays in the Song preparation context. Only the existing
`isCurrentSongLive` check permits its section changes to reach the live projector.
Bible navigation retains its own controls and also checks Bible ownership before
sending a network command. Explicit Send Live remains the way to switch content.

Black is an ordinary preset, persisted through existing application Settings.
The temporary Black Screen action remains independent. Bible presentation itself
uses black, regardless of the selected song/notes/event background.

Custom uploads use the existing browser IndexedDB database `church-song-ui`, store
`projection-backgrounds`. Records contain `id`, `file` (the image Blob/File),
`fileName`, `mimeType`, and `updatedAt`. The selected descriptor continues using
the existing projector localStorage state. The latest local upload remains
available after choosing a preset. LAN transport embeds validated image bytes in
the existing background command/snapshot; projectors need no access to the
operator's filesystem. This is browser/origin-local storage, not a server image
archive: clearing site data, private browsing, changing browser/profile or changing
the host/port can make the upload unavailable. Re-upload on that origin if needed.
Browser restart with retained site data preserves the stored file.

## Kreyòl source dataset and runtime installation

The bundled API source database now includes official eBible `hat`, Bib La 1985
(`HAT1985`), with 31,102 real public-domain verses. Trilingual projection uses
WEB + LSG1910 + HAT1985; English-only and English/French retain KJV.
The existing installed runtime copy is not modified by source import.
The three-language choice is disabled until `/bible/translations` advertises an
installed translation with language `HAITIAN_CREOLE` (also recognized: `HT`,
`HAT`, `KREYOL`, `KREYÒL`). Its code is obtained from server metadata, not assumed.
If multiple Kreyòl translations are installed, this first version uses the first
matching entry returned by the server.

The verified dataset was imported into the existing offline SQLite schema
(see API `src/main/resources/bible/HAT1985-SOURCE.md` for provenance):

- `bible_translation`: unique `id`, unique `code`, real `name`, `language`,
  `copyright_notice`, `license_info`, `source_url`.
- `bible_book`: reuse the existing canonical book IDs/keys and book order.
- `bible_verse`: `translation_id`, `book_id`, `chapter`, `verse`, exact stored
  `text`, with unique `(translation_id, book_id, chapter, verse)` and normal IDs.

The bundled file is `church-song-api/src/main/resources/bible/bible.db`; the Mac
installed copy is `~/.church-song/reference-data/bible.db`. Windows uses its
configured reference-data directory. Import/rebuild the complete Bible dataset
separately, preserving all current translations. Do not insert replacement or
machine-translated verses. Review the existing startup Bible checksum/copy logic
and launcher's mismatch guard as part of that separate data update.

No schema migration is required. No projector client database is needed. The
operator loads the selected translations from the API and puts matching verse
texts in the normal live snapshot. Three-language projection uses only shared canonical verse numbers, requesting
contiguous API ranges around source gaps. It rejects explicit sends of a verse
missing from a selected translation and never renumbers or fabricates text.
References use stored localized names where available, otherwise canonical names.

Prepared Bible projector preview uses the same block renderer as the projector,
without sending live. English, French and (when installed) Kreyòl are stacked in
that order. Auto-fit measures each whole verse/reference block and chooses a
common size. Rendering a third block does not require a layout redesign.

The integration tests use conspicuously named synthetic `TEST FIXTURE` text only
to exercise absent/present translation capability; no such data is shipped or
written into the installed Bible database. Real bilingual layout checks use the
bundled John 3:16–18 and Esther 8:9 passages on a disposable test server.
Real HAT1985 checks cover trilingual John 3/4 and numbering gaps in Luke 17.
