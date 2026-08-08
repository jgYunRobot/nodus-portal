# Progress

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
