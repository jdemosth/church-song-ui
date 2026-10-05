# Permanent sermon and teaching Notes

Notes > Save Note writes to the server's main SQLite database. Saved Notes opens
that shared archive; Open/Edit loads a record into the existing editor, closes the library and focuses
the note body. The single Saved Notes disclosure is collapsed by default. Its count comes from
GET /notes/count and includes all database notes, independent of search.
The normal form shows Subject (stored as `topic`), Date and Note.
Hidden title, author, scripture, tags and service metadata are retained when editing.
Subject is optional. New notes use Subject, or the internal fallback "Untitled note",
to supply the title required by the existing API; later
Subject edits retain that stored title. Legacy notes without a Subject show “—”.
New Note starts a new draft; saving an opened record updates its existing ID. Delete requires confirmation and leaves the editor/live projection intact.
Search matches title, content, scripture, topic, author and tags (case-insensitive).

Use Open/Edit on a saved record, then Preview Note to review it in the existing
dialog and explicitly choose Send Note Live. Saving, loading, deleting and searching
never send projector commands. A live Note remains an independent snapshot.

Archive content supports 100,000 characters and preserves whitespace/line breaks.
The projector's existing 2,000-character/40-line limit remains unchanged. Longer
teaching notes can be saved and previewed in full; use New Note and copy a shorter excerpt
for projection. Saving does not require projection. No book export is implemented.

## Storage and API

The additive `notes` table contains id, title, content (TEXT), noteDate,
speakerOrAuthor, scriptureReference, topic, tags, createdAt, updatedAt and optional
servicePlanId. New Note within a loaded service plan records that optional ID.
There is no cascade deletion from service history. Stable Note IDs allow future
book/chapter membership and custom ordering in separate tables without imposing
one-book-per-note assumptions. Tags are a simple comma-separated string for v1.

- GET /notes?q=search — latest updated first, with optional literal substring search
- GET /notes/count — total permanent notes (no body download)
- GET /notes/{id}
- POST /notes — 201, new ID/timestamps
- PUT /notes/{id} — include the returned updatedAt to detect stale edits (409)
- DELETE /notes/{id} — 204; unknown IDs return 404

Title and content are required; other metadata and the service reference are
optional. Metadata limits are enforced by the API. Search loads the archive for a
simple first version; pagination/indexed search can be added if the library grows.

## Offline use, upgrades and backup

No cloud or internet is required. The application server must be running locally
or reachable on the church LAN. A disconnected browser retains its current draft
but cannot claim a database save succeeded. Browser-local drafts/recent projections
remain separate; existing local notes are not silently migrated. Save the current draft to preserve it
in the database. Recent projection history is retained internally but not displayed.

The existing Hibernate `ddl-auto=update` configuration creates the new table on
normal startup. Application-only upgrades must retain the existing database/data
folders. Do not replace the database with a fresh or development copy. The existing
Settings database export uses SQLite VACUUM INTO for the whole database, so Notes
and all their metadata are included automatically. Tests verify restart persistence
and read the saved Note directly from the exported database. No operational database
was used by verification.

Preview and live Notes share a bordered header: optional Subject, then Date,
followed by the body. A missing date is shown as “—”; no date is invented.
Header metadata travels with the explicit live snapshot; edits require a fresh
preview/send and cannot mutate live content. Updated UI and API builds must be
used together for LAN header transport. The existing body limits and navigation
algorithm remain unchanged. Saved Notes pagination is not implemented.

## Print

Print in the editor uses the current draft. Print beside a saved record fetches
that record without replacing the editor or sending any projector command. Both
use the browser/system print dialog and the same optional Subject/Date header,
on a print-only white page with black text and 18 mm margins. The application
controls are excluded; long bodies flow across pages with their line breaks.
The print document is removed after the browser's afterprint event. Printer,
page range, copies, orientation and Save as PDF are browser/system options.

Note revision timestamps now use SQLite's millisecond precision and increase
for consecutive saves, preventing false stale-edit conflicts while retaining
conflict detection. No schema change is required.
