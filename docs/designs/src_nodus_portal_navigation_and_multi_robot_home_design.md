# Nodus Portal Navigation and Multi-Robot Home Design

## 1. Document status

- Date: 2026-08-07
- Updated: 2026-08-08 for the approved persistent Robot Dock
- Status: draft for review; the left navigation, Home page, and current-page-to-Jogging decisions
  are user-approved constraints.
- Related design: `src_nodus_portal_apps_web_ui_migration_design.md`
- Detailed implementation design:
  `src_nodus_portal_frontend_detailed_architecture_and_phased_implementation_design.md`
- Focused Robot Dock design: `src_shell_robot_dock_design.md`
- Scope: Portal application shell, client-side pages, robot overview, Control selection, and
  multi-robot UI data flow.
- Superseding route decision: as of 2026-08-09,
  `src_app_operation_page_consolidation_design.md` replaces the Jogging/Operating page names and
  routes below with one canonical robot-scoped Operation page while retaining the Jog controls.

This document separates Portal navigation and multi-robot presentation from the detailed
`apps/web_ui` migration and hold-to-run motion design.

## 2. Accepted product decisions

- Portal is no longer designed as one page containing every feature.
- A persistent left panel provides page navigation.
- Selecting a navigation item changes the main page without restarting the Portal application.
- The current single-page robot operation screen becomes the `Jogging` page.
- A new `Home` page is the default entry and displays one concise status/information card per
  discovered robot.
- The page model and URL structure support multiple robots from the first implementation, even when
  the initial deployment has only one configured Control.
- Future Camera, Policy, recording, diagnostics, and settings pages extend the same shell rather
  than expanding Jogging into another all-in-one page.
- A persistent bottom-right Robot Dock provides selected-robot context and the shared Servo, Fault
  Reset, and Brake commands on every page.
- The Dock floats over the page without reserving layout space, is only slightly transparent, and
  collapses toward its fixed right edge until only robot selection remains.

## 3. Application shell

Portal uses one persistent application shell with a navigation panel and a route-owned content
area.

```text
+----------------------+-------------------------------------------------------+
| Nodus Portal         | Page title / selected robot / connection summary      |
|                      +-------------------------------------------------------+
| [Home]               |                                                       |
|                      |                                                       |
| Robot                |                 Active page                           |
| [Jogging]            |                                                       |
|                      |        Home card grid or Jogging workspace            |
| Future sections      |                                                       |
|                      |                   [floating Robot Dock]               |
| [collapse]           |                                                       |
+----------------------+-------------------------------------------------------+
```

The shell owns:

- the left navigation panel and collapsed/expanded state;
- the active route and browser history integration;
- the selected robot identity for robot-scoped navigation;
- the persistent Robot Dock and last explicit robot-selection preference;
- global Pilot connection and degraded/offline presentation;
- global status/discovery/session services that must survive page changes; and
- the main route outlet.

Page components do not recreate Pilot clients, RobotStatus stores, or component sessions on every
navigation event.

## 4. Navigation model

### 4.1 Route-first navigation

Navigation uses client-side routes rather than one local `active_page` Boolean or a collection of
conditionally rendered panels. Navigation buttons are semantic links that update the URL and route
outlet without a full page reload.

This preserves:

- direct links and bookmarkable robot pages;
- browser back/forward behavior;
- page refresh recovery;
- deterministic selected-robot identity; and
- future route-level code splitting and tests.

The router library is selected with the frontend package in the implementation checkpoint. The
route contract defined here does not depend on one particular library.

### 4.2 Initial routes

| Route | Scope | Page |
| --- | --- | --- |
| `/` | global | redirect to `/home` |
| `/home` | global | multi-robot summary card grid |
| `/devices?device=:component_id` | global | provider Device card deck; no RobotStatus ownership |
| `/robots/:control_id/jogging` | one Control | migrated robot operation/Jogging workspace |
| `/robots/:control_id/operating` | one Control | robot operation controls without visualization |
| unmatched route | global | Portal not-found page with Home action |

Future routes may include:

- `/robots/:control_id/diagnostics`;
- `/policies` or `/robots/:control_id/policies` after the ownership contract is decided;
- `/recording` after the recorder/MetaGate contract exists; and
- `/settings`.

Future routes do not appear as disabled placeholder buttons. The navigation registry exposes only
implemented pages.

### 4.3 Robot-scoped selection

The URL path parameter is the canonical selected `control_id` for a robot-scoped page. The Robot
Dock stores the last explicit selection only as a presentation preference and must not override a
direct URL.

- Selecting non-interactive space on a Home card updates the Dock selection without leaving Home.
- Selecting `Open Jogging` on a Home card updates the preference and navigates to that card's
  explicit Control ID.
- The Robot Dock selector is visible on global and robot-scoped pages.
- Changing the selector on a robot-scoped page replaces only the Control ID portion of the current
  Jogging or Operating route. Device is global and remains unchanged.
- The last selected Control may be stored as a presentation convenience, but the URL remains
  authoritative.
- If a URL references a Control no longer discoverable, the page shows a not-found/unavailable state
  and offers Home navigation. It does not silently operate the first available robot.

## 5. Left navigation panel

### 5.1 Initial entries

The initial expanded panel contains:

1. Portal identity/logo area;
2. `Home` navigation item;
3. a global `Devices` navigation item;
4. a `Robot` section with `Jogging` and `Operating`;
5. optional selected-robot summary on robot-scoped routes; and
6. a collapse/expand control.

`Home` and `Devices` are global. `Jogging` and `Operating` are robot-scoped:

- when a Control is already selected by the active route or saved presentation preference, each
  robot-scoped item navigates directly to that Control's corresponding route;
- when no Control is selected, activating a robot-scoped item focuses or expands the Robot Dock
  selector; and
- the item must not guess an arbitrary first Control as an operation target.

### 5.2 Active and connection state

- The active route has a visible selected style and `aria-current="page"`.
- Pilot connection state is presented once in the persistent shell instead of being duplicated in
  every page.
- Robot-specific online/stale/offline state remains visible near the selected robot identity on
  robot-scoped pages.
- The navigation panel does not present Phase B ownership that Pilot does not enforce.

## 6. Home page

### 6.1 Purpose

Home answers three questions without opening a detailed operation screen:

1. Which robots are currently known through Pilot's public contracts?
2. What is the concise current status of each robot?
3. Which robot should the operator open for detailed Jogging work?

Home is an overview and selection page, not a second realtime robot-control workspace.

### 6.2 Layout

Home contains:

- a title and short Pilot connection summary;
- optional search/filter controls once the number of robots warrants them;
- a responsive card grid;
- loading, empty, partial-failure, and Pilot-offline states; and
- stable ordering by configured display name when available, otherwise by `control_id`.

Cards use equal structural regions so status comparisons remain easy at different viewport sizes.

### 6.3 Robot card fields

Each card contains only data supported by public contracts:

- display name when an explicit profile/metadata contract supplies it;
- `control_id` as the stable fallback identity;
- robot type and DOF when present in RobotStatus interface data;
- Control connection and status freshness badge;
- servo activated state;
- brake released/applied state;
- latest status sample age or last update time;
- concise last operation disposition when useful and available; and
- an `Open Jogging` action for that exact `control_id`.

Unknown fields display `Unknown` or are omitted. Portal does not infer model names, ownership,
provider association, or command authority from unrelated component metadata.

### 6.4 Card behavior

- Cards update independently; one unavailable robot does not blank the complete grid.
- A card does not mount the full Three.js robot scene or Camera payload renderer.
- Card updates use authoritative Pilot status and never optimistic command state.
- Clicking non-interactive card space may select the card, but the explicit `Open Jogging` action
  remains keyboard-visible and accessible.
- Card selection updates the Dock preference and selected styling without navigating away from Home.
- Card state is keyed by `control_id`, not array order.

## 7. Robot discovery adapter

### 7.1 Current public-contract source

The current Pilot `/api/v1/snapshot` response is centered on the default Control and is not a
complete public Control catalog. For the initial Portal integration, the robot discovery adapter:

1. queries `GET /api/v1/pilot/streams` for RobotStatus stream descriptors;
2. collects unique `control_id` values from those public descriptors;
3. keeps the matching `stream_id`, schema ID, and stream generation with each robot entry;
4. reads the latest status for each explicit Control through the public status route or selected
   latest stream subscription; and
5. treats missing RobotStatus descriptors as no publicly discoverable robot rather than inspecting
   Pilot configuration or internals.

### 7.2 Future explicit Control catalog

Pilot may later publish a dedicated caller-visible Control catalog and richer robot profile data.
Portal isolates current discovery behind a `RobotDirectory` interface so that future migration
replaces the adapter rather than Home, navigation, route, or card models.

The normalized Portal robot directory entry contains:

- `control_id`;
- optional display/profile metadata with explicit provenance;
- RobotStatus stream identity and generation;
- latest authoritative status summary;
- discovery state; and
- last successful update evidence.

Portal does not claim synchronized multi-Control operation. Multi-robot Home means independent
discovery, status, navigation, and operation targeting.

## 8. Subscription and rendering strategy

### 8.1 Home overview

Home must not open one independently scheduled 60 Hz React render loop and one Three.js scene for
every robot.

- Use Pilot's multiplexed latest sample subscription for the selected set of RobotStatus streams
  when it is supported by the advertised public contract and server limits.
- Keep sequence and generation state isolated by `control_id`/stream ID.
- Respect Pilot subscription capacity; split a large directory into bounded subscriptions only when
  required by the public limit.
- Update the central status store at received sample rate, but batch or throttle Home card rendering
  to a lower presentation rate.
- Re-query stream discovery after catalog-relevant events, gaps, server-instance changes, generation
  changes, or direct subscription failure.

### 8.2 Jogging detail

The active Jogging page receives the selected Control's freshest UI status path and may render at
the detailed rate needed by telemetry and 3D visualization.

The shared subscription owner prevents duplicate Home and Jogging subscriptions for the same
stream where one source can satisfy both consumers. Leaving Jogging releases detail-only consumers
without destroying the global robot directory or Home summaries.

## 9. Jogging page

The existing `apps/web_ui` single page is decomposed into the Jogging route rather than copied as
the new application root.

Jogging contains:

- selected robot identity and current connection/status summary;
- the URDF/Three.js robot scene;
- joint and task telemetry;
- reset origin and Jogging-owned lifecycle controls; shared Servo, Brake, and Fault Reset controls
  are owned by the persistent Robot Dock;
- continuous joint jog, task jog, Home, and Ready hold-to-run controls;
- operation request/result presentation; and
- route-relevant Camera overlay controls when the selected Camera is explicitly associated with the
  selected robot by a future contract.

The global `Home` navigation page and the Jogging motion action named `Home` are different concepts.
Implementation identifiers use unambiguous names such as `home_page` and `home_pose`; accessible
labels identify the motion action as `Move to Home pose` even if its compact visible label remains
`Home` inside Jogging.

The hold-to-run algorithm and authoritative-state rules are owned by
`src_nodus_portal_apps_web_ui_migration_design.md` and are unchanged by page routing.

### 9.1 Page entry

- Resolve the explicit `control_id` before enabling robot-scoped actions.
- Reuse or seed the selected Control status store.
- Load the configured Portal-owned robot model/profile for that robot when available.
- Do not retain another robot's joint state, pending operation, projected hold target, or selected
  task frame after the route Control ID changes.

### 9.2 Page exit and robot switch

- Cancel the local hold intent before unmounting or changing Control ID.
- Drop unsent coalesced hold targets for the prior Control.
- Keep already submitted operation results associated with their original `control_id`.
- Release page-only Camera/point-cloud resources.
- Preserve global Pilot connection, robot directory, and Home card summaries.
- A Robot Dock selection change preserves the current robot-scoped page kind and replaces only its
  route Control ID.
- The new page instance does not display the prior Control's status, model pose, operation feedback,
  or task-frame selection while waiting for its own data.

## 10. State ownership

| State | Owner | Lifetime |
| --- | --- | --- |
| active route | router | application session and URL |
| sidebar collapsed state | shell presentation store | local preference |
| robot directory | global Pilot data service | Pilot server instance |
| per-Control latest status | global status store keyed by Control ID | connection generation |
| route Control | route parameter | robot-scoped page and browser history |
| preferred Control | Robot Dock presentation store | versioned local preference |
| Robot Dock mode | Robot Dock presentation store | versioned local preference |
| hold intent/projected target | Jogging operation session keyed by Control ID | pointer hold/page instance |
| pending/submitted operation | operation store keyed by request and Control ID | bounded application history |
| Home card render snapshot | Home view model | page instance, derived from global store |

No global singleton `RobotOperationSession` may mix joint state or pending motion between Controls.
Reusable services are multi-Control stores keyed explicitly by `control_id`; robot-specific
operation sessions remain isolated.

## 11. Responsive behavior

### Desktop

- The left panel is fixed and may be collapsed to an icon rail.
- The main page uses the remaining width.
- Home uses a multi-column card grid.
- The Robot Dock floats at bottom-right, grows leftward from a fixed right edge, and reserves no
  page-layout space.

### Tablet

- The left panel defaults to a narrower rail or collapsible panel.
- Home reduces card columns based on available content width.
- Jogging retains touch-sized hold controls.
- The Robot Dock keeps a bounded width and may use compact command labels.

### Phone

- The left panel becomes a left-side overlay drawer opened from the persistent header.
- Selecting a route closes the drawer and focuses the page heading.
- Home cards use one column.
- Jogging may stack dense panels; it is not required to preserve the desktop arrangement unchanged.
- The Robot Dock defaults to its collapsed selector-only presentation on first use and may expand
  into a compact overlay without becoming a page row.

Responsive mode changes presentation only. It does not create a separate mobile route or duplicate
business logic.

## 12. Navigation registry and future pages

Navigation entries are defined by one typed registry containing:

- stable route ID;
- label and icon;
- global or robot scope;
- route builder;
- implementation availability; and
- ordering/group metadata.

The registry is for navigation composition, not feature permissions or Pilot command authority.
Future implemented pages add one route and one registry entry without modifying the shell's
conditional layout tree.

## 13. Proposed source boundaries

```text
src/
  app/
    portal_app
    portal_router
    portal_shell
    navigation_registry
  shell/
    robot_dock
    robot_dock_state
    robot_route_selection
  pages/
    home/
      home_page
      robot_card
      robot_card_grid
    jogging/
      jogging_page
      jogging_operation_session
  api/pilot/
    pilot_client
    robot_directory
    robot_status_subscription
  stores/
    pilot_connection_store
    robot_directory_store
    robot_status_store
    operation_store
  domain/robot/
  providers/
  features/
```

Exact file extensions and frontend framework wiring are selected during implementation. Directory
and file names follow lowercase `snake_case`.

## 14. Implementation checkpoints

### Checkpoint N0: focused design

- Approve the shell, routes, Home cards, Control discovery adapter, and subscription strategy.
- Do not migrate runtime source in this checkpoint.

### Checkpoint N1: shell and deterministic routes

- Add the router, persistent shell, left navigation, Home route, Jogging route placeholder, and
  not-found route.
- Add deterministic route/navigation tests without Pilot or hardware.

### Checkpoint N2: Home directory and card grid

- Add the public-contract RobotDirectory adapter, normalized store, Home states, and cards.
- Validate one, many, empty, stale, and partially unavailable robots.

### Checkpoint N3: current UI decomposition

- Move the retained robot operation presentation into the explicit Jogging route.
- Bind selected Control identity from the route and prove robot switching isolates state.

### Checkpoint N4: bounded multi-robot subscriptions

- Add multiplexed latest status consumption, generation/gap recovery, Home render batching, and
  selected-Jogging detail consumption.
- Prove one slow/unavailable robot does not block other cards or the active Jogging page.

### Checkpoint N5: persistent Robot Dock

- Add route-aware preferred robot selection and the fixed bottom-right overlay.
- Add right-anchored expanded/collapsed modes; collapsed mode retains only robot selection.
- Move Servo, Fault Reset, and Brake presentation into the Dock while reusing the existing public
  operation runtime.
- Prove Control switching cancels page holds and isolates model, telemetry, command, and result state.

Detailed ordering and acceptance are defined by `src_shell_robot_dock_design.md`.

Later Camera, Policy, recorder, diagnostics, and settings pages receive separate focused designs and
checkpoints.

## 15. Validation plan

- route `/` resolves to Home;
- direct Jogging URLs restore the exact `control_id`;
- browser back/forward changes the page and robot without full reload;
- active navigation state and accessibility attributes match the route;
- one/many/empty/unavailable robot directories render deterministically;
- card state remains keyed to the correct Control across reorder and updates;
- clicking one card opens only that Control's Jogging page;
- selecting Home card space updates the Dock without leaving Home;
- changing the Dock selector preserves the Jogging/Operating page kind and leaves global Devices
  unchanged;
- route robot switching resets robot-specific operation and hold state;
- collapsed Dock exposes no command buttons, and Dock mode changes do not reflow the main content;
- Home card rendering does not mount per-robot Three.js scenes;
- multiplexed samples preserve independent stream generation and sequence handling;
- one robot's gap or failure does not invalidate unrelated cards;
- detail-page status does not create duplicate unbounded subscriptions; and
- phone drawer, tablet rail, and desktop panel navigate to identical route contracts.

Build and browser-based validation commands are selected with the frontend tooling checkpoint and
are not introduced by this design task.

## 16. Explicit exclusions

This design does not authorize:

- frontend runtime implementation or source migration;
- a new Pilot route or access to Pilot internals for robot discovery;
- synchronized multi-robot commands;
- one operation request that implicitly targets several Controls;
- per-card Camera payloads or Three.js robot canvases on Home;
- placeholder navigation for unimplemented pages; or
- changing the accepted continuous hold-to-run behavior.
