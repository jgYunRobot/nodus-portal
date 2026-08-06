# Project Documentation Rules

## Design documents

- Keep every project design document directly under `docs/designs/` in a flat layout. Do not create subdirectories below `docs/designs/`.
- Name design documents `<path>_<design_name>_design.md`. Convert the repository-relative owner path and design name to lowercase `snake_case`, and replace path separators with underscores.
- Record migration constraints and the exact source inventory before copying files from `pa_control/apps/web_ui`.
- Keep Portal integration designs based on published Pilot contracts and direct provider endpoints; do not design against Pilot internals or Control IPC.

## Progress log

- Keep the project progress log in `docs/progress.md`.
- After every coding task, update `docs/progress.md` with the change summary, current status/result, and next planned goals or remaining TODOs.
