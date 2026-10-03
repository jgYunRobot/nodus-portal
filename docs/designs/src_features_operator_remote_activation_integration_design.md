# Portal Operator Activation Integration Detailed Design

## 1. Document status

- Date: 2026-08-09
- Status: implementation-ready; OR4 runtime integration is not implemented by this document
- Owner: `src/features/operator_remote`
- Page integration: `src/pages/operation_page`
- Public provider contract: Nodus Operator `schemas/operator/v1/openapi.yaml`, API `1.0.0`
- Related designs:
  - `src_features_operator_remote_operation_device_remote_design.md`
  - `src_pages_device_page_design.md`
  - `src_app_operation_page_consolidation_design.md`
  - `src_nodus_portal_frontend_detailed_architecture_and_phased_implementation_design.md`
- Scope: enable the existing Device Remote Run/Pause and Hold-to-Run controls through the released
  direct Operator activation API without adding an Operator proxy to Pilot.

The inspected Operator artifact at revision `9aa5c66565eb10bc047b47ea97337c4969f6809e`
has SHA-256 `ce33cbf5865b41fc795aec787db45fbbe4fece13051b814ea999edcd5400f09c`.
OR4-0 must record the exact released revision and digest actually copied into Portal; it must not
silently refresh the contract from a sibling worktree.

## 2. Accepted architecture

Pilot remains the lifecycle and endpoint-directory owner. Operator remains the activation and
source-execution owner. Portal discovers through Pilot and sends activation requests directly to
the exact Operator endpoints advertised in the current catalog.

```text
Portal existing Device Directory
  -> Pilot /api/v1/components + /api/v1/endpoints + lifecycle SSE
  -> exact Operator descriptor set for the selected component runtime
  -> direct Operator GET/PUT/POST activation API
  -> Operator ActivationCoordinator
  -> existing SourceSupervisor / Policy gate / Pilot operation publisher
```

Pilot component-state events are invalidation hints. The direct Operator
`ActivationSnapshot` is the authoritative state rendered by Portal. Portal does not add a Pilot
activation route, derive provider URLs, contact Control IPC, or create a second Operator state
machine.

## 3. Goals and non-goals

### 3.1 Goals

- pin the released Operator OpenAPI artifact and generate compile-time TypeScript types;
- resolve all five activation descriptors exactly from the existing Device Directory;
- enable desired-state Latched Run/Pause for the selected Operator;
- implement remote Hold-to-Run with one server-owned lease and a 100 ms heartbeat;
- show Terminal-origin state changes by re-reading the same authoritative snapshot;
- reject responses from a replaced Operator runtime or a different target Control;
- stop local hold ownership on every release, selection, route, visibility, and network boundary;
- keep one selected-Operator query/mutation owner with bounded requests and no automatic mutation
  replay; and
- support Portal access from the current LAN host and tablet without compiling a provider address
  into Portal.

### 3.2 Non-goals

- modifying Pilot, Control, Vision, PA-CONTROL, Leader mapping, joint offsets, or Policy logic;
- proxying Operator response payloads through Pilot;
- selecting a model, source adapter, calibration, serial device, or target Control from Portal;
- adopting an active hold lease created by Terminal or another browser;
- automatically resuming activation after Operator, Pilot, Portal, or network recovery;
- treating an HTTP response as robot execution acknowledgement;
- implementing authentication, production command authority, or multi-user arbitration; or
- running real Leader Arm, Policy inference, or e_rob motion during automated acceptance.

## 4. Existing Portal baseline to preserve

- `useDeviceDirectory()` already owns the single Pilot component/endpoint query and SSE
  invalidation path. Operator integration reuses it and creates no second Pilot subscription.
- `DeviceDirectoryEntry.runtime_key` already qualifies a logical `component_id` with Pilot server,
  instance, session generation, and catalog generation.
- `OperatorRemotePanel` already owns page-local stable selection and final control placement below
  the Jog remote.
- `PortalOperationRuntime` remains the sole Portal component session and Control-operation
  scheduler. Direct Operator calls do not register another Portal component with Pilot.
- Existing Jog, Home, Ready, RobotStatus, 3D model, Robot Dock, and Camera behavior remain unchanged
  except for cooperative local interaction disabling described in section 13.

## 5. Contract pin and exact endpoint selection

### 5.1 Portal-owned contract artifacts

OR4-0 adds:

```text
contracts/operator/v1/openapi.yaml
contracts/operator/v1/PROVENANCE.md
scripts/generate_operator_contract.mjs
src/api/operator/generated/operator_v1.ts
```

`PROVENANCE.md` records source repository, immutable source revision, source path, OpenAPI version,
provider API version, SHA-256, generator package, and generator version. The generated file is
committed so Portal does not depend on a sibling Operator checkout or network access at build time.

`package.json` receives a `generate:operator-contract` command following the existing Pilot
generator pattern. Generated TypeScript is compile-time evidence only; direct HTTP responses still
pass narrow runtime guards before use.

### 5.2 Required descriptor set

All five descriptors must belong to the selected `DeviceDirectoryEntry` and its current
`runtime_key`. Portal does not build sibling URLs from the read endpoint.

| Descriptor ID | Capability | Method | Request schema | Response schema |
| --- | --- | --- | --- | --- |
| `operator.activation.read` | `operator.activation.read.v1` | `GET` | none | `operator.activation.v1.ActivationSnapshot` |
| `operator.activation.latched` | `operator.activation.latched.v1` | `PUT` | `operator.activation.v1.LatchedActivationRequest` | `operator.activation.v1.ActivationSnapshot` |
| `operator.activation.hold-start` | `operator.activation.hold.start.v1` | `POST` | `operator.activation.v1.HoldStartRequest` | `operator.activation.v1.HoldStartResponse` |
| `operator.activation.hold-heartbeat` | `operator.activation.hold.heartbeat.v1` | `POST` | `operator.activation.v1.HoldLeaseRequest` | `operator.activation.v1.ActivationSnapshot` |
| `operator.activation.hold-stop` | `operator.activation.hold.stop.v1` | `POST` | `operator.activation.v1.HoldLeaseRequest` | `operator.activation.v1.ActivationSnapshot` |

Every match additionally requires:

- `kind=service`;
- `contract_version=1`;
- `protocol=http|https` matching the endpoint URL scheme;
- `media_type=application/json`;
- exact service request and response schema IDs; and
- exactly one match for each route.

`DeviceEndpoint` therefore retains `request_schema_id` and `response_schema_id` from the public
Pilot descriptor instead of discarding them after directory validation. Camera matching remains
unchanged. A missing, duplicate, malformed, wrong-method, wrong-schema, or mixed-runtime descriptor
set makes activation incompatible and keeps both controls disabled.

## 6. Runtime identity and Control binding

The selected logical device remains keyed by `component_id`, but every request is qualified by:

```text
Pilot server_instance_id
Operator component_id
Operator instance_id
component session_generation
endpoint catalog_generation
```

The complete value is the existing `runtime_key`. A runtime-key change aborts reads, invalidates
mutations, clears the local hold lease, clears errors, and starts discovery from an empty cache.
An old response is discarded even if it arrives after a new runtime is selected.

The first accepted direct snapshot must also satisfy:

- `snapshot.component_id == selected_entry.component_id`;
- `snapshot.instance_id == selected_entry.instance_id`; and
- `snapshot.target_control_id == Operation route control_id`.

The first two checks prevent replacement races. The third prevents an Operation page for one robot
from activating an Operator configured for another robot. A mismatch is a visible incompatible
state; Portal never rewrites `target_control_id` or submits an activation anyway.

Component metadata and Pilot `CommonState.details` may provide a target hint for presentation, but
only the validated direct snapshot authorizes enabling the controls.

## 7. Portal module boundaries

The intended structure extends the current feature rather than creating a generic device mutation
framework prematurely:

```text
src/api/operator/
  generated/operator_v1.ts

src/features/operator_remote/
  operator_activation_contract.ts
  operator_activation_client.ts
  operator_activation_query.ts
  operator_hold_session.ts
  operator_remote_model.ts
  operator_remote_panel.tsx
  operator_remote_panel.module.css
  focused tests beside each owner
```

Responsibilities:

- `operator_activation_contract.ts` performs exact descriptor selection and closed runtime guards.
- `operator_activation_client.ts` owns bounded direct HTTP, normalized errors, and no-retry
  mutation semantics.
- `operator_activation_query.ts` owns the one selected-runtime TanStack Query cache, event-driven
  invalidation inputs, and low-rate fallback revalidation.
- `operator_hold_session.ts` owns one local remote-hold lease, 100 ms heartbeat scheduling, and all
  cleanup paths independently from React render frequency.
- `operator_remote_model.ts` derives labels, availability, conflict state, and factual messages.
- `operator_remote_panel.tsx` renders the existing selector and controls and delegates transitions
  to those owners.
- `operation_page.tsx` supplies route `control_id`, selected entry, and page-scoped interaction
  state. It does not contain fetch, timer, or lease logic.

The existing UUID implementation used by the Portal component session should be exposed as a small
shared identity utility and reused for Hold Start `request_id`; do not add another random-ID
fallback implementation.

## 8. Authoritative activation state

Portal accepts the closed Operator `ActivationSnapshot` fields:

- identity: `component_id`, `instance_id`, `target_control_id`, `source_id`;
- Terminal preference: `terminal_mode`;
- state: `run_state`, `activation_kind`, `ready`;
- ordering: `generation`, `revision`;
- optional `hold_lease`; and
- optional bounded `fault`.

Within the same `runtime_key`, a lower `revision` cannot overwrite a higher accepted revision.
Equal revision is idempotent. A new runtime key starts revision comparison from empty rather than
comparing revisions across processes.

Portal query state is explicit:

```ts
type OperatorActivationQueryState =
  | "unselected"
  | "discovering"
  | "incompatible"
  | "loading"
  | "ready"
  | "recovering"
  | "offline"
  | "faulted";
```

The last valid snapshot may remain visible during a bounded revalidation, but controls remain
disabled whenever runtime identity, target binding, lifecycle readiness, or snapshot freshness is
not current. A stale cached snapshot is never used to start a new generation.

## 9. Direct HTTP client rules

The client sends requests only to the five selected descriptor URLs with:

- `Accept: application/json`;
- `Content-Type: application/json` for body requests;
- `credentials: omit`, `cache: no-store`, and `redirect: error`;
- one `AbortController` and named finite timeout per request;
- bounded JSON response size before decoding; and
- strict content type and runtime-contract validation.

GET may be retried only through the feature's bounded revalidation policy. PUT/POST mutations have
no generic retry. An abort, timeout, lost connection, or malformed response after a mutation is an
uncertain outcome: Portal disables further mutation, performs a fresh GET, and never repeats the
original mutation automatically.

An Operator error envelope is accepted only after runtime validation. A `409` snapshot is applied
when it matches the selected runtime and is newer; its code remains visible (`stale_generation`,
`stale_lease`, `activation_conflict`, or not-ready equivalent). `503`, `413`, `415`, unknown status,
HTML, redirects, or malformed JSON cannot be converted into success.

## 10. Query and Terminal synchronization

One TanStack Query key is used per selected runtime:

```text
["operator", "activation", runtime_key]
```

The query runs only while the Operator is selected on the Operation page and the exact read
descriptor exists. It revalidates on:

- initial compatible selection;
- selected runtime-key change;
- a `component_state_updated` invalidation for the selected component runtime;
- successful mutation response followed by normal query reconciliation;
- provider error that asks the existing Device Directory owner to refresh;
- tab returning to visible or browser returning online; and
- one bounded low-rate fallback interval while visible.

The existing `subscribeDeviceDirectoryEvents()` owner is extended to pass the public event type and
the bounded `(component_id, instance_id, session_generation)` payload to its consumers. The Device
Directory still performs its current coalesced refresh, while the selected activation query
invalidates only when a `component_state_updated` event matches its runtime. No second EventSource
is created. Public component `last_sequence` is not used as the activation trigger because normal
component heartbeats also advance it and would create unnecessary direct GET requests.

The fallback interval exists for a lost/capacity-rejected Pilot SSE event. It is one selected
provider query, not a query per discovered Operator. Requests never overlap; hidden tabs do not
poll. Terminal Run/Pause, `H`, local hold, fault, lease expiry, and recovery therefore converge to
the same direct snapshot even when the action originated outside Portal.

## 11. Latched Run/Pause behavior

The button is desired-state based, not a toggle request:

- `PAUSED` with `activation_kind=none` renders `Run` and submits
  `{desired_state: "running", observed_generation: snapshot.generation}`;
- `RUNNING` with `activation_kind=latched` renders `Pause` and submits
  `{desired_state: "paused", observed_generation: snapshot.generation}`;
- `STARTING` or `STOPPING` renders the factual transition and disables repeated submission;
- local/remote hold, fault, connecting, shutdown, stale data, or target mismatch disables the
  latched control.

Only one activation mutation may be in flight for the selected Operator. Portal does not
optimistically render running or paused. A valid response updates the authoritative cache. A
Terminal pause arriving during a Portal request wins according to Operator generation semantics;
Portal accepts the response or later GET with the highest valid revision.

Changing `terminal_mode` is not part of this button. `terminal_mode` is displayed as the Terminal
key preference only; remote Latched Run does not silently press Terminal `H`.

## 12. Hold-to-Run behavior

### 12.1 Start and lease ownership

Pointer down or non-repeated Space/Enter key down starts exactly one request:

```json
{"request_id": "portal-hold-<uuid>"}
```

The button captures the pointer before submission. A valid Hold Start response installs the exact
returned `(lease_id, generation)` into one local `OperatorHoldSession`. Portal owns a lease only
when that lease was returned to this live page runtime. It never adopts a lease merely because the
public snapshot contains its ID.

If release occurs while Hold Start is in flight, the session records release intent. If a valid
lease response later arrives for the still-current runtime, Portal immediately sends one Stop
instead of starting heartbeats. If Start has an uncertain outcome, Portal does not retry; the
server's missing-heartbeat expiry is the fallback stop.

### 12.2 Heartbeat

- Heartbeat interval is `100 ms`, matching the Operator contract's expected client behavior.
- The effective lease timeout remains Operator-owned and is presented from `expires_in_ms`.
- At most one heartbeat is in flight and none are queued.
- Each heartbeat uses the exact locally owned `lease_id` and `generation`.
- A failed, timed-out, stale, or malformed heartbeat closes local admission immediately, stops
  further heartbeats, marks recovery, and performs no automatic Hold Start.
- Browser timer throttling is allowed to expire the lease; Portal never claims continued hold
  merely because the pointer is still down after recovery.

### 12.3 Stop and cleanup

Portal requests one best-effort Stop on:

- pointer up, pointer cancel, or lost pointer capture;
- matching Space/Enter key up;
- window blur, document hidden, or browser offline;
- route change, Operation page unmount, or selected Operator change;
- selected Operator runtime replacement/removal;
- target-Control mismatch, lifecycle loss, or contract incompatibility; and
- application shutdown where the browser still permits a bounded request.

Stop is not replayed after an uncertain response. The local lease is invalidated before awaiting
network completion so a late UI event cannot restart heartbeat. A final GET reconciles when the
page and runtime remain active; otherwise the server lease expires within its configured bound.

## 13. Cooperative interaction with Jog and other clients

The accepted home-research deployment still has no server-enforced Portal command authority.
Portal therefore enforces only truthful local cooperation:

- while a Portal Jog/Home/Ready hold is active, this page cannot start Operator activation;
- while the selected Operator snapshot is `starting`, `running`, or `stopping`, Jog/Home/Ready
  controls are disabled for this page;
- one Device Remote mutation disables its sibling activation button until reconciliation; and
- Terminal or another browser may still change Operator state, which is reflected through the
  authoritative synchronization path rather than described as Portal ownership.

This is not a global lock and makes no production-safety claim. It prevents accidental simultaneous
commands from the same Portal page without adding a second scheduler or altering Pilot Phase B.

## 14. Device Remote presentation behavior

The existing placement and button order stay unchanged. Runtime behavior becomes:

| Condition | Run/Pause | Hold to Run | Message |
| --- | --- | --- | --- |
| no Operator/selection | disabled | disabled | existing discovery explanation |
| missing/invalid descriptors | disabled | disabled | activation contract incompatible |
| loading/recovering/offline | disabled | disabled | factual connection state |
| target Control mismatch | disabled | disabled | configured target shown |
| paused and ready | `Run` | enabled | `Paused` |
| latched starting/running | disabled/`Pause` when stable | disabled | factual latched state |
| local hold active | disabled | disabled | `Terminal hold active` |
| this Portal's remote hold | disabled | pressed | lease remaining presentation |
| another client's remote hold | disabled | disabled | `Remote hold active` |
| fault | disabled | disabled | bounded Operator fault |

Status content remains in the existing fixed panel region so polling/recovery does not resize the
Jog card or make the right rail flicker. `aria-live=polite` announces state changes, but 100 ms
heartbeat responses never produce repeated announcements.

Pointer and keyboard behavior share the same hold session. The Space key is handled only while the
button has focus; Portal does not install a page-global Space handler that conflicts with Terminal
semantics or browser controls.

## 15. LAN deployment address and CORS

Portal never replaces a discovered `127.0.0.1` URL with a guessed LAN URL. The provider must
advertise the address that is reachable from the browser.

For the current workstation deployment, the companion Operator profile
`assets/configs/so101_e_rob_leader.json` is configured as:

```json
{
  "provider": {
    "bind_host": "192.168.219.106",
    "port": 8770,
    "advertised_base_url": "http://192.168.219.106:8770",
    "allowed_origins": [
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://192.168.219.106:5173"
    ]
  }
}
```

`pilot.base_url` remains `http://127.0.0.1:8765` when Operator and Pilot run on the same host.
Portal development continues to proxy Pilot locally while the browser calls the advertised
Operator LAN URL directly. The Portal dev server is launched with `--host 0.0.0.0 --port 5173`.

The current profile binds only the selected Wi-Fi interface instead of all host interfaces. If
DHCP changes the workstation address, update Operator `bind_host`, `advertised_base_url`, and the
exact LAN `allowed_origins`; do not add URL rewriting to Portal. HTTPS Portal plus HTTP Operator is
a mixed-content deployment and remains outside this HTTP LAN research checkpoint.

## 16. Failure and recovery matrix

| Event | Required behavior |
| --- | --- |
| Pilot SSE gap/restart | existing directory owner refreshes components/endpoints; activation cache waits for current runtime |
| catalog removed/replaced | abort requests, clear local lease, disable controls, resolve exact new descriptors |
| Operator process replacement | preserve logical selection by `component_id`, discard runtime-qualified state |
| GET timeout/malformed payload | show recovering/offline, refresh directory once per bounded failure episode |
| Latched mutation timeout | do not retry; GET authoritative state before re-enabling |
| Hold Start timeout | do not retry; stop local scheduling and rely on lease expiry |
| heartbeat failure | stop heartbeats, invalidate local lease, revalidate without resuming |
| Stop timeout | keep local lease invalid; do not replay; lease expiry remains final bound |
| Terminal changes state | Pilot event invalidates; direct GET updates both Portal label and controls |
| another browser starts first | Operator `409` plus snapshot wins; this Portal never adopts its lease |
| browser hidden/offline | local hold cleanup begins immediately; polling pauses until visible/online |

Errors are component-scoped and bounded. A failing Operator must not reset RobotStatus, Robot Dock,
Camera, another Operator card, or the Jog layout.

## 17. Security boundary

The LAN configuration exposes Operator activation to devices that can reach port 8770 and present
an allowed browser Origin. CORS is a browser policy, not authentication. This is accepted only for
the current trusted home research network and does not claim protection against a malicious local
process or non-browser client.

Do not add repeated warning dialogs or disable the approved feature solely because Phase B is
deferred. Before deployment on an untrusted LAN, remote access, or production system, add an
approved authentication/authority contract and TLS/reverse-proxy design.

## 18. Implementation checkpoints

### OR4-0 - Pin Operator contract

- copy the exact released OpenAPI bytes and provenance;
- add reproducible generation and committed TypeScript types; and
- prove regeneration produces no unexplained diff.

### OR4-1 - Extend directory evidence and resolve endpoints

- retain service request/response schema IDs and expose typed state invalidation from the existing
  Device Directory event owner;
- resolve the exact five-descriptor set with pure functions; and
- leave existing Camera and generic Device behavior unchanged.

### OR4-2 - Add bounded direct client and runtime guards

- implement GET and four mutation calls from generated types;
- validate closed snapshots, leases, and errors at runtime; and
- classify incompatible, retryable read, conflict, and uncertain mutation outcomes.

### OR4-3 - Add authoritative selected-runtime query

- create one selected-runtime TanStack Query owner;
- bind identity, Control target, revision monotonicity, lifecycle sequence invalidation, visibility,
  and bounded fallback revalidation; and
- clear state on selection/runtime replacement without creating another Pilot subscriber.

### OR4-4 - Enable Latched Run/Pause

- map authoritative paused/latched state to desired-state requests;
- serialize mutations and handle conflict snapshots; and
- keep uncertain outcomes disabled until GET reconciliation.

### OR4-5 - Enable remote Hold-to-Run

- implement pointer/keyboard start, local lease ownership, 100 ms heartbeat, release-before-start,
  and exhaustive cleanup;
- use fake clocks for scheduler tests; and
- never replay Start, Heartbeat, or Stop after uncertainty.

### OR4-6 - Integrate presentation and local cooperation

- replace the placeholder availability with factual activation states;
- keep the approved panel layout and stable height;
- coordinate only this page's Jog and Device Remote interactions; and
- preserve Terminal and other-client state as externally authoritative.

### OR4-7 - LAN and acceptance

- verify the current Operator LAN bind/advertised URL/exact-origin companion configuration;
- validate desktop and tablet direct access through the advertised catalog URLs;
- validate black/light/system, touch, keyboard, reduced motion, reconnect, and replacement; and
- run no physical motion unless the user separately authorizes a bounded hardware acceptance.

Each checkpoint is independently reviewable. Portal implementation checkpoints modify only Portal;
the LAN profile is an already-applied, separately reviewed companion change in the Operator
repository.

## 19. Test and acceptance plan

### 19.1 Pure and client tests

- exact descriptor success and every missing/duplicate/wrong field failure;
- existing Camera descriptor regression after retaining service schema IDs;
- closed snapshot, lease, error, identity, target, generation, and revision validation;
- lower-revision and old-runtime response rejection;
- GET timeout/retry versus mutation no-retry behavior; and
- response-size, content-type, redirect, abort, and CORS-visible network failures.

### 19.2 Query and interaction tests

- Terminal-origin Run/Pause/hold changes invalidate and revalidate through existing directory
  lifecycle evidence;
- selection, route, runtime, visibility, blur, offline, pointer-cancel, lost-capture, and unmount
  cleanup;
- release while Hold Start is in flight sends Stop when the lease arrives;
- one heartbeat in flight, 100 ms fake-clock schedule, failure close, and no restart;
- local versus foreign remote-hold ownership;
- target-Control mismatch and Operator replacement while a request is in flight;
- no automatic sole-candidate switch after an explicitly selected Operator is removed; and
- no request when the contract is incomplete or the snapshot is stale.

### 19.3 Browser acceptance

- a desktop and tablet can monitor the same selected Operator without replacing their Portal Pilot
  sessions;
- Terminal Pause changes both Terminal and Portal to paused;
- Portal Latched Run/Pause and Hold controls call only the discovered Operator endpoints;
- releasing Hold on every supported path stops heartbeat and converges to paused;
- recovery/error messages do not resize or flicker the Jog card;
- provider URL requests use `192.168.219.106:8770`, never tablet-local `127.0.0.1`; and
- no request is sent to Pilot `/api/v1/operations` by Device Remote activation.

Automated acceptance uses a fake Operator HTTP provider and deterministic clocks. Repository format,
typecheck, lint, unit, build, and focused Playwright commands run only when explicitly requested.

## 20. Completion criteria

OR4 is complete when the existing Device Remote controls are enabled solely from an exact current
Operator contract, Terminal and Portal render the same authoritative activation generation, lost
release is bounded by the Operator lease, mutation uncertainty is never replayed, a mismatched
Control cannot be activated, and LAN desktop/tablet clients reach the advertised provider directly.

Completion does not imply Pilot command authority, authentication, physical motion acceptance, or
Operator source/model configuration from Portal.
