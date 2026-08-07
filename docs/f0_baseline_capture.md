# F0 Frontend Baseline Capture

Date: 2026-08-07

## Approval and repository baseline

- Implementation authorization: the 2026-08-07 user instruction explicitly approves the three
  Portal frontend designs and directs implementation in F0 through F11 order.
- Portal base: `8db066f1c3152c71004ea71e8e03bbf62e226ae1`
  (`chore: scaffold nodus-portal repository`).
- Portal branch at capture: `main`.
- PA-CONTROL reference revision: `1c44efbe0b03fa77187305d0f50948f731e972f0`
  (`Merge pull request #4 from jgYunRobot/gym_cli_update`). It is read-only.
- Pilot public-contract revision: `010f410f99ba7809b898100c911d6bacf2cfc7c5`
  (`test(phase-h): strengthen external evidence`).

## Public-contract provenance

- Artifact: `schemas/pilot/v1/openapi.yaml` in the Pilot revision above.
- OpenAPI version: `3.1.0`; public API version: `1.0.0`.
- SHA-256:
  `998a120a2390e127ba219262010775a45bf78c9fa513b068bbc6c6d318e2f1d7`.
- Confirmed public paths needed by the ordered frontend work: health, snapshot, components,
  per-Control status/latest/replay/SSE, Pilot stream descriptors/subscription, endpoints, events,
  and typed operation admission. Portal will copy and pin this artifact at F4, rather than use the
  sibling checkout at build or runtime.

## Legacy behavior reference

- The read-only legacy UI has a React/Vite package plus separate robot scene, joint/task jog,
  command, Camera, Policy, and event presentation modules.
- `joint_state.ts` contains retained presentation conversions and speed constants. Its old 10 ms
  discrete delta calculation and `robot_operation_session.ts` PilotBridge/PA-CPU calls are not
  migration inputs for Portal integration or hold scheduling.
- The legacy source has no committed frontend test suite. Portal begins with its own deterministic,
  public-contract-only tests.

## Toolchain support check

- Node.js 24 is an active LTS line according to the official release schedule. The host currently
  supplies Node.js 18.19.1, which is end-of-life and cannot validate the selected Vite 8 baseline.
- React 19.2 is a released stable line. Vite documents 8.1 as supported for important/security
  fixes; F1 will lock its latest 8.1 patch and all resolved package versions in `package-lock.json`.
- Exact package selection and clean installation are F1 work; this checkpoint deliberately adds no
  application runtime, dependency, asset, or build file.

## F0 validation

- Read the Portal root and documentation-path instructions, coding rules, persona, project rules,
  all three design documents, and the progress log.
- Ran `./setup_dev.sh`; the `docs/agent_docs` submodule is initialized at its pinned revision.
- Verified Portal/Pilot/PA-CONTROL revisions and worktree state without changing the two reference
  repositories.
- Read the Pilot public OpenAPI artifact directly and checked its digest and public endpoint set.
