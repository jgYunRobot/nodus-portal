# Nodus Portal Persistent Robot Dock Design

## 1. Document status

- Date: 2026-08-08
- Status: approved product direction; implementation not started by this document
- Owner: `src/shell/robot_dock`
- Related designs:
  - `src_nodus_portal_navigation_and_multi_robot_home_design.md`
  - `src_nodus_portal_frontend_detailed_architecture_and_phased_implementation_design.md`
  - `src_nodus_portal_apps_web_ui_migration_design.md`
- Scope: persistent robot selection, shared robot commands, floating/collapsible presentation, and
  robot-switch handoff across Home, Device, Jogging, Operating, and future Portal pages

This document replaces the workflow in which Home's `Open Jogging` action is the only practical way
to establish a selected robot. It does not replace route-first navigation: a robot-scoped URL remains
the authoritative operation target.

## 2. Accepted product decisions

- A persistent `Robot Dock` floats above the bottom-right of every Portal page.
- The Dock is only very slightly transparent and remains readable in black, light, and system themes.
- The page layout reserves no bottom row, margin, or padding for the Dock. Content does not reflow
  when the Dock expands, collapses, or updates.
- The Dock's right edge remains anchored. Expansion grows leftward; collapse retracts toward the
  right.
- The expanded Dock shows robot selection, concise selected-robot state, Servo On/Off, Fault Reset,
  Brake Release/Engage, and factual operation feedback.
- The collapsed Dock shows only the robot selector and the affordance required to expand it. Command
  buttons and separate status text are not rendered in the collapsed surface.
- Selecting another robot on a robot-scoped page preserves the current page kind. For example,
  `/robots/control-a/jogging` becomes `/robots/control-b/jogging`.
- Switching the selected robot replaces Jogging's status subscription, robot model/profile,
  real-time values, and operation session as one Control-scoped transition.
- Home cards may select a robot without leaving Home. `Open Jogging` remains an explicit direct
  action, but it is no longer the only way to establish robot context.

## 3. Goals and non-goals

### 3.1 Goals

- make multi-robot switching available without returning to Home;
- keep the selected robot visible and changeable on every page;
- centralize common one-shot robot commands without duplicating them in Jogging;
- preserve URL identity, reload, direct-link, and browser history behavior;
- prevent status, model, hold state, or command feedback from crossing Control identities;
- avoid Dock-induced page resize, route remount, or telemetry-driven layout flicker; and
- reuse the existing Pilot public operation/session and RobotStatus stores.

### 3.2 Non-goals

- synchronized multi-robot commands;
- selecting or commanding an arbitrary first discovered robot automatically;
- moving joint jog, task jog, Home pose, or Ready hold-to-run controls into the Dock;
- adding a new Pilot route, importing Pilot internals, or connecting to Control IPC;
- claiming server-enforced command authority while Pilot Phase B remains deferred;
- adding modal acknowledgement or repeated warning gates; or
- making the Dock a replacement for Device, Jogging, Operating, Camera, or Policy pages.

## 4. Visual and layout contract

### 4.1 Floating placement

The Dock is a shell-owned overlay rather than a grid or flex child of the page.

```text
+---------------- sidebar ---------------- main content ----------------+
|                                                                      |
|                         active route                                 |
|                                                                      |
|                                      +-----------------------------+ |
|                                      | Robot Dock                  | |
|                                      +-----------------------------+ |
+----------------------------------------------------------------------+
```

Desktop placement uses the following semantic geometry:

- `position: fixed`;
- right inset from the viewport or safe content edge;
- bottom inset from `max(theme spacing, env(safe-area-inset-bottom))`;
- a shell overlay z-index above page cards and below modal/dialog layers;
- no Dock-sized `padding-bottom`, grid row, spacer, or content-height subtraction; and
- pointer events only on the Dock surface, not on its surrounding overlay layer.

The Dock may cover content beneath its own footprint. Collapse is the intentional way to expose more
of that lower-right area without shifting the page. Pages must not make an irreplaceable action
available only beneath the fixed Dock footprint.

### 4.2 Slight transparency

The Dock surface uses a theme token rather than a component-local raw color.

- black theme target: elevated surface at approximately 94% opacity;
- light theme target: elevated surface at approximately 96% opacity;
- a subtle one-pixel border and restrained shadow separate it from content;
- `backdrop-filter` blur may be used as progressive enhancement, with a readable non-blur fallback;
- text, focus rings, status colors, and disabled states must retain WCAG 2.2 AA contrast over varied
  page content; and
- transparency does not increase or animate in response to telemetry.

The intent is a nearly solid control surface with a small amount of visual integration, not a glass
panel or highly transparent HUD.

### 4.3 Expanded and collapsed geometry

The right edge is invariant in both modes. The expanded command region opens to the left so the
selector does not jump around the viewport.

Expanded order, left to right:

1. concise online/stale/offline and command-result region;
2. Servo On/Off;
3. Fault Reset;
4. Brake Release/Engage;
5. robot selector; and
6. collapse control at the right edge.

Collapsed contents:

1. robot selector; and
2. expand control.

Collapsed mode does not leave invisible command buttons focusable. The hidden command region is
unmounted or `inert`, and focus moves to the expand control if collapse is requested while focus is
inside that region.

Width and child-opacity transitions use the existing short motion tokens. Under
`prefers-reduced-motion: reduce`, the mode changes immediately. Fixed outer height and reserved
button slots prevent command pending/status text changes from resizing or flashing the Dock.

### 4.4 Responsive behavior

- Desktop: bottom-right floating bar, expanded by default on first use.
- Tablet: same right anchor with a bounded maximum width and horizontally compact labels.
- Phone: bottom-right compact surface, collapsed by default on first use; expansion may wrap into a
  two-row surface but remains an overlay and does not become a full-width layout row.
- A persisted explicit user choice takes precedence over the viewport default.
- Viewport changes never change the selected robot or operation target.

## 5. Selected robot authority

### 5.1 Effective selection

Portal distinguishes route authority from a shell presentation preference:

```text
route_control_id       = control_id from a robot-scoped URL, when present
preferred_control_id   = last explicit Dock or Home-card selection
effective_control_id   = route_control_id ?? preferred_control_id
```

- On a robot-scoped page, `route_control_id` is authoritative.
- On Home or another global page, the Dock uses `preferred_control_id`.
- A direct URL is never overwritten by a stored preference.
- An absent preference leaves the Dock unselected; Portal does not guess the first robot.
- An unavailable or no-longer-discovered selection remains visible as unavailable. Portal does not
  silently switch to another robot.

The versioned local presentation state stores the preferred Control ID and Dock expanded/collapsed
mode. It stores no RobotStatus, session token, pending command, model state, or command authority.

### 5.2 Route-preserving selection

Changing the selector follows the active route class:

| Current route | Select `control-b` | Result |
| --- | --- | --- |
| `/home` | preference update | remain `/home` |
| `/robots/control-a/device` | route navigation | `/robots/control-b/device` |
| `/robots/control-a/jogging` | route navigation | `/robots/control-b/jogging` |
| `/robots/control-a/operating` | route navigation | `/robots/control-b/operating` |
| global future page | preference update | remain on the global page |

Normal router navigation creates deterministic browser history. Reloading a robot-scoped route
restores its URL Control even if local preference differs.

### 5.3 Home and sidebar behavior

- Clicking non-interactive Home card space updates `preferred_control_id` and selected styling but
  does not leave Home.
- `Open Jogging` updates the preference and navigates to that exact Control's Jogging route.
- Device, Jogging, and Operating navigation entries use `effective_control_id`.
- If no effective Control exists, a robot-scoped navigation action focuses/opens the Dock selector
  rather than navigating back to an unchanged Home route.

## 6. Robot switch transaction

Robot switching is an ordered transition, not a change to a display label alone.

1. Resolve and validate the destination `control_id` from the public RobotDirectory.
2. End the prior Control's local hold intent before route/state replacement.
3. Drop unsent coalesced hold targets for the prior Control.
4. Keep already submitted operations and their results keyed to the prior `control_id`.
5. Navigate or update the global preference according to Section 5.2.
6. Remount the robot-scoped workspace using the destination `control_id` as its key.
7. Subscribe to the destination RobotStatus and load its Portal-owned model/profile.
8. Render destination telemetry only after a destination-identified snapshot is accepted.

During the transition, the selected destination identity may be shown with a bounded loading or
stale state, but the prior robot's joint values, model pose, Servo/Brake state, and command result
must not appear under the new identity.

An active hold or mutating command submission keeps the selector consistently unavailable until the
local hold is released or the submission reaches a bounded result. Browser navigation, Pilot
generation changes, and component unmount still execute the cancellation path even when the Dock
selector itself is unavailable.

## 7. Shared command ownership

The Dock owns only commands useful across pages:

- `control.set_servo_state` as authoritative Servo On/Off;
- `control.reset_fault` as a one-shot Fault Reset; and
- `control.set_brake_state` as authoritative Brake Release/Engage.

The buttons reuse the existing Portal operation runtime, lifecycle session, scheduler, and public
Pilot request encoding. The Dock must not create a second component session or a second operation
queue.

Button labels and pressed states derive from the newest accepted selected-Control RobotStatus.
Submitting a command may show pending state, but it does not optimistically flip Servo or Brake
state. A result such as written-but-unconfirmed remains factual and stays associated with its
original Control.

The following remain page-owned:

- joint and task jog;
- Home pose and Ready hold-to-run;
- reset origin;
- task-frame and speed selection;
- Camera, Policy, recording, or diagnostics-specific actions.

Jogging removes duplicate Servo, Fault Reset, and Brake controls after the Dock commands are
accepted. There is one visible owner for these commands.

## 8. Component and state boundaries

Proposed source boundaries:

```text
src/
  shell/
    portal_shell.tsx
    robot_dock.tsx
    robot_dock.module.css
    robot_dock_state.ts
    robot_route_selection.ts
  features/
    robot_directory/
    operations/
      robot_command_controls.tsx
      portal_operation_context.tsx
```

`RobotDock` composes existing services through narrow hooks. It does not own Pilot parsing,
RobotStatus validation, model loading, or hold target math.

| State | Owner | Lifetime |
| --- | --- | --- |
| route Control | router | URL/history |
| preferred Control | Dock presentation store | versioned local preference |
| Dock mode | Dock presentation store | versioned local preference |
| robot directory | global Pilot data service | Pilot server instance |
| selected RobotStatus | existing store keyed by `control_id` | stream generation |
| command pending/result | operation store keyed by Control/request | bounded application history |
| hold/projected target | page operation session keyed by Control | pointer/page lifetime |
| model/profile | robot-scoped page | route Control lifetime |

## 9. Failure and recovery behavior

- Pilot unavailable: keep the last explicit robot label, show unavailable, and disable commands.
- selected robot missing from discovery: retain selection, show unavailable, and offer another
  selector choice without auto-switching.
- stale/malformed RobotStatus: preserve factual stale presentation and disable commands that require
  authoritative state.
- Pilot restart/session replacement: command controls follow the existing operation runtime recovery;
  no request from the previous session is replayed.
- route switch during provider/model loading: cancel page-owned work and ignore late completion for
  the prior Control.
- command failure: keep Dock dimensions stable and show the result in its fixed feedback slot.

## 10. Accessibility and interaction

- The Dock is a named complementary landmark such as `aria-label="Selected robot controls"`.
- The selector is an accessible combobox with stable Control ID in each option.
- The collapse/expand button has explicit accessible name and `aria-expanded`.
- Collapsed mode exposes no hidden command controls to keyboard or assistive technology.
- Keyboard focus remains visible over the translucent surface.
- Status is not conveyed by color alone.
- Width animation never runs under reduced-motion preference.
- Touch targets remain at least 44 by 44 px.

## 11. Implementation checkpoints

### D0 - Design and current-state characterization

- approve this document and reconcile the navigation/detailed frontend designs;
- characterize existing route, Home card, command, hold, and selected-profile behavior; and
- make no runtime change.

### D1 - Selection store and route helpers

- add versioned preferred-Control and Dock-mode presentation state;
- implement effective-Control and route-preserving navigation helpers; and
- connect Home selection and robot-scoped navigation without adding commands.

### D2 - Floating visual shell

- add the fixed bottom-right Dock, theme tokens, slight transparency, and overlay stacking;
- implement right-anchored expand/collapse behavior and responsive defaults; and
- prove the main content dimensions do not change between Dock modes.

### D3 - Shared command relocation

- extract Servo, Fault Reset, and Brake presentation from the Jogging command group;
- bind the Dock to the existing operation runtime and selected RobotStatus; and
- remove the duplicate Jogging controls only after Dock behavior is covered.

### D4 - Robot-switch isolation

- implement the ordered switch transaction and hold cancellation;
- remount Device/Jogging/Operating state by destination Control;
- verify model/profile, real-time values, pending results, and resource cleanup; and
- cover direct URL, back/forward, reload, and unavailable-selection behavior.

### D5 - Browser, accessibility, and visual acceptance

- exercise one-, two-, stale-, offline-, and disappearing-robot fixtures;
- verify black/light/system themes and reduced motion;
- capture expanded/collapsed desktop and phone screenshots; and
- record bundle, rerender, subscription, and cleanup evidence without hardware motion.

## 12. Acceptance matrix

- Home card selection updates the Dock without leaving Home.
- Sidebar Device/Jogging/Operating routes use the explicit selected Control.
- Jogging `control-a` to `control-b` switch preserves the Jogging page kind and updates the URL.
- No `control-a` telemetry or model pose is rendered beneath `control-b` identity.
- An active hold is ended and its unsent target is discarded before Control replacement.
- Servo, Fault Reset, and Brake requests contain exactly the Dock-selected `control_id`.
- A prior Control's operation result cannot overwrite the new Control's Dock state.
- Collapsed Dock exposes only the selector and expand control.
- Dock mode changes do not alter main-content width, height, or scroll position.
- The nearly opaque surface remains legible over representative Home, Jogging, and scene content.
- Offline or removed selection is not silently replaced.
- No additional Pilot session, unbounded queue, Control IPC, or provider payload relay is introduced.

## 13. Explicit exclusions

This design does not authorize implementation, commit, push, hardware motion, physical robot
acceptance, synchronized fleet commands, emergency-stop semantics, Phase B authority, or changes to
Pilot, Control, Operator, Vision, or MetaGate repositories.
