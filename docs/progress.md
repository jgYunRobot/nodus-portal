# Progress

## 2026-08-07 - Initial repository scaffold

### Changes

- Added `docs/agent_docs` as the pinned shared-rules submodule used by `nodus-pilot` and `nodus-control`.
- Added the root agent router, project documentation rules, progress log, README, and submodule setup script.
- Recorded the Portal-to-Pilot, direct provider data-plane, no-direct-Control, and cooperative single-mutator boundaries.

### Status

- The repository is ready for Portal migration design work without prematurely selecting or copying frontend source, dependencies, assets, or build tooling.
- No files from `pa_control/apps/web_ui` have been migrated.
- No runtime, build, or test command has been introduced.

### Next goals

- Inventory the existing `pa_control/apps/web_ui` source, assets, dependencies, tests, and current Pilot/PA-CPU coupling.
- Define a phased migration design that replaces PA-CPU/Pilot-internal assumptions with the public Pilot contracts.
- Select and document the Portal package, build, test, and deployment layout before copying implementation files.
