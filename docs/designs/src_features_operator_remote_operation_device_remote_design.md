# Portal Operation Device Remote Detailed Design

## 1. Document status

- Date: 2026-08-09
- Status: implementation-ready for the Portal-only presentation phase
- Implementation status: OR0-OR2 are implemented in Portal; OR3 acceptance remains pending.
- Owner: `src/features/operator_remote`
- Integration point: `src/pages/operation_page`
- Related designs:
  - `src_app_operation_page_consolidation_design.md`
  - `src_pages_device_page_design.md`
  - `src_nodus_portal_navigation_and_multi_robot_home_design.md`
  - `src_nodus_portal_frontend_detailed_architecture_and_phased_implementation_design.md`
- Scope boundary: build the Operator selector and Device Remote presentation below the existing Jog
  remote, but do not send an activation request, change Operator state, or publish a robot operation.

This design advances only the Portal presentation portion of Device phase DV5. It does not release
or guess the deferred Operator activation contract described by the Device-page design.

## 2. Accepted product direction

The robot-scoped Operation page keeps the existing Jog remote and adds a second remote below it.
The second remote is labelled `Device Remote` and allows the user to select one currently connected
Operator/input-source device.

The eventual product interaction contains two distinct controls:

- `Run` / `Pause`: switches a selected Operator between paused and latched running state; and
- `Hold to Run`: runs only while the control remains intentionally held.

The first Portal checkpoint implements the complete selector, layout, status presentation, button
placement, responsive behavior, and unavailable states. Both activation controls remain disabled
in the application runtime with an explicit `Operator activation is not integrated` explanation.
No local simulated activation state is presented as a real Operator state.

## 3. Goals and non-goals

### 3.1 Goals

- place a Device Remote directly below the existing Jog remote in the Operation page's right rail;
- list connected `input_source` components from the existing global Device Directory;
- keep the selected Operator isolated by the route `control_id` and stable `component_id`;
- show factual Pilot lifecycle identity and capability information for the selected Operator;
- render the final Run/Pause and Hold-to-Run control arrangement without enabling mutations;
- make unavailable, disconnected, replaced, and multiple-Operator states understandable;
- preserve existing Jog, RobotStatus, robot visualization, Robot Dock, and Pilot operation behavior;
  and
- leave a narrow integration seam for a future versioned Operator provider contract.

### 3.2 Non-goals

- adding or changing code in Nodus Operator, Pilot, Control, Vision, or PA-CONTROL;
- defining an Operator HTTP route, request payload, state schema, lease, or acknowledgement;
- calling an endpoint inferred from `component_id`, configuration, localhost, or source files;
- using Pilot's Control `/operations` route as an Operator activation route;
- starting, pausing, reading, predicting, or publishing from a Leader Arm or Policy input source;
- changing the Terminal UI's activation mode or arbitration with future remote control;
- mapping an Operator to a Control without published association metadata;
- keeping a fake production activation state in React state or browser storage; or
- changing the accepted command-authority deployment decision.

## 4. Page composition

### 4.1 Desktop layout

The current Operation workspace remains a two-column grid. Its right-side `operation_card` is
replaced by a semantic remote rail containing two independent cards:

```text
+------------------------------+  +------------------------+
| Robot scene                  |  | Jog Remote             |
|                              |  | Joint / Task / Home    |
+------------------------------+  +------------------------+
| Real-time values             |  +------------------------+
|                              |  | Device Remote          |
|                              |  | [Run/Pause] [Hold]     |
|                              |  | [Operator selector]    |
+------------------------------+  +------------------------+
```

- `HoldControls` remains inside the first card without behavior or ownership changes.
- `OperatorRemotePanel` owns only the second card's presentation and selection events.
- The rail uses the existing page spacing tokens and does not reserve new shell or Robot Dock space.
- A Device Remote content update does not resize or remount the Jog remote.

### 4.2 Narrow layout

At the existing Operation breakpoint, the remote rail becomes a single-width block while retaining
the order `Jog Remote` then `Device Remote`. Buttons retain touch-sized hit areas. Labels may wrap,
but the two activation controls remain equal width and do not collapse into icon-only controls.

The Robot Dock remains a shell overlay and is not moved into either remote card.

## 5. Operator discovery and selection

### 5.1 Source

The Operation page reuses the existing `useDeviceDirectory()` owner. It must not create another
Pilot event subscription, polling loop, component session, or endpoint-directory fetcher.

The presentation derives candidates using only:

```text
entry.component_type == "input_source"
```

The current Operator advertises only `control.operation.v1`, so this phase does not require or
pretend that `operator.activation.v1` exists. `card_kind` and display-name text are presentation
data and are not evidence of a writable contract.

### 5.2 Candidate view

Each selector option contains:

- `display_name`;
- shortened `component_id` when needed to distinguish equal names;
- Pilot lifecycle health; and
- an `Offline`, `Degraded`, or `Ready` textual marker when available.

The selected details region may show `component_id`, lifecycle state, current instance/generation,
and advertised capabilities already present in `DeviceDirectoryEntry`. It does not display adapter,
hardware, activation mode, target Control, or source readiness unless a future exact contract
publishes them.

### 5.3 Selection rules

- With no Operator candidates, the selector and both controls are disabled and the panel displays
  `No Operator connected`.
- With exactly one candidate on initial page entry, Portal selects it for inspection.
- With multiple candidates on initial page entry, Portal requires explicit selection so an
  arbitrary sorted entry is not presented as the intended device.
- Selection is keyed by `component_id`, never by card index or response order.
- An unrelated directory reorder does not change selection.
- A runtime-key change for the same component retains its logical selection but discards all
  runtime-qualified presentation errors and future pending state.
- Removal of the selected component clears selection and does not silently select another Operator.
  The user must select again, except on a fresh page entry with exactly one candidate.
- A route `control_id` change remounts the Operation workspace and clears the prior page's selection.
- Selection is page-local and is not persisted to local storage or encoded in the Operation URL.

These rules prevent a future mutation from moving to a different Operator merely because a process
disconnects or the directory order changes.

## 6. Presentation state model

The Portal-only phase uses factual discovery state rather than an activation state machine:

```ts
type OperatorRemoteAvailability =
  | "no_operator"
  | "selection_required"
  | "lifecycle_unavailable"
  | "activation_contract_unavailable";
```

This is a Portal view state, not an Operator lifecycle contract. It is derived as follows:

| Condition | Availability | Control state |
| --- | --- | --- |
| no candidates | `no_operator` | selector and buttons disabled |
| multiple candidates, none selected | `selection_required` | buttons disabled |
| selected lifecycle is not ready | `lifecycle_unavailable` | buttons disabled |
| selected input source is visible | `activation_contract_unavailable` | buttons disabled |

The selected component's Pilot `ready` health does not mean `paused`, and `degraded` does not mean
an Operator activation fault. Portal must use the exact lifecycle wording and display activation as
`Unavailable`, not infer `PAUSED`, `RUNNING`, or `HOLDING`.

## 7. Remote control presentation

### 7.1 Header and selector

The panel contains:

1. heading `Device Remote`;
2. activation control row directly below the heading;
3. labelled Operator selector; and
4. selected component status line.

The heading does not repeat a helper sentence. The Run/Pause and Hold-to-Run controls remain in
their final visible position immediately below `Device Remote`, before selector and identity
details.

The selected status line is an `aria-live="polite"` region for connection/removal changes. Routine
directory refreshes that do not change visible state are not announced.

### 7.2 Run/Pause button

The final button position and minimum width are implemented in this phase. Runtime text is
`Run / Pause` while activation is unavailable; Portal does not choose `Run` or `Pause` without an
authoritative activation snapshot.

The button has:

- `type="button"`;
- a stable accessible name;
- disabled semantics, not only a dimmed style; and
- an adjacent visible explanation for why it cannot be used.

No click handler creates a Pilot operation, fetch request, optimistic state, or event log entry.

### 7.3 Hold-to-Run button

The final button position, `Hold to Run` label, hand icon, pressed styling, and equal-width layout
are implemented. In the application runtime it remains disabled and does not register active
pointer or keyboard hold behavior.

Component-level visual fixtures may render future inactive, pressed, and unavailable appearances,
but fixture state never enters the production Operation page. This is preferred over a production
mock because a clickable fake hold could be mistaken for an active input source.

### 7.4 Future behavior preview

Once a separately approved Operator contract exists, the intended authoritative behavior is:

| Operator state | Run/Pause | Hold to Run |
| --- | --- | --- |
| paused | Run enabled | hold enabled |
| latched running | Pause enabled | disabled |
| momentary running | disabled | pressed until release |
| fault, offline, replacing | disabled | disabled |

This table reserves presentation behavior only. It does not define the transport, state schema,
lease interval, expiry, generation rules, or local Terminal arbitration.

## 8. Component boundaries

The target Portal structure is:

```text
src/features/operator_remote/
  operator_remote_model.ts
  operator_remote_panel.tsx
  operator_remote_panel.module.css
  operator_remote_model.test.ts
  operator_remote_panel.test.tsx

src/pages/
  operation_page.tsx
  operation_page.module.css
```

Responsibilities:

- `operator_remote_model.ts` filters candidates and derives the factual availability/view model.
- `operator_remote_panel.tsx` renders selection, identity, status, and disabled future controls.
- `operation_page.tsx` supplies the route-scoped selection lifetime and existing Device Directory.
- `operation_page.module.css` owns only right-rail composition; feature styling stays with the
  feature.

The current phase does not add `operator_activation_client`, `operator_activation_session`, hold
timers, endpoint matching, or generated Operator API types.

## 9. State ownership and lifecycle

| State | Owner | Lifetime |
| --- | --- | --- |
| Operator candidates | existing global Device Directory | Pilot server instance |
| selected Operator ID | Operation workspace | route `control_id` instance |
| selected runtime identity | derived view model | directory snapshot |
| availability explanation | derived view model | directory snapshot |
| activation state | not present in this phase | deferred |
| pending Run/Pause request | not present in this phase | deferred |
| active hold/lease | not present in this phase | deferred |

Unmounting the Operation page destroys only its local selection. It does not disconnect an
Operator, modify the Device page selection, reset the global directory, or change the Robot Dock.

## 10. Failure and replacement behavior

- Directory loading keeps the panel geometry stable and shows `Discovering Operators`.
- Directory failure shows a contained factual error and keeps both controls disabled.
- Selected component removal clears selection and any component-scoped message.
- Same-component runtime replacement retains logical selection but visibly refreshes instance and
  generation details.
- A malformed endpoint catalog does not affect this phase because no endpoint is consumed.
- Another device's failure does not change the selected Operator.
- Existing Jog holds and operation feedback are unaffected by Operator discovery changes.

## 11. Accessibility and theme requirements

- The panel works in black, light, and system theme modes using existing tokens.
- Control availability is conveyed by text and disabled semantics, not color alone.
- The selector has a persistent visible label.
- Status changes use one low-noise polite live region.
- Buttons retain at least the existing Portal control height and visible focus styling.
- Disabled buttons remain readable in the black primary theme.
- Tab order is selector, Run/Pause, Hold to Run; disabled controls are naturally skipped.
- The panel does not trap focus or intercept global Space while activation is unavailable.

## 12. Implementation checkpoints

### OR0 - Contract-free directory adapter

- add pure filtering and availability derivation from `DeviceDirectoryEntry`;
- preserve stable `component_id` selection and clear-on-removal behavior; and
- add no network client, endpoint matcher, or Operator schema.

### OR1 - Device Remote presentation

- add the panel header, selector, component details, state explanation, and equal-width controls;
- render activation controls disabled with no production mock state; and
- cover empty, one-Operator, multiple-Operator, degraded, removed, and replaced fixtures.

### OR2 - Operation page integration

- split the current right side into a remote rail;
- keep the existing Jog remote as the first unchanged card;
- mount Device Remote as the second card; and
- isolate selection by route `control_id` without changing the Operation URL.

### OR3 - Portal-only acceptance

- verify desktop, tablet, phone, black/light/system, keyboard, and reduced-motion presentation;
- prove selector changes make no fetch or Pilot operation request;
- prove Operator removal cannot silently select another candidate;
- run the repository's format, typecheck, lint, unit, build, and focused Playwright checks when
  implementation validation is explicitly requested; and
- perform no physical robot, Leader Arm, Policy inference, Pilot mutation, or Operator execution.

### Deferred OR4 - Real Operator activation

OR4 is not approved by this design. It first requires:

- an Operator-owned versioned OpenAPI artifact;
- exact Pilot endpoint-catalog capabilities and descriptor matching;
- an authoritative activation snapshot;
- idempotent latched Run/Pause semantics;
- bounded hold lease and lost-release behavior;
- generation/replacement and no-replay rules;
- explicit local Terminal UI and remote Portal coexistence; and
- LAN-reachable endpoint and browser origin behavior.

After that contract is approved, this document or a successor must be updated before enabling the
two controls.

## 13. Acceptance criteria

- Operation shows one Device Remote card directly below the unchanged Jog remote.
- Only connected Pilot components with `component_type=input_source` appear in its selector.
- Zero, one, and multiple Operator layouts are deterministic and understandable.
- The selected identity is stable across unrelated directory reorder.
- Removing a selected Operator clears selection rather than switching to another Operator.
- Switching the route Control remounts and clears the previous Operator selection.
- Run/Pause and Hold-to-Run controls have their final visible layout but are disabled in runtime.
- The panel never labels Pilot lifecycle health as paused, running, holding, or activation fault.
- No provider endpoint, Pilot operation, local activation simulation, hold timer, or browser-persisted
  selection is introduced.
- Existing Jog, RobotStatus, visualization, Robot Dock, Device page, and Camera behavior remain
  unchanged.

## 14. Follow-up decision gate

The next design begins only when the Operator repository publishes a stable activation contract.
At that gate, Portal must pin the released artifact and decide exact endpoint capabilities, state
refresh, Run/Pause idempotency, hold lease timing, session replacement, Terminal arbitration, and
Policy inference gating from released evidence rather than from this presentation scaffold.
