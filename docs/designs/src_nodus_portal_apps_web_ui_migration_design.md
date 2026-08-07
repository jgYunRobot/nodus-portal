# Nodus Portal `apps/web_ui` Migration Design

## 1. Document status

- Date: 2026-08-07
- Status: draft for review; the development-risk and hold-to-run decisions in Sections 2 and 8
  are user-approved constraints.
- Source application: `pa_control/apps/web_ui`
- Target application: `nodus-portal`
- Focused navigation design: `src_nodus_portal_navigation_and_multi_robot_home_design.md`
- Detailed frontend implementation design:
  `src_nodus_portal_frontend_detailed_architecture_and_phased_implementation_design.md`
- Control-plane dependency: published `nodus-pilot` HTTP, SSE, endpoint-directory, operation, and
  sample-stream contracts only.

This design records the exact legacy inventory, the target Portal ownership, and the accepted
research-stage operating policy before any frontend source, dependency, asset, or build tooling is
copied.

## 2. Accepted development deployment policy

The current deployment is a private home robotics research and development environment. Pilot
Phase B command authority and production security hardening are intentionally deferred.

For this stage:

- one operator coordinates the active mutating source for each Control;
- Portal command features are not removed, disabled, converted to discrete-only interaction, or
  hidden behind repeated warning gates merely because Phase B is deferred;
- joint jog, task jog, Home, and Ready retain hold-to-run continuous interaction;
- the existing `pass_through` and Control acknowledgement/watchdog limitations remain factual
  design context, but they are accepted development constraints rather than feature gates; and
- the decision is reopened only when the deployment adds multiple independent mutating sources,
  untrusted users or networks, unattended operation, or production acceptance requirements, or
  when the user explicitly requests reconsideration.

This policy does not change the architecture boundary: Portal still must not connect to Control
IPC, claim server-enforced command ownership, or describe the development setup as production-safe.

## 3. Existing source inventory

### 3.1 Frontend and build

The source application currently uses:

- React 18, React DOM, and TypeScript;
- Vite and `@vitejs/plugin-react`;
- Three.js, React Three Fiber, Drei, and `urdf-loader`; and
- Lucide React icons.

The root/build file inventory is `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`,
`tsconfig.node.json`, and `vite.config.ts`. The supporting source inventory is `src/main.tsx`,
`src/vite-env.d.ts`, and `src/styles/app.css`. The current application has no committed frontend
test files.

The Vite configuration contains a PA-CONTROL-specific robot asset plugin that reads
`assets/robots/urdf/e_rob` from the PA-CONTROL repository and emits those files into the web build.
That repository-relative behavior cannot move unchanged into Portal.

### 3.2 Presentation components

The current component inventory is:

- `app.tsx`: application composition, health polling, stream subscription, Camera and Policy
  orchestration;
- `robot_scene.tsx`: URDF robot and Camera point-cloud visualization;
- `joint_jog_panel.tsx`: joint/task jog and Home/Ready hold-to-run interaction;
- `task_jog_panel.tsx`: task frame status and task-space controls;
- `command_panel.tsx`: servo, brake, fault/origin reset, teleoperation, multi-turn, and Policy
  activation controls;
- `camera_control_panel.tsx`: Camera registry, lifecycle, previews, ROI depth, and inspection;
- `camera_point_cloud.tsx`: provider-owned binary point-cloud rendering;
- `policy_control_panel.tsx`: Policy registry, selection, load, readiness, and fault state; and
- `event_log.tsx`: local and PA-CPU event presentation.

### 3.3 Current client and domain modules

The current library inventory is:

- `pa_cpu_client.ts`: PA-CPU health, events, RobotStatus, Camera lifecycle/recording, and aggregate
  SSE;
- `pilot_bridge.ts`: local UI events plus arbitrary PA-CPU `event_type` forwarding;
- `pa_cpu_policy_control_client.ts`: PA-CPU-specific Policy routes and SSE;
- `policy_session.ts`: Policy latched activation and 100 ms hold lease heartbeat;
- `policy_contract.ts` and `policy_control_client.ts`: Policy UI contracts;
- `mock_policy_control_client.ts`: fixture Policy implementation;
- `robot_operation_session.ts`: local operation state, status conversion, jog target construction,
  and legacy PilotBridge calls;
- `joint_state.ts`: RobotStatus presentation types and 10 ms jog delta calculations;
- `robot_model.ts` and `robot_model_repository.ts`: URDF model parsing and loading;
- `camera_ui_config.ts`: local Camera visualization preferences; and
- `theme_session.ts`: local theme preference.

### 3.4 Current PA-CPU coupling

The legacy UI calls the following PA-CPU-owned paths:

- `/api/health`, `/api/events`, `/api/robot_status`, and `/api/stream`;
- `/api/pilot/events` with arbitrary legacy event names;
- `/api/cameras`, `/api/cameras/{id}/lifecycle`, and `/api/cameras/recording`; and
- `/api/policies`, `/api/policies/snapshot`, Policy lifecycle/action routes, and
  `/api/policies/stream`.

PA-CPU currently aggregates PilotRuntime, direct Control transport, InputSource, Camera management,
Policy management, MetaGate, event logging, and HTTP adaptation. Portal must not recreate this
aggregate backend.

## 4. Target ownership

| Owner | Responsibilities |
| --- | --- |
| Portal | responsive rendering, operator intent, transient pending state, local presentation preferences, provider payload rendering |
| Pilot | component session/liveness, snapshots, operational events, Control status/sample streams, endpoint discovery, semantic Control operation admission and routing |
| Camera provider | capture, encoding, preview/depth/point-cloud/query endpoints, Camera-owned lifecycle contract |
| Policy provider | registry, loading, inference lifecycle, readiness, activation contract, semantic operation production |
| MetaGate/Gym | recording coordination, timestamp correlation, episode and dataset lifecycle |
| Control | robot I/O, realtime execution, limits, and Control-owned execution behavior |

Portal uses Pilot for the control plane. It reads high-bandwidth Camera and future provider payloads
directly from explicitly selected endpoints discovered through Pilot.

## 5. Feature disposition

### 5.1 Retain as Portal presentation/domain assets

- React/TypeScript/Vite application baseline;
- URDF loading and Three.js robot visualization;
- joint position, velocity, acceleration, torque, and task-frame presentation;
- Camera color/depth/split views, ROI depth query UI, point-cloud rendering, and scene overlay;
- event-log presentation;
- theme and local visualization preferences;
- responsive desktop/tablet/phone layout foundations; and
- joint jog, task jog, Home, and Ready hold-to-run interaction.

The existing single-page workspace becomes the robot-scoped `Jogging` page. The persistent shell,
left navigation, default Home page, multi-robot cards, routes, and subscription strategy are owned
by `src_nodus_portal_navigation_and_multi_robot_home_design.md`.

### 5.2 Retain the user experience but replace the integration

- PA-CPU health becomes Pilot health and authoritative snapshot state.
- PA-CPU RobotStatus becomes the selected Control's Pilot status/sample stream.
- PA-CPU aggregate events become Pilot operational event SSE plus explicit local request events.
- the simulated Connect Pilot action becomes a real Portal component session and heartbeat owner
  when command-capable mode is active;
- servo, brake, reset fault, reset origin, and motion commands become typed
  `POST /api/v1/operations` requests;
- Camera registry polling becomes Pilot endpoint-directory discovery followed by direct provider
  connections;
- Policy presentation remains reusable, but its client becomes a future discovered Policy provider
  adapter rather than a Pilot- or PA-CPU-specific route set; and
- the robot asset plugin becomes Portal-owned packaged assets or an explicitly designed robot
  profile contract.

### 5.3 Exclude from Portal

- `PaCpuClient`, `PilotBridge`, `PaCpuPolicyControlClient`, and arbitrary legacy event forwarding;
- a PA-CPU-compatible aggregate backend or aggregate `/api/stream`;
- direct Control IPC or Control wire-contract code;
- local state that claims a button press proves authoritative servo, brake, connection, or motion
  state;
- the legacy `set_pilot_drive` teleoperation switch, which has no current typed Pilot operation;
- one-shot `request_robot_status` UI behavior when Pilot already owns continuous status samples;
- Camera process supervision implemented inside Portal;
- MetaGate persistence, recording bundle ownership, episode assembly, and dataset materialization;
- fixture/mock Policy state in the production runtime; and
- disabled placeholder actions without an approved provider contract.

### 5.4 Defer until the owning provider contract exists

- Policy select/load/enable/hold/fault-reset integration;
- Camera lifecycle and multi-Camera recording operations;
- MetaGate/recorder controls;
- frame registration UI while its installed-Control limitation remains unresolved; and
- production authentication, TLS, remote endpoint trust, and installable PWA/native wrapper work.

The presentation components may be migrated before their providers exist, but production controls
must use explicit unavailable states rather than mock success.

## 6. Pilot API mapping

| Portal need | Pilot public contract |
| --- | --- |
| process health | `GET /api/v1/health` |
| authoritative aggregate state | `GET /api/v1/snapshot` |
| live external components | `GET /api/v1/components` |
| controller session | register, heartbeat, state, and disconnect component routes |
| latest Control state | `GET /api/v1/controls/{control_id}/status` |
| Control status replay | `GET /api/v1/controls/{control_id}/status/samples` |
| low-latency UI status | `GET /api/v1/controls/{control_id}/status/stream` |
| generic stream selection | `/api/v1/pilot/streams` routes |
| operational events | `GET /api/v1/events/stream` |
| provider discovery | `GET /api/v1/endpoints` |
| Control mutation | `POST /api/v1/operations` |

Portal must preserve Pilot session generation, request sequence, source timestamp, TTL, Control ID,
and operation result semantics. Operation acknowledgement changes pending/result presentation; only
new authoritative status changes displayed robot state.

## 7. Portal state model

Portal keeps three state categories separate:

1. **Authoritative state**: latest accepted Pilot snapshot and Control status, identified by Control,
   server instance, connection generation, and sequence.
2. **Pending intent**: an operation submitted by this Portal session but not yet resolved.
3. **Presentation state**: open panels, selected tabs, theme, view offsets, Camera overlay choices,
   and other local preferences.

React render state must not be the canonical command baseline. A dedicated status store owns the
latest accepted RobotStatus sample and exposes an immediate read to the hold-to-run engine. The
engine also owns a per-intent projected target that advances by speed and monotonic elapsed time.
Every calculation reconciles that projection with the newest status available at calculation time.
This prevents event-handler closures and delayed React renders from reusing an older joint or task
pose without making motion progress depend on the status delivery rate.

On Pilot restart, server-instance change, Control generation change, replay gap, or reconnect,
Portal clears stale pending assumptions, refreshes the authoritative snapshot, and reseeds the
status store before deriving another target.

## 8. Hold-to-run motion design

### 8.1 Accepted interaction

Joint jog, task jog, Home, and Ready remain continuous hold-to-run controls. They must not be
replaced by click-once fixed-distance controls.

The operator selects a speed percentage. While the pointer remains held, elapsed hold time and the
selected speed continue to produce motion distance. A higher selected speed produces a larger
delta over the same elapsed time.

### 8.2 Root cause to remove

The legacy implementation uses a 10 ms browser interval while status arrives independently. A
callback can therefore construct several targets from the same old React snapshot. Reusing
`old_position + one_delta` produces duplicate or insufficiently advancing targets until the UI
eventually observes a newer position. Waiting for a new status before every target would create the
opposite problem: motion distance would then depend on status and acknowledgement latency rather
than the selected speed and actual hold duration.

### 8.3 Status-reconciled target generation

Portal replaces stale interval-state reads with the following model:

1. Pointer down creates one active `HoldIntent` containing the operation kind, axis or goal,
   direction, speed percentage, selected frame, and pointer identity.
2. The first compatible authoritative status seeds both the central status store and the intent's
   projected target. A hold cannot invent an initial robot pose.
3. Every newly accepted Control status sample atomically updates the central store independently of
   React rendering. Duplicate or older samples never roll the store backward.
4. At each configured hold calculation tick, the engine reads the central store again instead of a
   pointer-down closure or previously rendered snapshot.
5. The engine calculates monotonic elapsed time since the prior hold calculation and then calculates
   `distance = configured_rate * speed_ratio * elapsed_time`. The elapsed value is bounded by a
   named configuration limit so browser suspension does not create one oversized accumulated step.
6. The projected target advances from its prior value by that distance. It is then reconciled in the
   motion direction with the newest authoritative real position or frame pose. A newer status can
   move the baseline forward, but a delayed status cannot pull the projected target backward or
   collapse the accumulated distance to the same `old_position + one_delta` target.
7. The projection is clamped to the existing joint and fixed-goal limits without converting the
   interaction to a discrete step.
8. At most one operation request for an intent is in flight. While it is pending, later hold ticks
   replace one pending candidate with the newest reconciled target. Portal submits that candidate
   when the current request resolves and does not build an unbounded browser or Pilot request
   backlog.
9. Pointer up, pointer cancel, lost capture, blur, page hide, or intent replacement deactivates the
   hold and prevents new operations. Portal does not claim that a final browser message synthesizes
   a Control stop.
10. While a hold intent is active, its originating control remains enabled so it can retain pointer
    capture and receive release events. Every other mutating control, Jog mode tab, speed input, and
    task-frame selector remains disabled for the entire hold lifetime and unlocks only after release
    or cancellation. Per-request `in_flight` transitions must not drive this interaction lock.

Status freshness remains visible for diagnostics, but a delayed status sample does not reset or
freeze the time-based projection after the hold has been seeded. When a newer sample arrives, the
very next calculation reconciles against it. A Control connection generation change invalidates the
projection and requires a fresh compatible sample before the hold can resume.

### 8.4 Joint jog

- Seed the selected joint projection from the newest authoritative real position.
- Advance it by direction, selected speed, and monotonic elapsed time.
- Reconcile it so a newer real position can move the baseline forward while an older/lagging real
  position cannot pull the already projected target backward.
- Apply the configured joint-limit behavior before submission.
- Rebuild the complete target from the newest real-joint vector and replace only the selected
  joint with its reconciled projection.

If multi-turn behavior remains desired, it requires an explicit Portal motion-mode design. A local
checkbox must not silently change server or robot authority semantics.

### 8.5 Task jog

- Seed the projected pose from the newest requested frame in the authoritative RobotStatus frame
  list.
- Advance the projected translation or rotation using selected speed and monotonic elapsed time.
- Reconcile the projection with each newly available frame pose without rolling motion progress
  backward.
- Submit the complete task target from the reconciled pose in the explicitly selected frame
  convention.
- Do not fall back to an identity pose after a compatible live status stream has been expected; make
  the missing frame visible as unavailable input.

### 8.6 Home and Ready

- Keep the existing hold-to-run behavior.
- Seed the projected joints from the newest real positions and calculate their remaining difference
  to the fixed goal.
- On every hold calculation, normalize the remaining joint-space goal vector and advance the
  projected target by one speed- and elapsed-time-derived path distance. This preserves equal path
  progress across all moving axes so they reach the fixed goal together, then reconciles the
  projection only when newer real positions are farther along that path.
- Clamp at the goal so the target never overshoots.
- Release stops generating further targets; it does not convert the interaction into a one-shot
  full-goal command.

### 8.7 Command and display reconciliation

- Pilot operation results determine request disposition and delivery presentation.
- RobotStatus determines achieved robot state.
- A forwarded or written operation must not overwrite displayed joints optimistically.
- A rejected request leaves the latest authoritative state unchanged and exposes the request error.
- Status sequence and generation changes are observable in diagnostics so stale-baseline defects
  can be reproduced.

## 9. Camera integration

Portal selects Camera endpoints by explicit component ID, descriptor ID, contract version, and
schema ID. It must not automatically bind the first provider that advertises a broad capability.

Pilot supplies descriptor metadata only. Color, depth, point cloud, ROI depth, and future Camera
control payloads travel directly between Portal and the selected Camera provider. On endpoint
catalog changes, Pilot restart, session generation change, or direct request failure, Portal
re-queries the directory and does not silently switch providers.

## 10. Policy integration

Policy remains an external CommandSource and service owner. Portal may reuse the existing Policy
panel's registry, readiness, selection, load, activation, and fault presentation, but it must not
invent product-specific Pilot routes.

The production Policy client is introduced only after an external Policy repository publishes its
own versioned endpoint contract through Pilot discovery. Policy-produced Control operations use the
same public Pilot operation path as other command sources.

## 11. Proposed source boundaries

```text
src/
  app/                        router, persistent shell and navigation registry
  pages/home/                 multi-robot overview and robot cards
  pages/jogging/              migrated robot operation workspace
  api/pilot/                  Pilot public HTTP/SSE clients and session owner
  stores/                     Pilot, robot directory, per-Control status and operation state
  domain/robot/               URDF model, RobotStatus conversion, target math
  providers/camera/           discovered Camera endpoint adapters
  providers/policy/           future discovered Policy endpoint adapters
  features/connection/        health, reconnect, component and Control selection
  features/operation/         pending results and hold-to-run motion engine
  features/visualization/     robot, Camera and point-cloud rendering
  features/events/            Pilot and local operation event presentation
```

Provider adapters may depend on endpoint descriptor contracts. Presentation and robot-domain code
must not depend on PA-CPU response types.

## 12. Migration checkpoints

### Checkpoint 0: design and source inventory

- Approve this inventory, ownership, feature disposition, and hold-to-run design.
- Do not copy source, dependencies, build files, or assets in this checkpoint.

### Checkpoint 1: standalone frontend foundation

- Add the Portal package/build/test layout.
- Add the route-first persistent shell, left navigation, Home route, robot-scoped Jogging route,
  theme, responsive layout, and explicitly owned robot assets.
- Keep all network dependencies behind interfaces or deterministic fixtures.

### Checkpoint 2: Pilot observer integration

- Add health, snapshot, components, public RobotStatus-stream-derived robot discovery, explicit
  Control selection, bounded multi-Control status consumption, event stream, reconnect, and
  gap/generation recovery.
- Populate Home cards independently and route each card to its exact Control's Jogging page.
- Prove the 3D robot and telemetry use only authoritative Pilot status.

### Checkpoint 3: provider discovery and Camera visualization

- Add exact endpoint selection and direct Camera payload clients.
- Migrate color/depth/ROI/point-cloud features without Pilot payload relay.

### Checkpoint 4: Portal controller integration

- Add Portal component session ownership and typed operation requests.
- Add servo, brake, reset, joint/task jog, Home, and Ready controls.
- Implement the status-reconciled hold-to-run engine without making Phase B a checkpoint
  dependency.

### Checkpoint 5: external Policy and recording providers

- Add Policy and recorder controls only from their published discovered contracts.
- Keep inference, Camera capture, MetaGate persistence, and dataset work outside Portal.

### Checkpoint 6: deployment packaging

- Add same-origin hosting, cache rules, PWA assets, and optional wrapper only after the browser build
  and external contracts are stable.

Each implementation checkpoint requires separate approval, focused validation, staged-diff review,
progress update, and commit.

## 13. Validation plan

### Static and unit validation

- no import, URL, type, or event-name dependency on PA-CPU;
- no Control IPC or Pilot internal import;
- deterministic status-store ordering and generation tests;
- deterministic joint/task/Home/Ready delta tests across speed percentages, hold tick intervals,
  and status delivery intervals;
- prove duplicate or out-of-order status cannot roll a projected target backward;
- prove a delayed status stream does not collapse repeated hold targets to one stale
  `position + delta` value;
- prove a new status sample changes the next target baseline even when React has not rendered;
- prove delayed operation responses coalesce to one newest pending target without queue growth; and
- prove displayed robot state changes only from authoritative status.

### Integration validation

- use a public-contract fake Pilot with controllable status generation, sequence, delay, gaps, and
  operation responses;
- hold each continuous control while status and acknowledgement rates differ;
- verify Home/Ready converge without overshoot while the button remains held;
- verify release and pointer lifecycle events stop future operation generation;
- verify Pilot restart and Control generation changes reseed target construction; and
- verify Camera payload bytes bypass Pilot and come from the explicitly selected provider.

No test requires hardware or an external service. Hardware behavior remains a separately requested
validation task.

## 14. Explicit exclusions

This design does not authorize:

- modifying or deleting `pa_control/apps/web_ui`;
- implementing Portal runtime source in the design checkpoint;
- implementing Pilot Phase B or production hardening;
- modifying Pilot runtime contracts;
- creating Camera, Policy, InputSource, MetaGate, or Gym implementations inside Portal; or
- claiming production safety, authenticated authority, synchronized multi-Control operation, or
  Control execution acknowledgement that the published contracts do not provide.
