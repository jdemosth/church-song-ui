<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles:
- Template principle slot 1 -> I. Workflow Stability First
- Template principle slot 2 -> II. Incremental Frontend Change
- Template principle slot 3 -> III. Backward-Compatible UI Behavior
- Template principle slot 4 -> IV. Backend-Aware UI Contracts
- Template principle slot 5 -> V. Core Worship Workflow Preservation
- Added VI. Offline-First Bible Operation
- Added VII. Multilingual Experience Preservation
- Added VIII. Clear Component and State Boundaries
- Added IX. No Silent Feature Removal
- Added X. Testable UI Behavior
- Added XI. Accessibility and Predictable Interaction
- Added XII. Safe Persistence and Synchronization Evolution
- Added XIII. Multi-Church Ready Without Premature Complexity
- Added XIV. Specification and Plan Traceability
- Added XV. Verified Frontend Completion Gates
Added sections:
- Implementation Constraints
- Delivery Workflow
Removed sections:
- None
Follow-up TODOs:
- None
-->
# Church Song UI Constitution

## Core Principles

### I. Workflow Stability First
Existing working functionality and user workflows MUST be preserved unless an approved
specification explicitly changes them. Regressions in primary worship flows, editing flows,
projection flows, or persisted UI behavior are defects and MUST be treated as release blockers.

Rationale: The frontend is the operational surface used during real services, so reliability of
known workflows matters more than opportunistic redesign.

### II. Incremental Frontend Change
Frontend changes MUST be incremental and scoped to the approved need. The application MUST NOT
receive unnecessary architectural rewrites, framework migrations, or broad state-management
replacements unless an approved specification demonstrates the need and protects existing
behavior.

Rationale: Small, targeted changes are easier to verify across a large UI with many interactive
paths.

### III. Backward-Compatible UI Behavior
UI behavior MUST remain backward compatible by default. Navigation patterns, interaction flow,
screen semantics, keyboard behavior, and persisted usage expectations MAY change only when a
feature specification explicitly requires it and documents the user impact.

Rationale: Users build muscle memory around worship operation screens, and unintended behavior
changes carry real service risk.

### IV. Backend-Aware UI Contracts
Any UI change that depends on API behavior MUST account for the corresponding backend contract
before implementation begins. Specifications and plans MUST identify the expected backend contract,
compatibility assumptions, required sequencing, and any fallback behavior needed if the frontend
and backend roll out separately.

Rationale: The frontend and backend must evolve together without breaking live usage.

### V. Core Worship Workflow Preservation
Projector behavior, operator workflow, playlist behavior, service-history behavior, and
song-selection behavior MUST remain stable unless an approved specification explicitly changes
them. Any work touching these areas MUST state the current behavior, intended delta, and
compatibility protections.

Rationale: These flows form the operational core of the Church Song application.

### VI. Offline-First Bible Operation
Bible functionality MUST remain fully usable offline for core operation. Core Bible lookup,
preview, and projection flows MUST NOT depend on internet access at runtime, and UI changes to
Bible screens MUST preserve that offline baseline unless explicitly marked as non-core optional
enhancements in the specification.

Rationale: Bible access is a core ministry need and must remain dependable in low-connectivity
environments.

### VII. Multilingual Experience Preservation
Multilingual song support and language-aware behavior MUST be preserved. Changes to song display,
selection, family relationships, filters, language pills, Bible reference language handling, or
projection behavior MUST maintain the existing ability to operate across supported languages unless
an approved specification explicitly changes that behavior.

Rationale: Language-aware worship workflows are central product behavior, not optional polish.

### VIII. Clear Component and State Boundaries
Components, hooks, utilities, state containers, and side-effect boundaries MUST remain clear and
maintainable. Business or workflow logic MUST NOT be duplicated unnecessarily across components,
and shared behavior MUST be centralized where practical.

Rationale: Clear boundaries keep the React/Vite codebase easier to extend without introducing
drift.

### IX. No Silent Feature Removal
Existing features, controls, keyboard behavior, projector controls, and persistence behavior MUST
NOT be silently removed or degraded. Any intentional removal or deprecation MUST be explicit in
the approved specification, visible in review, and justified in terms of user impact.

Rationale: Silent removal breaks trust and often surfaces only during service use.

### X. Testable UI Behavior
New UI behavior MUST be testable and SHOULD include appropriate automated tests where practical.
Riskier changes, especially those affecting workflows, persistence, synchronization, or API-driven
rendering, MUST include automated coverage or a documented reason why coverage is not practical.

Rationale: High-change interfaces need executable checks to prevent regressions across many user
paths.

### XI. Accessibility and Predictable Interaction
Accessibility, readable layouts, and predictable user interaction MUST be preserved. Changes MUST
maintain usable focus behavior, readable content structure, understandable controls, and stable
interaction feedback across desktop and projector-adjacent workflows.

Rationale: The application is used in time-sensitive settings where clear interaction matters.

### XII. Safe Persistence and Synchronization Evolution
Changes to `localStorage`, `BroadcastChannel`, projector synchronization, or persisted UI state
MUST preserve existing sessions and backward compatibility where practical. Migrations of stored
state MUST be compatibility-aware, and new synchronization behavior MUST avoid breaking current
operator or projector windows.

Rationale: Persisted state and cross-window sync sit directly on active worship sessions and are
costly to break.

### XIII. Multi-Church Ready Without Premature Complexity
New frontend work MUST avoid blocking future multi-church, multi-tenant evolution, but MUST NOT
introduce premature tenant abstractions without a concrete requirement. Designs SHOULD keep seams
for future church-aware configuration, branding, and data partitioning while preserving today’s
simplicity.

Rationale: The product needs room to grow without paying unnecessary complexity costs now.

### XIV. Specification and Plan Traceability
Every implementation MUST be traceable back to an approved specification and plan. UI changes,
state changes, interaction changes, and test additions MUST be explainable in terms of the
governing Spec Kit artifacts for that work.

Rationale: Traceability keeps scope disciplined and reviewable.

### XV. Verified Frontend Completion Gates
Implementation is not complete until the frontend builds successfully and the relevant tests pass.
Completion claims MUST identify what was verified and MUST distinguish completed validation from
any remaining risk or unrun checks.

Rationale: Frontend correctness depends on verified build and interaction safety, not just visual
inspection.

## Implementation Constraints

- React and Vite remain the existing frontend platform unless an approved specification explicitly
  authorizes otherwise.
- UI behavior that depends on backend responses MUST be reviewed against the corresponding API
  contract before release.
- Core Bible workflows MUST continue to operate without network dependence during normal use.
- Multilingual song behavior and projector workflows MUST remain compatible with current usage
  unless explicitly changed by specification.
- Persisted browser state and cross-window projector synchronization MUST evolve with backward
  compatibility in mind.

## Delivery Workflow

- Work begins with an approved specification and an approved implementation plan.
- Implementation tasks MUST map back to those artifacts before UI code changes are considered in
  scope.
- Reviewers MUST check workflow stability, API dependency impact, persistence compatibility,
  accessibility risk, and automated test coverage as part of normal review.
- Before completion, contributors MUST verify a successful frontend build and the relevant tests,
  and they MUST report any validation they could not run.

## Governance

This constitution governs frontend changes for the Church Song UI and takes precedence over local
habits or undocumented preferences. Amendments require an explicit update to this document, a clear
reason for the change, and review against existing specifications, plans, UI behavior, backend
contract assumptions, offline Bible requirements, persistence compatibility, and synchronization
impact.

Versioning policy for this constitution follows semantic versioning. MAJOR versions capture
backward-incompatible governance changes or removals of existing principles. MINOR versions add new
principles or materially expand governance requirements. PATCH versions clarify wording without
changing intent.

Compliance review is mandatory for every implementation. Reviews MUST confirm that the work is
traceable to approved Spec Kit artifacts, preserves stable user workflows unless explicitly
changed, accounts for backend dependencies, maintains accessibility and persistence expectations,
includes appropriate automated tests where practical, and verifies build success plus relevant test
execution before the work is considered complete.

**Version**: 1.0.0 | **Ratified**: 2026-08-29 | **Last Amended**: 2026-08-29
