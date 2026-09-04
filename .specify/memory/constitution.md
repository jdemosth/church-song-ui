<!--
Sync Impact Report
Version change: 1.0.0 -> 2.0.0
Modified principles:
- I. Backward Compatibility First -> I. Platform Integrity
- II. Incremental Change Over Rewrite -> II. Worship Reliability and Operator Safety
- III. Stable REST Contracts -> III. Offline-First Core Functionality
- IV. UI-Aware API Evolution -> IV. Data Integrity, Compatibility, and Preservation
- XIII. Specification and Plan Traceability -> V. Specification and Verification Discipline
Added sections:
- Architecture and Technology Constraints
- Development Workflow and Quality Gates
Removed sections:
- Implementation Constraints
- Delivery Workflow
Follow-up TODOs:
- None
-->
# Church Song Platform Constitution

## Core Principles

### I. Platform Integrity
`church-song-ui` and `church-song-api` are separate repositories but one product. Every feature
MUST identify whether it affects the UI, API, or both. Cross-repository features MUST be
specified, planned, implemented, and tested as one platform behavior. Business rules MUST have one
authoritative home and MUST NOT be duplicated between UI and API. Existing API contracts and UI
behavior MUST remain compatible unless an approved specification explicitly authorizes a breaking
change.

Rationale: The operator experiences one Church Song Platform, regardless of repository boundaries.

### II. Worship Reliability and Operator Safety
Live worship behavior MUST prioritize predictable, safe operation. Operator preview state and live
projector state MUST remain conceptually separate. Selecting or previewing content MUST NOT
unintentionally change what the congregation sees, and projector actions that affect live output
MUST be explicit. Projector session restoration, clear lyrics, black screen, background selection,
Previous/Next navigation, and separate projector-window behavior MUST NOT regress. Worship-critical
workflows MUST favor simple, deterministic behavior over clever automation.

Rationale: An unexpected live projection change can disrupt a worship service immediately.

### III. Offline-First Core Functionality
Core worship functionality MUST remain usable without internet access. Normal Bible projection MUST
NOT require internet access; Bible data MUST be bundled or stored locally behind the existing
provider abstraction. Web or API Bible sources MAY be optional enhancements, but MUST NOT become a
runtime dependency for core projection. Local song, playlist, service, settings, and Bible
workflows MUST continue functioning offline wherever they currently do.

Rationale: Worship services must be reliable in low-connectivity and no-connectivity environments.

### IV. Data Integrity, Compatibility, and Preservation
Existing songs, song families, multilingual translations, editable song sections, playlists,
service history, settings, backups, and Bible data MUST be preserved. Database or schema changes
MUST include a migration or compatibility plan. Service History snapshots MUST remain immutable;
reusing a service MUST create new working state rather than mutate historical records. Changes MUST
avoid silent data loss, and backward compatibility is the default unless a specification explicitly
documents and justifies a migration.

Rationale: Church data represents durable ministry records and cannot be casually recreated.

### V. Specification and Verification Discipline
Feature work MUST follow this lifecycle: Constitution -> Specification -> Plan -> Tasks ->
Implementation -> Verification. Specifications MUST define user-visible behavior and acceptance
criteria before implementation. Plans MUST identify affected repositories and architectural
boundaries, and tasks MUST identify ownership as UI, API, or Integration. Implementation MUST NOT
silently expand beyond the approved specification. Every completed feature MUST be tested against
its acceptance criteria; adjacent worship-critical workflows require regression testing. Fixes
found during testing MUST update the relevant specification or tasks when they change intended
behavior.

Rationale: Explicit scope and verification make live-operation changes safer and auditable.

## Architecture and Technology Constraints

- The UI MUST use React with Vite, and the API MUST use Java with Spring Boot.
- Persistence MUST remain compatible with the existing SQLite-based storage unless an approved
  feature explicitly plans a migration.
- Bible data MUST remain logically separate from the main application database wherever that
  separation already exists.
- Multilingual infrastructure MUST continue supporting English, Haitian Creole, Spanish, and French
  wherever those languages are currently supported.
- Manual translations and editable song sections MUST remain first-class supported data.
- Operator and projector experiences MUST remain separate concerns.
- Current features MUST NOT introduce premature multi-tenancy, billing, or cloud-only dependencies.
  A future web-based multi-church subscription platform requires its own approved specification.
- Architecture MUST remain simple; teams MUST reuse existing abstractions and helpers before adding
  duplicate state, services, dependencies, or unnecessary layers.

## Development Workflow and Quality Gates

- Before implementation, teams MUST inspect both `church-song-ui` and `church-song-api` when a
  feature could cross their boundary.
- Each plan MUST explicitly classify the change as UI-only, API-only, or cross-repository.
- Work MUST preserve existing behavior outside the approved feature scope.
- Completion requires relevant UI tests, API tests, build checks, and manual acceptance testing.
- Cross-repository changes MUST include integration verification.
- Worship-critical changes MUST include manual projector-behavior testing.
- Contributors MUST NOT commit generated artifacts, temporary files, local database backups, IDE
  files, or secrets unless they are intentionally part of the product.
- Credentials, secrets, church-specific private values, and machine-specific absolute paths MUST
  NOT be hardcoded.
- Every new dependency MUST be justified by the feature, and changes MUST remain small and
  reviewable.

## Governance

This constitution governs both repositories in the Church Song Platform workspace and takes
precedence over local habits and undocumented preferences. Feature specifications, plans, and tasks
MUST comply with it. If an existing specification conflicts with this constitution, the conflict
MUST be identified before implementation. Amendments MUST be explicit, documented, and reviewed for
effects on offline capability, data integrity, compatibility, and projector safety. Those
protections MUST NOT be weakened without a deliberate constitution amendment.

Constitution versions follow semantic versioning: MAJOR for incompatible governance changes, MINOR
for new principles or materially expanded rules, and PATCH for clarifications only. Compliance
review is mandatory before implementation and completion. Reviews MUST verify affected repository
scope, approved artifacts, compatibility protections, required tests, and the relevant acceptance
and regression checks.

**Version**: 2.0.0 | **Ratified**: 2026-08-29 | **Last Amended**: 2026-09-01
