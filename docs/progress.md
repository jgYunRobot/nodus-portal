# Progress

## 2026-08-09 - Device deck wheel navigation and taller cards

### Changes

- Added Device deck mouse-wheel navigation: wheel down selects the card to the right and wheel up
  selects the card to the left.
- Retained normal page scrolling at the first and last card, and do not intercept wheel input from
  interactive controls.
- Increased the stable card frame by 3rem on desktop and narrow viewports.
- Added focused Playwright coverage for both wheel directions.

### Status

- The Device deck now supports mouse wheel navigation alongside picker, card-edge, swipe, and
  keyboard navigation.

### Validation

- Test commands were not run because repository rules require explicit user instruction.

### Next goals

- Complete Vision LAN address and browser CORS integration for tablet Camera previews.

## 2026-08-09 - Camera preview stream recovery

### Changes

- Added a bounded Camera MJPEG reader that detects HTTP failure, multipart EOF, invalid parts, and
  five seconds without stream data, then retries Color and Depth with exponential backoff while
  preserving the exact advertised endpoint.
- Kept the active Camera card and information visible while a preview reconnects, and revalidated
  the public device directory after a stream failure.
- Added parser regressions for transport-chunk boundaries and malformed part headers using only
  in-memory bytes; they do not read or assert values from deployment configuration files.

### Status

- Portal now owns MJPEG EOF and stall detection instead of relying on browser `<img>` error events,
  which can leave the last decoded frame visible after the connection has already closed.

### Validation

- Node 24 Prettier check and `git diff --check` passed for the owned Portal changes.
- Vite transformed both new Camera modules with HTTP 200.
- Against the user-running D435 provider, PC and tablet re-established four total Color/Depth
  streams. During a 30-second observation, all four remained active while the capture frame advanced
  from 12744 to 13511 with zero capture timeouts and drops.
- Unit, typecheck, lint, production build, and Playwright were not run because they were not
  explicitly requested.

### Next goals

- Confirm from both screens that an actual network interruption recovers without a page reload.

## 2026-08-09 - Operation page consolidation

### Changes

- Consolidated the robot-scoped Jogging and Operating page model into one canonical Operation page.
- Preserved the existing Jog remote, hold-to-run behavior, 3D visualization, real-time values,
  RobotStatus ownership, and Robot Dock command ownership.
- Defined `/robots/:control_id/operation` as canonical and retained replace redirects from the two
  legacy robot page routes.

### Status

- The focused design is recorded in
  `docs/designs/src_app_operation_page_consolidation_design.md` and supersedes only the route/page
  naming portions of the older navigation, Robot Dock, and frontend architecture designs.
- Existing Device page worktree changes remain out of scope and preserved.

### Validation

- Reviewed the current router, shell navigation, Home card, Robot Dock route-selection helper,
  Jogging/Operating page modules, route fixtures, and applicable Portal designs.
- Scoped Prettier formatting and `git diff --check` passed.
- Typecheck, lint, unit, build, and Playwright commands have not been run because repository rules
  require an explicit request.

### Next goals

- Keep Operation as the single robot workspace while adding future operation-owned features without
  recreating a second duplicate robot-control page.

## 2026-08-09 - Device deck controls simplification

### Changes

- Removed the redundant Previous and Next buttons below the Device card deck.
- Kept direct selection through the device picker, visible adjacent card edges, horizontal drag,
  and keyboard Left/Right Arrow navigation.

### Status

- Device deck navigation remains available without dedicated previous/next controls.

### Validation

- Added Playwright coverage that confirms the removed buttons are not exposed.
- Test commands were not run because repository rules require explicit user instruction.

### Next goals

- Complete Vision LAN address and browser CORS integration for tablet Camera previews.

## 2026-08-08 - Device active-selection retention

### Changes

- Kept deterministic card ordering and non-persistent slot numbers, but made the initially active
  connected device authoritative by recording its `component_id` in the URL with replace
  navigation.
- Prevented a newly connected device that sorts before the current card from taking over the active
  Device presentation.
- Preserved page-local empty-slot selection and the existing removed-device fallback behavior.

### Status

- Device card numbers may still change as the directory is deterministically re-sorted, but the
  device the user is viewing remains selected until it is removed or the user selects another card.

### Validation

- Scoped Prettier check passed for the owned TypeScript, E2E, design, and progress files, and
  `git diff --check` passed.
- Typecheck, lint, unit, build, and Playwright commands were not run because repository rules
  require explicit user instruction.

### Next goals

- Complete Vision LAN address and browser CORS integration for tablet Camera previews.

## 2026-08-08 - Live Device directory recovery

### Changes

- Added one Device-page refresh owner that coalesces relevant public Pilot lifecycle, endpoint-
  catalog, gap, and SSE error events into component/endpoint directory invalidation.
- Added a five-second fallback refresh for event loss, SSE capacity exhaustion, and Pilot restart.
- Changed removed or unknown selected-device URLs to clear the stale `device` query with replace
  navigation and activate the first empty slot instead of rendering an error card.
- Kept transient Pilot/provider failures user-facing as a stable recovering state without exposing
  raw transport error strings, while preserving the five empty placeholders when no directory
  snapshot is available.
- Qualified active Camera runtime by Pilot/session/catalog identity and tightened Vision 1.3.0
  endpoint selection to exact unique descriptor ids, service methods, and matching URL protocols.
- Added focused unit and browser fixtures for lifecycle/catalog invalidation, endpoint rejection,
  removed selection fallback, and disconnect-to-empty behavior without page reload.

### Status

- The reported stale Device cards and removed-device error presentation are corrected in source.
- Direct Camera health/metadata recovery remains read-only and re-queries Pilot when a provider
  failure may indicate a stale endpoint. Vision CORS/LAN product work remains outside this change.
- Existing unrelated design and progress edits remain preserved and uncommitted.

### Validation

- Scoped Prettier check passed for the owned TypeScript, CSS, E2E, design, and progress files, and
  `git diff --check` passed.
- Typecheck, lint, unit, build, and Playwright commands were not run because repository rules
  require explicit user instruction.

### Next goals

- Run the Portal validation suite when explicitly requested and exercise the live Vision stop/start
  flow against Pilot on the target LAN setup.

## 2026-08-08 - Task Jog parent-link frame eligibility

### Changes

- Updated the pinned Pilot OpenAPI contract to include each frame's `parent_link_id`.
- Limited Task Jog frame choices and the active task target to frames whose parent link id is greater
  than zero; root-attached frames are not displayed or selectable.

### Status

- Task Jog returns to the first eligible frame whenever the selected frame is not present in the
  latest authoritative status.

### Validation

- Not run (not requested).

### Next goals

- Confirm parent-link frame eligibility with an integrated Pilot status stream.

## 2026-08-08 - Pilot frame axes in the Jogging scene

### Changes

- Rendered each fresh public Pilot `RobotStatus.frames` pose as an X/Y/Z coordinate frame in the
  Jogging Three.js scene, inside the same scene-coordinate group as the robot model.
- Reused the existing `euler_type` rotation-matrix interpretation and excluded malformed frame
  values before they reach the renderer.

### Status

- Axis helpers update only from fresh authoritative status, matching the existing robot-pose hold
  behavior when status is stale or unavailable.

### Validation

- Not run (not requested).

### Next goals

- Add frame visibility selection only if multiple registered frames make the scene difficult to
  inspect in actual use.

## 2026-08-08 - Empty-directory route gate and resilient Dock preference

### Changes

- Made Home the only accessible product page when public RobotDirectory discovery succeeds with no
  entries. Robot-scoped sidebar links remain disabled and direct Device, Jogging, or Operating URLs
  redirect to Home.
- Kept existing pages stable while directory discovery is loading or failing instead of treating an
  unknown directory as a confirmed empty one.
- Made Robot Dock preference reads and writes tolerate unavailable browser storage while preserving
  the current Portal session's in-memory selection and Dock mode.
- Added focused storage-failure unit coverage and an empty-directory browser route fixture.

### Status

- The two requested review remediations are implemented without changing the user's in-progress
  operation-feedback removal or Home-card keyboard behavior.
- Existing unrelated worktree changes remain preserved and uncommitted.

### Validation

- Targeted Prettier check passed for the owned TypeScript, CSS, E2E, design, and progress files after
  applying the reported formatting correction.
- Targeted ESLint passed for the owned TypeScript and E2E files, and `git diff --check` passed.
- Full-repository format/lint, typecheck, unit, build, and Playwright commands were not run because
  repository rules require explicit user instruction.

### Next goals

- Run the Portal validation suite when explicitly requested, then commit the combined Dock follow-up
  only after reviewing the user's pre-existing feedback-removal changes together with these fixes.

## 2026-08-08 - Persistent Robot Dock D5 acceptance

### Changes

- Added public-contract browser fixtures for stale, offline, and removed selections. The Dock keeps
  those Control identities visible and never substitutes an arbitrary discovered robot.
- Verified black, light, and system theme resolution under reduced motion. The global reduced-motion
  foundation limits Dock transitions to its immediate 1 ms accessibility fallback.
- Captured populated desktop expanded/collapsed and phone collapsed/expanded Dock states with the
  full selector, command, and collapse affordance visible in the phone overlay.
- Corrected the reviewed visual layout: widened the bounded desktop Dock surface and uses a compact
  three-column command grid plus explicit selector/toggle grid placement on phone.
- Follow-up simplification: removed the Dock-local command-result display, including
  `written_unconfirmed`, and the redundant visible `Robot` selector label. The accessible selector
  label and operation runtime state remain intact.
- Dock expansion now finishes its horizontal width transition before rendering the expanded-only
  status and command controls, avoiding the transient square multi-row layout.
- Expanded Dock layout now keeps the status and robot selector together at the left, while Servo,
  Fault Reset, Brake, and the collapse control remain right-aligned.

### Status

- D5 is complete. D0-D5 now provide a persistent Control selector, route-preserving multi-robot
  handoff, one Dock-owned shared command surface, and fixture-proven theme/responsive/accessibility
  behavior without hardware motion.

### Validation

- Passed `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test` (16 files / 57
  tests), `npm run build`, and `npm run test:e2e` (12 Chromium tests).
- Playwright recorded the four reviewed visual captures under its ignored `test-results/` output.
- Production build: shell chunk 437.03 kB (138.10 kB gzip); lazy robot-scene chunk 977.95 kB
  (260.39 kB gzip). The pre-existing non-failing Vite warning remains limited to that lazy scene
  chunk; Home remains free of it.
- Existing `PilotStreamHub` unit coverage continues to prove one canonical Control stream and
  listener cleanup when the final subscriber leaves; the Dock only subscribes through that store.

### Next goals

- Future Camera, Policy, provider, and production-authority work remains outside this completed
  Persistent Robot Dock scope.

## 2026-08-08 - Persistent Robot Dock D4 switch isolation

### Changes

- Made a selected robot change cancel the prior Control's local hold and scheduler before its
  preference/route replacement. A held or pending Control keeps the selector disabled.
- Keyed Device and Operating workspaces by `control_id`, matching the existing keyed Jogging
  workspace so route changes replace page-local state rather than reusing it for another Control.
- Added browser coverage for route-kind-preserving Control changes and history return.

### Status

- D4 is complete. Submitted results remain in their original per-Control scheduler; a destination
  page/Dock uses only its own status, operation state, and keyed workspace.

### Validation

- Passed `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test` (16 files / 57
  tests), `npm run build`, and `npm run test:e2e` (9 Chromium tests).
- Vite retained its existing non-failing lazy robot-scene chunk-size warning.

### Next goals

- D5: complete fixture, accessibility, reduced-motion, theme, visual screenshot, and cleanup
  acceptance without hardware motion.

## 2026-08-08 - Persistent Robot Dock D3 shared commands

### Changes

- Moved Servo On/Off, Fault Reset, and Brake Release/Engage presentation from Jogging to the expanded
  Robot Dock. Joint/task jog, Home/Ready, speed, task frame, and session-recovery controls remain
  page-owned.
- Reused the existing app-scoped Portal operation runtime, selected-Control scheduler, lifecycle
  session, public request encoding, and authoritative RobotStatus. The Dock creates neither a
  session nor a queue and does not optimistically change Servo or Brake state.
- Added Dock-local factual operation feedback, including the explicit `written_unconfirmed`
  disposition, and kept collapsed mode free of all command controls.

### Status

- D3 is complete. There is one visible owner for the three shared lifecycle commands; Jogging now
  contains only its page-owned hold-to-run and recovery functions.

### Validation

- Passed `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test` (16 files / 57
  tests), and `npm run build`.
- Passed `npm run test:e2e` (8 Chromium tests) with public-contract fixtures. Unit coverage verifies
  all three command requests retain the passed selected `control_id` and factual operation feedback.
- Vite retained its existing non-failing lazy robot-scene chunk-size warning.

### Next goals

- D4: make selecting a destination Control an ordered cancellation/remount transition and cover
  direct URL, history, reload, unavailable selection, and per-Control isolation.

## 2026-08-08 - Persistent Robot Dock D2 floating shell

### Changes

- Added the shell-owned, fixed bottom-right Robot Dock with a theme-tokenized nearly opaque surface,
  safe-area inset, bounded right-anchored width, restrained shadow, and overlay stacking.
- Added the public RobotDirectory selector and concise selected-Control status. Unknown or removed
  route/preferred Controls remain visible as unavailable rather than being replaced automatically.
- Added persisted expanded/collapsed behavior: desktop defaults to expanded, phone defaults to
  selector-only collapsed mode, and an explicit mode choice wins over responsive defaults.
- Kept the Dock outside the shell grid and route outlet; no content spacer, bottom padding, or
  content-size calculation depends on Dock mode.

### Status

- D2 is complete. The expanded surface intentionally contains status and selection only; Servo,
  Fault Reset, and Brake remain in Jogging until their D3 relocation is covered.

### Validation

- Passed `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test` (15 files / 56
  tests), and `npm run build`.
- Passed `npm run test:e2e` (8 Chromium tests) with public-contract fixtures, including right-side
  expansion/collapse without a main-content bounding-box change and the phone collapsed default.
- Vite retained its existing non-failing lazy robot-scene chunk-size warning.

### Next goals

- D3: relocate shared Servo, Fault Reset, and Brake controls into the Dock using the existing
  app-scoped operation runtime and selected-Control RobotStatus.

## 2026-08-08 - Persistent Robot Dock D1 selection state

### Changes

- Added versioned local presentation state for the preferred Control and optional Dock mode. The
  state stores no RobotStatus, session, command, model, or authority data.
- Added pure effective-Control and route-page helpers. A direct robot URL remains authoritative;
  global pages use only the last explicit Home-card preference.
- Made Home card space select a Control without leaving Home, retained `Open Jogging` as an exact
  Control link, and updated sidebar Device/Jogging/Operating targets to use the effective Control.

### Status

- D1 is complete. It intentionally adds neither a Dock surface nor shared command controls; those
  remain D2 and D3 work.

### Validation

- Passed `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test` (15 files / 56
  tests), and `npm run build`.
- Passed `npm run test:e2e` (6 Chromium tests) using public-contract fixtures, including Home
  selection that remains on `/home` while the Device sidebar link targets the selected Control.
- Vite retained its existing non-failing lazy robot-scene chunk-size warning.

### Next goals

- D2: add the fixed bottom-right Dock overlay, responsive expanded/collapsed presentation, and
  no-reflow visual acceptance.

## 2026-08-08 - Portal validation remediation

### Changes

- Restored baseline Portal validation before starting D1: made the mount root non-null after its
  explicit guard, made operation-test assertions portable without undeclared matcher extensions, and
  narrowed motion-target test access to motion operation variants.
- Formatted the pre-existing Device and Operating pages.

### Status

- D0 documentation remains runtime-free. The Portal baseline now passes the required D-checkpoint
  validation commands, so later Dock checkpoints can use a green baseline.

### Validation

- Passed `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test` (13 files / 51
  tests), and `npm run build`.
- Passed `npm run test:e2e` (5 Chromium tests) against local public-contract fixtures. Vite retained
  its existing non-failing lazy robot-scene chunk-size warning.

### Next goals

- D1: add the versioned preferred-Control and Dock-mode store, route helpers, and Home/sidebar
  selection behavior.

## 2026-08-08 - Persistent Robot Dock design

### Changes

- Added `docs/designs/src_shell_robot_dock_design.md` for a shell-owned, bottom-right floating Robot
  Dock that preserves robot selection across Portal pages.
- Defined a nearly opaque black/light surface, no reserved page padding or grid row, a fixed right
  edge, leftward expansion, and a collapsed selector-only presentation.
- Defined route-authoritative selection with a saved presentation preference, Home card selection,
  and page-kind-preserving Device/Jogging/Operating robot changes.
- Moved shared Servo On/Off, Fault Reset, and Brake Release/Engage presentation ownership to the
  Dock while retaining jog, Home/Ready, reset-origin, task-frame, and speed controls on their pages.
- Defined ordered switch isolation for holds, pending targets, submitted results, RobotStatus,
  model/profile, real-time values, recovery, accessibility, and D0-D5 implementation checkpoints.
- Reconciled the navigation, migration, and detailed frontend designs with the focused Dock design.
- Added the focused design to `docs/rules.md` as required reading before Robot Dock or shared command
  ownership changes.

### Status

- The requested Robot Dock behavior is design-complete. No runtime source, dependency, Pilot
  contract, provider integration, or hardware behavior changed.
- Robot-scoped URLs remain authoritative; the saved selection is only a convenience for Home and
  other global pages and cannot override a direct URL.

### Validation

- Documentation was reviewed for ownership, route, command, and state-isolation consistency.
- Automated build and tests were not run because this was a documentation-only task and the user
  did not request execution.

### Next goals

- Implement D1 selection/route helpers, then D2 floating expanded/collapsed presentation.
- Relocate shared commands only at D3 after the Dock selection and visual surface are accepted.
- Complete D4-D5 switch isolation and browser/accessibility acceptance without physical motion.

## 2026-08-08 - Device robot-scoped navigation page

### Changes

- Added the read-only `/robots/:control_id/device` route and placed the `Device` navigation item
  immediately above `Jogging` in the Robot section.
- Added a Device page that shows the selected Control's public RobotStatus connection, robot type,
  DOF, servo, brake, and freshness fields without issuing robot operations.

### Status

- Device navigation remains route-scoped: without an explicit Control it returns to Home instead of
  selecting a robot implicitly. The existing Operating and Jogging worktree changes remain intact.

### Validation

- Automated checks were not run because this task did not explicitly request test or build execution.

### Next goals

- Add device-specific details only when Pilot publishes them through a public contract.

## 2026-08-07 - Operating robot-scoped page

### Changes

- Added the robot-scoped `/robots/:control_id/operating` route and an `Operating` navigation item
  directly below `Jogging`.
- Added an Operating workspace that reuses the existing Pilot-only hold-to-run controls for the
  route Control while preserving Jogging's visualization workspace.

### Status

- The Operating page is available only for an explicit route Control; without one, shell navigation
  continues to lead to Home rather than choosing a Control implicitly.

### Validation

- Automated checks were not run because this task did not explicitly request test or build
  execution.

### Next goals

- Add operating-specific presentation only when an approved ownership or operation-history contract
  exists.

## 2026-08-07 - Detailed frontend architecture and phased implementation design

### Changes

- Added `docs/designs/src_nodus_portal_frontend_detailed_architecture_and_phased_implementation_design.md`
  as the implementation-level companion to the migration and navigation designs.
- Selected a standalone React 19, Vite 8, TypeScript 6, React Router Data Mode, TanStack Query,
  generated OpenAPI types, external SSE store, CSS Modules/token, and public black-box test
  architecture, with exact patched versions deferred to their dependency checkpoint.
- Defined a black-default visual system inspired by the Sphere UI Charts UIKIT layout language,
  including black/light/system theme persistence, pre-paint resolution, semantic tokens, responsive
  shell/card composition, accessibility, and reduced-motion behavior.
- Mapped the current `pa_control/apps/web_ui` modules into retain/rewrite/exclude destinations and
  kept PA-CPU clients, PilotBridge, sibling asset paths, and monolithic application orchestration
  outside Portal.
- Defined F0 through F11 checkpoints from baseline capture through deployment acceptance, including
  per-step work, validation, exit conditions, dependency ordering, and stop boundaries.
- Linked the detailed design from both upstream designs and the persistent project rules.

### Status

- The detailed frontend architecture and implementation sequence are documented and ready for user
  review.
- Black is the explicit default theme; light and system preferences are designed as first-class
  alternatives rather than later stylesheet patches.
- No frontend source, dependency, generated contract, asset, configuration, or build tooling was
  added, and PA-CONTROL remained read-only.

### Next goals

- Review and approve the detailed design together with the migration and navigation designs.
- After explicit implementation approval, complete F0 contract/version provenance and begin only
  the F1 standalone frontend foundation.
- Resolve exact patched dependency versions at F1 and the final self-hosted font choice at F2.

## 2026-08-07 - Left navigation and multi-robot Home design

### Changes

- Added `docs/designs/src_nodus_portal_navigation_and_multi_robot_home_design.md` with the
  persistent left panel, route-first shell, responsive navigation, and initial URL contract.
- Defined `/home` as the default multi-robot overview and moved the existing single-page operation
  workspace to `/robots/:control_id/jogging`.
- Defined concise robot cards using public Control/RobotStatus evidence and an explicit
  `Open Jogging` action keyed by `control_id`.
- Isolated current robot discovery behind a `RobotDirectory` adapter derived from public
  RobotStatus stream descriptors so a future explicit Pilot Control catalog can replace only the
  adapter.
- Defined bounded multiplexed Home status consumption, selected-robot detailed status, per-Control
  state isolation, and page-exit cleanup for hold and Camera resources.
- Linked the focused design from the migration design and project rules.

### Status

- Navigation checkpoint N0 is documented and ready for user review.
- The layout supports one or many independently targeted robots without claiming synchronized
  multi-Control operation.
- No frontend source, dependency, router, asset, build tooling, Pilot runtime, or PA-CONTROL file was
  changed.

### Next goals

- Approve the focused navigation design together with the main migration design.
- Begin N1 by selecting the frontend router and implementing only the deterministic shell/routes.
- Add the public-contract RobotDirectory and Home cards in N2 before decomposing the current UI into
  Jogging in N3.

## 2026-08-07 - Portal migration and continuous hold-to-run design

### Changes

- Added `docs/designs/src_nodus_portal_apps_web_ui_migration_design.md` with the exact
  `pa_control/apps/web_ui` source inventory, PA-CPU coupling, target ownership, feature disposition,
  Pilot API mapping, provider boundaries, checkpoints, and validation plan.
- Recorded the accepted private home research/development policy: Phase B remains deferred without
  using that decision to remove or gate approved Portal command features.
- Preserved joint jog, task jog, Home, and Ready as continuous hold-to-run controls and replaced the
  proposed discrete-only behavior with a status-reconciled projected-target design.
- Specified that every hold calculation reads the newest authoritative status, reconciles it with a
  speed-scaled elapsed-time projection, keeps one in-flight request, and coalesces to the newest
  target so delayed status cannot collapse continuous movement to repeated identical deltas.
- Added the matching persistent project rules so later agents do not reopen these accepted decisions
  during ordinary Portal work.

### Status

- Checkpoint 0 design and inventory are complete and ready for user review.
- No Portal source, dependency, asset, configuration, or build tooling was migrated.
- No PA-CONTROL source, Pilot runtime contract, sibling component, or submodule was modified.

### Next goals

- Approve the migration design and begin Checkpoint 1 as a separately requested task.
- Select the standalone frontend package/build/test layout and Portal-owned robot asset placement.
- Implement Pilot observer integration before binding Camera and controller features.

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

## 2026-08-07 - F0 frontend baseline capture

### Changes

- Recorded the implementation approval, Portal/PA-CONTROL/Pilot revisions, public Pilot OpenAPI
  version and SHA-256 provenance, and retained legacy behavior notes in `docs/f0_baseline_capture.md`.
- Verified Node.js 24 LTS, React 19.2, and Vite 8.1 support status from their official sources.

### Status

- F0 is complete: the public Pilot contract has stable provenance and no Portal runtime,
  dependency, build, configuration, or asset file changed.
- The local host Node.js 18.19.1 is EOL; F1 validation needs a Node.js 24 runtime.

### Validation

- Ran `./setup_dev.sh` successfully.
- Verified the three repository revisions and read/digested Pilot's public v1 OpenAPI artifact.

### Next goals

- F1: create the standalone React/Vite foundation with exact supported patches locked by npm.

## 2026-08-07 - F1 standalone frontend foundation

### Changes

- Added the independent static React/Vite/TypeScript Portal package with Node.js 24.19.0 and npm
  11.17.0 engine requirements; all direct dependencies are exact versions and `package-lock.json`
  is committed by the checkpoint.
- Added strict TypeScript, ESLint flat configuration, Prettier, Vitest, a minimal neutral bootstrap
  surface, and CI-ready typecheck/lint/format/test/build scripts.
- Added validated public runtime configuration with a same-origin default and an optional explicit
  development proxy target. No sibling path, default port, PA-CPU client, or Control transport is
  present.
- Added static-host route-fallback deployment guidance.

### Status

- F1 is complete. The build is a standalone neutral bootstrap only; routes, theme primitives, and
  Pilot resource integration begin in later checkpoints.

### Validation

- Ran clean `npm ci` with Node.js 24.19.0/npm 11.17.0.
- Passed `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, and `npm run build`.
- Confirmed the production `dist/` and source have no PA-CPU, PilotBridge, sibling-repository,
  Control IPC, or UDS reference.

### Next goals

- F2: add the pre-paint black/light/system theme and visual/component foundations.

## 2026-08-07 - F2 theme and component foundations

### Changes

- Added a pre-paint `nodus_portal.theme.v1` bootstrap plus persistent black, light, and system
  theme preferences. Black remains the default; system changes are observed after startup.
- Added primitive/semantic tokens, accessible focus and reduced-motion foundations, 44 px buttons,
  cards, status badges, skeleton/error states, Tooltip, Dialog-based Drawer, and a Radix menu-based
  theme control.
- Added Storybook 10.4.6 with black/light canvas controls and representative foundation states.

### Status

- F2 is complete. No robot model, route, Pilot resource, or command behavior is introduced.

### Validation

- Passed `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, and `npm run build`.
- Passed `npm run build-storybook`; Storybook emitted a non-failing generic size warning and could
  not write its optional user-home telemetry settings file in the restricted environment.

### Next goals

- F3: add the lazy route tree, persistent shell, deterministic navigation, and browser route tests.

## 2026-08-07 - F3 route shell and navigation

### Changes

- Added the route-first shell with `/` to `/home` redirect, `/home`,
  `/robots/:control_id/jogging`, and a not-found route.
- Added persistent desktop navigation, responsive Drawer navigation, selected Control route context,
  and route-owned placeholder surfaces without any Pilot or robot runtime coupling.
- Added Playwright Chromium route, direct-link, active-navigation, not-found, and mobile drawer tests.

### Status

- F3 is complete. Three.js is absent from the Home/shell build; F4 will introduce finite Pilot
  HTTP contracts only.

### Validation

- Passed `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
- Passed `npm run test:e2e` (3 Chromium tests). This required unsandboxed local server binding;
  the sandbox itself returned `EPERM` for `127.0.0.1:4173`.

### Next goals

- F4: pin the released Pilot OpenAPI artifact and implement the typed finite HTTP client.

## 2026-08-07 - F4 Pilot contract and finite HTTP client

### Changes

- Pinned Pilot public v1 OpenAPI 1.0.0 with revision/digest provenance and committed generated HTTP
  types; Portal generation reads only the local pinned artifact.
- Added normalized finite HTTP client errors, public resource query keys, and TanStack Query hooks
  for health, snapshot, components, endpoints, and explicit Control status.
- Kept mutation transport out of generic query retry behavior.

### Status

- F4 is complete. `openapi-typescript` 7.13.0 has a TypeScript 5 peer range and generated a TS 6
  recursive diagnostic error, so the committed generated-only file receives reproducible
  `@ts-nocheck`; handwritten Portal code remains strict-checked.

### Validation

- Regenerated the types without a diff and passed typecheck, lint, format, unit tests, and build.
- `npm audit --omit=dev` could not contact the npm advisory endpoint in the sandbox (`EAI_AGAIN`);
  a prior npm install audit reported two high-severity dependency findings, pending later triage.

### Next goals

- F5: implement per-Control RobotStatus streaming, ordering guards, and recovery.

## 2026-08-07 - F5 Pilot stream hub and recovery

### Changes

- Added a per-Control `PilotStreamHub` external store consumed through `useSyncExternalStore`.
- Validated public RobotStatus SSE payloads, ignored duplicate/out-of-order samples, isolated
  Control identities, detected sequence gaps, and accepted new connection generations.
- Added public latest-status reseeding after gaps/SSE failures and closes a canonical EventSource
  when its final subscriber leaves.

### Status

- F5 is complete. The hub stores latest state only and does not infer ordering across Controls or
  place high-frequency RobotStatus data in React Context.

### Validation

- Passed typecheck, lint, unit tests (4 files / 12 tests), and production build.

### Next goals

- F6: derive the public RobotDirectory and Home card grid from advertised RobotStatus streams.

## 2026-08-07 - F6/F7 contract and asset blockers

### Evidence

- The pinned public OpenAPI declares `GET /api/v1/pilot/streams` as an unconstrained JSON object.
  Although `SampleStreamDescriptor` exists in components, the response does not reference a
  collection schema or define a descriptor field/cursor/catalog identity.
- The read-only eRob asset manifest in PA-CONTROL records the upstream package license as `TODO:
  License declaration`.

### Result

- F6 cannot implement a RobotDirectory without inventing a `streams` collection payload or reading
  Pilot internals. The exact evidence is recorded in `docs/f6_public_contract_blocker.md`.
- F7 cannot copy an independently distributable URDF/STL bundle without verified redistribution
  provenance. The temporary untracked asset copy was removed; evidence is in
  `docs/f7_asset_provenance_blocker.md`.
- F8 cannot start because its dependency requires a proven selected-robot status/visualization path.

### Required decisions

- Release a Pilot OpenAPI revision that specifies the `/api/v1/pilot/streams` response collection.
- Supply a redistribution license/provenance decision for the eRob assets, or an approved
  Portal-owned robot profile/asset contract.

## 2026-08-07 - F7 Jogging visualization and F6 Home resumption

### Changes

- F7 now lazy-loads the React 19 / Three.js / R3F / Drei / URDF Loader graph only after an explicit
  Portal presentation-profile selection on a Jogging route. It reads the selected Control's latest
  public RobotStatus through the existing external store, holds the model for stale or malformed
  status, and releases model geometry/material resources on route exit.
- Copied the user-approved eRob URDF and STL assets into `public/robots/e_rob/`. The Portal source
  manifest preserves the upstream `TODO: License declaration` state, private non-public R&D scope,
  and the absence of any redistribution-right claim. PA-CONTROL stayed read-only.
- F5 follow-up fixed the referential stability of the initial `useSyncExternalStore` snapshot. It
  was discovered by real Chromium rendering and prevents an initial status-less Control from
  entering a React update loop.
- The newly supplied Pilot OpenAPI 1.0.1 revision `fc6aa0511e92ff4722fa51c439609bde8391d970`
  pins `SampleStreamsResponse` for `GET /api/v1/pilot/streams` and its public filters. F6 derives a
  bounded, stable RobotDirectory only from its RobotStatus descriptors, with per-Control status
  cards, localized stale/unavailable states, and exact Control-scoped Jogging links.
- The browser HTTP client now preserves Window `fetch` binding and uses a portable
  `AbortController` timeout; this F4 follow-up was required for public Home discovery in Chromium.

### Status

- F6 and F7 are complete. The Home overview intentionally caps direct status subscriptions at 24
  explicitly discovered Controls; it shows the omitted count rather than claiming unsupported fleet
  capacity. It does not infer robot model names or a Control catalog.
- F8 may begin only after this selected-status route is proven; it must retain the approved
  public-operation and continuous hold-to-run constraints.

### Validation

- Passed `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test` (7 files / 18
  tests), and `npm run build` using Node.js 24.19.0/npm 11.17.0.
- Passed `npm run test:e2e` (5 Chromium tests): public multi-robot descriptor fixture ordering and
  exact links, direct Jogging route, explicit eRob profile with URDF plus all seven STL HTTP 200
  responses, Home without canvas, and responsive navigation.
- Production Vite preview returned HTTP 200 for the copied URDF and STL paths. Build output keeps
  Home separate from the `robot_scene` Three/URDF chunk.

### Next goals

- F8: add typed public Pilot operations and continuous hold-to-run only after reviewing the pinned
  1.0.1 operation contract.

## 2026-08-07 - F8 public operation contract resolution

### Changes

- Replaced the broad F8 blocker with the exact resolved boundary from Pilot OpenAPI 1.0.2 revision
  `46d35dea702e71ae78aa2bb932a11e1bf5e79a73`.
- Pinned the exact 1.0.2 OpenAPI bytes and SHA-256 provenance and regenerated the committed
  TypeScript contract from the local artifact.
- Recorded that Portal owns a generic `component_type: ui` session, a separate operation cursor,
  and conservative same-host browser clock mapping from registration `server_time`.
- Kept cross-host browser mutation explicitly deferred without using it as a blocker for the
  approved same-host research profile.

### Status

- The F8 public operation boundary is resolved and F8 may resume.
- F9-F11 remain pending their normal checkpoint order rather than an unresolved operation-contract
  blocker.

### Validation

- Regenerated the committed TypeScript contract with Node.js 24.19.0 and
  `openapi-typescript` 7.13.0.
- Passed `npm run format:check`, `npm run typecheck`, `npm run lint`, and `git diff --check`.
- Confirmed the pinned OpenAPI is byte-identical to Pilot revision
  `46d35dea702e71ae78aa2bb932a11e1bf5e79a73` and matches the recorded SHA-256.
- Unit, browser, and production build commands were not run because this task did not explicitly
  request test/build execution.

### Next goals

- Implement the app-scoped Portal component session, lifecycle heartbeat, operation cursor,
  conservative same-host timestamp mapping, typed operation client, and continuous hold-to-run.

## 2026-08-07 - F8 Pilot operations and continuous hold-to-run

### Changes

- Added one app-scoped generic `component_type: ui` Portal session using only the pinned public
  registration, lifecycle, and operation routes. Its opaque session ID remains internal; lifecycle
  sequencing is serialized and independent from the session-wide operation cursor.
- Added conservative same-host `performance.now()` to Pilot `server_time` mapping for operation
  timestamps. Visibility loss, reconnect, lease/lifecycle failure, clock discontinuity, session
  loss, and Pilot instance replacement discard the anchor, clear holds/pending work, and register a
  new session without replaying an earlier mutation.
- Added generated-union operation requests and truthful presentation for 200, 202, 409, 404, and
  503 results. A written-unconfirmed delivery is not presented as Control acceptance or execution.
- Added separate RobotStatus adapter, target projector, HoldSession, scheduler, operation client,
  and Jogging controls. Joint/task/Home/Ready remain hold-to-run; every tick reads the current
  external-store status directly, reconciles delayed status, and uses one in-flight plus one newest
  pending target per selected Control.
- Bound pointer/keyboard release, pointer cancellation/lost capture, blur, visibility loss, route
  cleanup, stale/malformed status, Control generation change, session invalidation, and terminal
  operation failure to local hold/pending cleanup. Portal does not invent a Control stop or cancel
  acknowledgement.

### Status

- F8 is complete for the approved same-host private research profile. It uses no Pilot internals,
  Control IPC/UDS, or mutation replay. F9-F11 have not started.

### Validation

- Passed Node.js 24.19.0/npm 11.17.0 `npm run format:check`, `npm run typecheck`, `npm run lint`,
  `npm test` (12 files / 35 tests), `npm run build`, and `npm run test:e2e` (5 Chromium tests).
- Deterministic fakes cover lifecycle/operation cursor separation, clock mapping and invalidation,
  recovery without replay, bounded newest-target coalescing, delayed status reconciliation,
  release/stale/generation/terminal cleanup, joint/task/Home/Ready progression, and typed result
  presentation.
- Ran `npm run generate:pilot-contract`; the pre-existing 1.0.2 contract/provenance/generated diff
  was unchanged. Confirmed the pinned OpenAPI SHA-256
  `4c536a3b099a478f6af5420af63b5a32965913f8fc5943c655a55e8d2a3ed5a8` and byte identity with Pilot
  revision `46d35dea702e71ae78aa2bb932a11e1bf5e79a73`.
- Vite emitted its non-failing >500 kB warning for the existing lazy Three/URDF scene chunk; Home
  remains separate from that chunk.

### Next goals

- F9: begin direct Camera-provider integration only when its approved public provider contract is
  available; do not relay Camera payloads through Pilot.

## 2026-08-07 - F9 Camera provider contract blocker

### Evidence

- Pinned Pilot OpenAPI 1.0.2 supplies generic endpoint-directory descriptors only. It has no
  released Camera capability vocabulary, payload schema, preview/ROI request contract, frame
  metadata/header contract, point-cloud binary layout, or provider lifecycle/recovery contract.
- No separate released Camera provider OpenAPI/schema artifact exists in the Portal workspace.
  Pilot design and fixture material remains non-contract reference material and is not a Portal
  wire dependency.

### Result

- F9 cannot safely implement direct Camera preview, depth, ROI, or point-cloud behavior without
  inventing the provider API. The exact required artifact is documented in
  `docs/f9_public_camera_contract_blocker.md`.
- No Portal Camera source, no Pilot/PA-CONTROL/nodus-operator source, and no provider payload relay
  was added. F10 and F11 do not start before their dependency/order conditions are met.

### Next goals

- Publish and pin a versioned Camera provider contract with descriptor selection, payload/frame,
  lifecycle/recovery, CORS/auth, and immutable provenance requirements; then resume F9.

## 2026-08-07 - F8 hold-control surface follow-up

### Changes

- Reworked the Jogging operation card into a compact Joint/Task workspace after read-only analysis
  of PA-CONTROL's jog hierarchy. Portal retains its own components and styles: it does not copy the
  monolithic application, PA-CPU coupling, or legacy timer-based command implementation.
- Joint mode presents Home/Ready hold controls, per-joint negative/positive holds, and the latest
  authoritative position, velocity, torque, and acceleration values. Task mode presents the
  authoritative frame selector, selected-frame pose, and translational/rotational hold axes.
- Added an explicit fresh-status/session state and session retry action so unavailable motion is
  stated rather than appearing as an inert control. The presentation data never becomes the command
  baseline; HoldSession still reads the current external-store status at every tick.
- Retained global keyboard-release cleanup and added component assertions for joint telemetry,
  selected-frame pose, complete axis exposure, selected frame/speed propagation, and release
  cancellation.
- Repositioned Jogging into a desktop two-column workspace: visualization at left, Jog controls at
  right, and fresh authoritative joint values directly beneath the visualization. Removed duplicate
  status cards and static instructional copy from the operation surface.
- Aligned the Portal-owned eRob scene with the read-only reference's URDF coordinate convention and
  framing: it excludes collision geometry, rotates the URDF visual root into the scene convention,
  and uses matching camera target/bounds. The Portal keeps its own lazy scene implementation and
  asset paths.
- Reduced the Jogging typography and set the desktop operation panel to approximately two-thirds of
  its former width after visual review, while preserving a compact responsive control layout.

### Validation

- Passed Node.js 24.19.0/npm 11.17.0 `npm run format:check`, `npm run typecheck`, `npm run lint`,
  `npm test` (13 files / 37 tests), `npm run build`, and `npm run test:e2e` (5 Chromium tests).
  Vite retained its existing non-failing >500 kB warning for the lazy Three/URDF scene chunk.
- The first sandboxed Playwright attempt could not bind `127.0.0.1:4173` (`EPERM`); the same local
  Chromium suite passed when run with the required local-server permission.
- Chromium additionally verifies that the visualization and operation panels are side by side and
  the values card follows the visualization on the Jogging route.
- Captured the selected eRob profile in local Chromium to inspect the assembled link chain after the
  coordinate/framing correction; the existing route test still confirms all seven Portal-owned STL
  files load successfully.

### Next goals

- F9 remains blocked on the released, versioned Camera provider contract recorded above; do not
  infer a provider payload contract from PA-CONTROL or Pilot internals.

## 2026-08-07 - F8 review remediation

### Changes

- Changed task jogging from the six-value Euler snapshot previously sent by Portal to the Control
  contract's seven-value `[x, y, z, axis_x, axis_y, axis_z, angle]` target. Authoritative frame
  Euler values are converted to a rotation matrix, world-axis hold increments are reconciled with
  the latest frame rotation, and each operation is encoded as axis-angle.
- Repaired operation cancellation so releasing a hold while one request is in flight no longer
  leaves the per-Control scheduler permanently busy. A replacement hold waits for that request to
  settle and then submits only its newest pending target; a cancelled request's late terminal
  result cannot terminate the replacement hold.
- Changed RobotStatus disconnect/reconnect behavior to mark retained snapshots non-live, reseed
  every new subscription through the public latest-status route, and discard late recovery
  responses after a newer SSE sample. Expanded the runtime guard through the nested joint state,
  interface, and frame fields used by rendering and motion.
- Wired validated `portal_config.json` into application startup, default Pilot HTTP clients,
  RobotStatus EventSource URLs, and the configured Portal label. Added the same finite abort timeout
  to Pilot POST requests that already applied to GET requests.
- Added focused regression coverage for seven-value task targets, scheduler restart after release,
  subscription reseeding/recovery races, malformed nested RobotStatus, and runtime Pilot URL
  publication.
- Stabilized the `useSyncExternalStore` subscribe and snapshot callbacks by Control ID and register
  the listener before opening the stream. This prevents disconnect-state publication from causing
  a render/unsubscribe/reconnect loop under React StrictMode.
- Corrected latest-only RobotStatus SSE ordering: within one Control connection generation, any
  strictly increasing `sample_sequence` is accepted while duplicates and regressions are ignored.
  Portal no longer treats the intentional sampling gap between Pilot's 500 Hz monitor and 60 Hz UI
  stream as data loss or repeatedly enters recovery for normal traffic.

### Status

- All six findings from the local Portal review are addressed in the working tree. Joint, task,
  Home, and Ready remain continuous hold-to-run controls and still read the latest accepted status
  directly from the external store.
- Existing unrelated contract, generated type, rules, design, and blocker-document changes were
  preserved.

### Validation

- Targeted Prettier check passed for every changed TypeScript/TSX file.
- Targeted ESLint passed for every changed TypeScript/TSX file.
- `git diff --check` passed.
- Build and test commands were not run because the shared repository rule requires an explicit user
  request before executing them.

### Next goals

- When validation execution is explicitly requested, run typecheck, lint, unit tests, production
  build, and the Chromium route suite before committing this remediation.
- F9 remains blocked on its released Camera provider contract.

## 2026-08-07 - Jogging robot command controls

### Changes

- Added state-aware Servo On/Off, Fault Reset, and Brake Release/Engage buttons to the Jogging
  operation card.
- Extended the typed Pilot operation client for `control.set_servo_state`, `control.reset_fault`,
  and `control.set_brake_state` without introducing direct Control IPC.
- Robot command actions cancel an active local hold and reuse the selected Control's serialized
  operation scheduler. Button state remains derived from authoritative RobotStatus rather than
  being changed optimistically.
- Added focused request-encoding and Jogging command-binding tests.

### Status

- Jogging now exposes the three requested robot lifecycle commands through the public Pilot
  operation contract. Submitted commands continue to report the contract's factual delivery
  outcome until a later RobotStatus reflects the Control state.

### Validation

- Build, lint, typecheck, and test commands were not run because repository rules require explicit
  user instruction before executing them.

### Next goals

- Run the Portal validation suite when explicitly requested, then verify the buttons against the
  demo adapter and actual eRob RobotStatus semantics.

## 2026-08-07 - Synchronized Home and Ready projection

### Changes

- Replaced independent per-axis Home/Ready stepping with the legacy PA-CONTROL joint-space path
  normalization: every axis advances by the same fraction of its remaining path so all moving axes
  reach the goal together.
- Updated the approved migration design with the synchronized joint-space path contract.
- Preserved Portal's delayed-status reconciliation by retaining a projected baseline unless the
  newest authoritative RobotStatus is measurably closer to the goal.
- Expanded the Home/Ready button group to fill the complete row with equal-width controls.
- Added focused projector coverage for proportional multi-axis progress.

### Status

- Home and Ready remain continuous hold-to-run operations while producing synchronized multi-axis
  targets without reverting to stale-status fixed deltas.

### Validation

- Build, lint, typecheck, and test commands were not run because repository rules require explicit
  user instruction before executing them.

### Next goals

- Run the Portal validation suite when explicitly requested and compare synchronized Home/Ready
  behavior against the demo adapter before physical eRob operation.

## 2026-08-07 - Stable Jogging recovery feedback

### Changes

- Removed the conditional recovery block that was inserted above the Jog mode controls and caused
  the operation card to resize during stream/session recovery.
- Consolidated command disposition, including `written_unconfirmed`, and recovery reason into one
  always-present fixed-height status panel with an in-panel Retry action.
- Added component coverage proving operation and recovery messages are presented together.
- Updated the detailed frontend design with the fixed-height feedback-panel contract.

### Status

- Recovery transitions no longer add or remove a separate layout block around the Jog controls;
  long feedback remains contained inside the status panel.

### Validation

- Build, lint, typecheck, and test commands were not run because repository rules require explicit
  user instruction before executing them.

### Next goals

- Run the Portal validation suite when explicitly requested and visually confirm stable Jogging
  dimensions during forced Pilot/RobotStatus recovery.

## 2026-08-07 - Stable hold-lifetime interaction lock

### Changes

- Changed conflicting-control locking from per-operation pending transitions to the lifetime of the
  active hold intent.
- Kept the originating hold button enabled so pointer capture and release events remain reliable,
  while disabling every other hold button, robot command, Jog mode tab, speed input, and task-frame
  selector until release or cancellation.
- Added component coverage for the locked-during-hold and unlocked-after-release states.
- Updated the detailed frontend design with the hold-lifetime interaction-lock contract.

### Status

- A continuous hold now presents one stable disabled state for conflicting controls instead of
  flickering as individual operation requests enter and leave the scheduler.

### Validation

- Build, lint, typecheck, and test commands were not run because repository rules require explicit
  user instruction before executing them.

### Next goals

- Run the Portal validation suite when explicitly requested and visually verify pointer, touch, and
  keyboard release behavior during continuous Jog, Home, and Ready holds.

## 2026-08-07 - Stable component-session lease renewal

### Changes

- Separated the operation timestamp anchor from the component-session lease-renewal timestamp.
- Renewed the local lease only after a successful state or heartbeat response, using the
  conservative lifecycle request time as the renewal boundary.
- Added regression coverage that advances through multiple lease windows while verifying that
  successful heartbeats keep a single Portal registration alive.

### Status

- Portal no longer replaces its still-live Pilot component session every lease timeout while
  heartbeats are succeeding; operation source timestamps retain their original registration
  response anchor.

### Validation

- Build, lint, typecheck, and test commands were not run because repository rules require explicit
  user instruction before executing them.

### Next goals

- Run the Portal validation suite when explicitly requested, then confirm that Pilot logs one
  Portal registration followed by heartbeats without periodic `component.replaced` events.

## 2026-08-08 - LAN HTTP instance identity fallback

### Changes

- Kept `crypto.randomUUID()` as the preferred Portal component instance-ID generator.
- Added an RFC 4122 version 4 fallback based on `crypto.getRandomValues()` for browsers where
  `randomUUID()` is unavailable, including private-LAN HTTP origins that are not secure contexts.
- Added deterministic regression coverage for the fallback UUID version and variant bits.

### Status

- Portal application initialization no longer depends on the secure-context-only
  `crypto.randomUUID()` API; HTTPS and localhost retain the native path.
- Prettier and a live LAN-HTTP Chromium render check passed with no page or request errors; build,
  lint, typecheck, and test commands were not run because they were not explicitly requested.

### Next goals

- Confirm the Portal shell renders from a tablet over the current private-LAN HTTP development
  origin.
- Keep cross-host mutating-operation clock-domain support as a separate Pilot contract decision.

## 2026-08-08 - Browser-profile Portal component identity

### Changes

- Replaced the shared `nodus-portal` registration identity with a random browser-profile component
  ID persisted under a versioned `localStorage` key.
- Kept page-runtime `instance_id` generation independent so a reload replaces only the stale
  runtime from the same browser profile instead of replacing Portal sessions on other devices.
- Added a runtime-random fallback when browser storage is unavailable and deterministic coverage
  proving one browser profile reuses its component ID.
- Documented that per-browser lifecycle isolation does not provide or claim command authority.

### Status

- Multiple devices can maintain independent Pilot lifecycle sessions and monitor the same
  Pilot-owned RobotStatus source without cross-device component replacement loops.
- Prettier, whitespace checks, and live multi-client validation passed: two LAN browser profiles
  retained distinct component IDs, stable session generations, advancing heartbeats, and `ready`
  state. Build, lint, typecheck, and test commands were not explicitly requested and were not run.

### Next goals

- Confirm the same isolation after a future production static-host deployment.
- Add command authority separately when its Pilot contract is approved.

## 2026-08-08 - Interim Camera and Device integration baseline

### Changes

- Recorded the verified Vision-Pilot-Portal ownership and data-flow boundary for future Device-page
  Camera work.
- Cataloged the current Vision 1.3.0 health, metadata, preview, query, point-cloud, and optional
  recording endpoints without treating them as implemented Portal features.
- Captured the remaining LAN advertised-address, browser CORS, Camera-to-Control association,
  Portal contract-pinning, and settings-mutation decisions.
- Split the future Device-page design into incremental decisions so unresolved behavior is not
  guessed during implementation.

### Status

- The integration baseline is documented as an interim design only; no Portal, Pilot, or Vision
  runtime source was changed.
- Fake-provider investigation has shown that Vision can register a Camera endpoint catalog with
  Pilot and serve payloads directly, while the Portal Device page remains Control-status-only.

### Validation

- Reviewed the new documentation diff and whitespace only.
- Build, lint, typecheck, and test commands were not run because this change is documentation-only
  and repository rules require explicit user instruction before running them.

### Next goals

- Design the Device page information architecture and Camera placement first.
- Decide Camera-to-Control association and global Camera behavior before defining directory
  filtering or selection.
- Pin the approved Vision provider contract and design LAN/CORS support only after the Device-page
  design is accepted.

## 2026-08-08 - Global Device card-deck design

### Changes

- Replaced the former robot-scoped Device product direction with a global `/devices` page that has
  no RobotStatus ownership and remains accessible without a connected robot.
- Designed a device-per-card overlapping deck with swipe, pointer, keyboard, adjacent-card, and
  direct-picker navigation.
- Added a minimum-five-slot rule: connected devices fill the leading cards, empty placeholders keep
  the deck at five, and connections beyond five append cards without a maximum implied by the UI.
- Defined common card information/settings boundaries, a direct Vision Camera card with optional
  depth presentation, and an Operator/input-source card limited by its currently published
  lifecycle contract.
- Updated navigation, Robot Dock, frontend route, and interim Camera integration designs so global
  Device selection remains independent from the selected Control.

### Status

- The Device page product and technical design is documented; implementation has not started.
- Camera can support read-only information and previews after its contract, LAN, and CORS
  checkpoints. Operator can initially show generic lifecycle information but requires an
  Operator-owned provider contract before Portal exposes configuration or activation controls.
- Existing runtime source and current robot-scoped Device implementation remain unchanged.

### Validation

- Reviewed documentation consistency and whitespace only.
- Build, lint, typecheck, and test commands were not run because this change is documentation-only
  and repository rules require explicit user instruction before running them.

### Next goals

- Review and approve the minimum-five-card deck geometry and Device navigation behavior.

## 2026-08-08 - Device DV0 global route baseline

### Result

- Replaced the robot-scoped Device route with the global `/devices` route and redirect the legacy
  `/robots/:control_id/device` URL without retaining the Control identity.
- Moved `Devices` into the global Portal navigation, so it remains available when RobotDirectory is
  empty, and label the shell context `Device directory`.
- Removed the Device page's RobotStatus subscription and Control-status presentation. The temporary
  empty view now describes provider device discovery only.

### Validation

- Passed `npm run format:check`, `npm run typecheck`, and `npm test` (17 files, 64 tests).
- Passed focused Chromium route coverage for the global link, zero-robot access, legacy redirect,
  and Robot Dock route isolation.

### Next

- DV1: join public lifecycle and paginated endpoint-directory data into a stable, minimum-five-slot
  device directory.
- Decide the first Camera card's exact information hierarchy and color/depth layout.
- Implement DV0 only after explicit implementation approval.

## 2026-08-10 - Operator activation OR4-0 contract pin

### Changes

- Pinned the released Operator Activation OpenAPI 1.0.0 artifact with its immutable source revision
  and SHA-256 provenance.
- Added the reproducible local Operator contract generator and committed generated TypeScript types;
  Portal builds no contract dependency from a sibling Operator checkout or network source.

### Status

- OR4-0 is complete. The direct activation runtime remains disabled until subsequent OR4 gates
  validate directory evidence, transport, and authoritative state.

### Validation

- `npm run generate:operator-contract` regenerated the committed artifact.
- The pinned bytes match `nodus-operator` revision `9aa5c66565eb10bc047b47ea97337c4969f6809e`
  with SHA-256 `ce33cbf5865b41fc795aec787db45fbbe4fece13051b814ea999edcd5400f09c`.
- `git diff --check` passed.

### Next goals

- OR4-1: retain exact public service schema IDs and resolve the complete selected-runtime descriptor
  set without changing Camera or generic Device behavior.

## 2026-08-10 - Operator activation OR4-1 directory evidence

### Changes

- Preserved public service request and response schema IDs in the existing Device Directory entries.
- Extended the existing directory EventSource owner to forward only bounded, validated
  `component_state_updated` identity evidence to consumers while retaining its refresh behavior.
- Added a pure exact resolver for the selected runtime's five Operator activation descriptors; it
  rejects missing, duplicate, wrong-method, wrong-schema, or malformed-protocol matches.

### Status

- OR4-1 is complete. Portal still sends no Operator activation request; OR4-2 adds the bounded
  direct client and closed runtime guards.

### Validation

- Focused Device Directory, lifecycle event, Camera regression, and Operator descriptor tests passed
  (4 files, 12 tests).

### Next goals

- OR4-2: validate direct Operator responses at the Portal boundary with finite, no-retry mutation
  transport.

## 2026-08-10 - Operator activation OR4-2 direct client

### Changes

- Added bounded direct HTTP calls for the five discovered Operator endpoints only, with JSON-only
  request/response handling, finite abort timeout, response-size bound, omitted credentials, and
  redirect rejection.
- Added closed runtime guards for activation snapshots, fault envelopes, leases, and hold-start
  responses, plus selected component/instance/Control binding validation.
- Classified retryable reads, valid `409` conflict snapshots, and uncertain mutations; mutations
  perform no client retry and never become successful from malformed or incompatible responses.

### Status

- OR4-2 is complete. The client has no React owner yet, so it cannot create an activation request
  from the Operation page before OR4-3/OR4-4 integration.

### Validation

- Focused activation contract and client tests passed (2 files, 7 tests).

### Next goals

- OR4-3: add the one selected-runtime TanStack Query owner and current-runtime invalidation path.
