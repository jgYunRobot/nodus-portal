# Nodus Portal Frontend Detailed Architecture and Phased Implementation Design

## 1. Document status

- Date: 2026-08-07
- Status: draft for review; no implementation is authorized by this document alone.
- Upstream migration design: `src_nodus_portal_apps_web_ui_migration_design.md`
- Upstream navigation design: `src_nodus_portal_navigation_and_multi_robot_home_design.md`
- Focused Robot Dock design: `src_shell_robot_dock_design.md`
- Visual reference: [Sphere UI Charts UIKIT](https://dribbble.com/shots/23224018-Sphere-UI-Charts-UIKIT)
- Default visual mode: black theme.
- Source application reference: `/home/jgy/workspace/ai_work/pa_control/apps/web_ui`.

This document turns the two upstream product and migration designs into an implementable frontend
architecture, target file layout, technology baseline, visual system, and ordered checkpoints. The
upstream designs remain authoritative for feature ownership, public Pilot boundaries, multi-robot
navigation, and continuous hold-to-run behavior. If this document conflicts with either upstream
design, the upstream product decision wins until the documents are reconciled explicitly.

No source, dependency, asset, or build configuration is migrated merely by approving this design.
Each implementation checkpoint is separately reviewable and must preserve unrelated work.

## 2. Goals and non-goals

### 2.1 Goals

The implementation must:

- provide a standalone, typed React application owned entirely by `nodus-portal`;
- default to a near-black visual system inspired by the layout language of the Sphere reference;
- support black, light, and system theme preferences without a first-paint theme flash;
- implement a route-based left navigation shell, multi-robot Home, and robot-scoped Jogging page;
- provide a slightly translucent, bottom-right floating Robot Dock for persistent selection and
  shared Servo, Fault Reset, and Brake commands;
- consume only published Pilot HTTP, SSE, endpoint-directory, operation, and stream contracts;
- obtain Camera, Policy, and other high-bandwidth payloads directly from their owning providers;
- preserve the valuable robot model, jog, Camera, and Policy domain knowledge from the existing
  `pa_control/apps/web_ui` without preserving PA-CPU coupling or the monolithic application shape;
- isolate high-frequency RobotStatus delivery from ordinary React page state;
- preserve continuous hold-to-run with newest-status reconciliation and bounded request flow;
- be testable at contract, state, component, route, interaction, and browser levels; and
- allow additional robot-scoped and fleet-wide pages without rebuilding the shell.

### 2.2 Non-goals

The first implementation does not:

- copy the Sphere UIKIT, its assets, charts, typography, or component source;
- introduce decorative charts without an approved history or analytics requirement;
- make Portal a Pilot reverse proxy or payload relay;
- connect directly to Control IPC;
- restore PA-CPU as a Portal backend;
- claim server-enforced command authority while Pilot Phase B remains deferred;
- add repeated safety acknowledgement gates contrary to the accepted research deployment policy;
- turn all provider payloads into one global state object;
- enable React Server Components or require a Node server in production; or
- migrate Camera, Policy, recording, or MetaGate features before their checkpoint and public
  provider contracts are ready.

## 3. Design inputs and precedence

### 3.1 Upstream migration decisions

The migration design supplies the exact legacy inventory and feature disposition. In particular:

- Pilot is the Control-plane integration boundary;
- provider-owned data planes remain direct;
- `PaCpuClient`, `PaCpuPolicyControlClient`, `PilotBridge`, and repository-relative asset plugins do
  not move into Portal;
- robot model parsing, joint-state conversion, visualization, and interaction knowledge may be
  rewritten into Portal-owned modules; and
- joint jog, task jog, Home, and Ready remain continuous hold-to-run interactions.

### 3.2 Upstream navigation decisions

The navigation design supplies the product shell and initial route contract:

- `/home` is the default fleet overview;
- `/robots/:control_id/jogging` is the robot operation workspace;
- the left navigation persists across page changes;
- `control_id` is the route identity and never a display-label substitute; and
- Home uses bounded multi-Control status while Jogging may use the selected robot's detailed rate.
- The focused Robot Dock design defines the shell-wide selection preference, route-preserving robot
  switch transaction, overlay presentation, and shared command ownership.

### 3.3 Visual-reference interpretation

The Sphere reference is a light dashboard composition with a hierarchical left rail, broad page
canvas, large rounded cards, thin low-contrast borders, sparse chart surfaces, strong blue accents,
and generous whitespace. Portal translates that visual language rather than copying the artwork:

- the light background becomes a near-black canvas;
- white cards become charcoal surfaces with subtle elevation and borders;
- vivid blue remains the primary interactive accent;
- information is grouped into large, calm surfaces instead of many thin control boxes;
- status color is reserved for semantic meaning; and
- the interface retains the reference's spacing, hierarchy, and rounded geometry while meeting
  robotics readability and interaction requirements.

The reference is aesthetic direction, not a functional source of truth. Portal status density,
focus behavior, error states, and control feedback take precedence over decorative fidelity.

## 4. Technology baseline

Versions are recorded as supported release lines rather than permanently hard-coded patch numbers.
At each dependency checkpoint, use the latest patched release in the selected line, commit the
lockfile, and record the exact resolved versions. Do not silently perform a major dependency
upgrade during a feature checkpoint.

### 4.1 Runtime and package management

| Concern | Selection | Rationale |
| --- | --- | --- |
| JavaScript runtime | Node.js 24 LTS | Uses the maintained LTS line rather than Node 26 Current for reproducible development and CI. |
| Package manager | npm with committed `package-lock.json` | Matches the source application's existing workflow and avoids combining migration with a package-manager change. |
| Installation | `npm ci` in CI and validation | Enforces lockfile fidelity. |
| Application form | Static client-side SPA | Portal can be served by a static host and talks to public HTTP/SSE/provider endpoints directly. |

The Node release choice follows the official [Node.js release schedule](https://nodejs.org/en/about/previous-releases).
Production hosting must return `index.html` for unknown application routes while leaving `/api` and
provider paths under their actual owners.

### 4.2 Application framework and build

| Concern | Selection | Boundary |
| --- | --- | --- |
| UI | Latest patched React 19.2.x and matching React DOM | No React Server Components in the static Portal deployment. |
| Build/dev server | Latest supported Vite 8.1.x | Exact patch is locked during Checkpoint F1. |
| Language | Latest patched TypeScript 6.0.x in strict mode | Generated contracts and provider adapters remain typed at boundaries. |
| Routing | React Router 8 Data Mode | Route objects, nested layouts, errors, lazy page modules, and browser history without a framework server. |

The baseline follows the official [React 19.2 release](https://react.dev/blog/2025/10/01/react-19-2),
[Vite releases](https://vite.dev/releases), [Vite 8 announcement](https://vite.dev/blog/announcing-vite8),
[TypeScript 6.0 notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html),
and [React Router changelog](https://reactrouter.com/home/changelog). React Router Data Mode is
chosen over Framework Mode because Portal requires a static SPA, not server rendering or a React
Server Components deployment.

React Compiler is not enabled initially. The migration first establishes correct external-store,
Three.js, and hold-session behavior with explicit profiling evidence. Compiler adoption may be a
later isolated checkpoint after compatibility and bundle measurements.

### 4.3 Server state, streams, and generated contracts

| Data class | Owner in Portal | Technology |
| --- | --- | --- |
| Finite HTTP resources | Query cache | TanStack Query v5 |
| HTTP mutations | Feature service plus mutation wrapper | TanStack Query v5 only for lifecycle/error state, not as command authority |
| High-frequency RobotStatus/SSE | `PilotStreamHub` external store | Native `EventSource` or contract-required fetch stream plus `useSyncExternalStore` |
| Provider binary streams | Provider adapter | Provider protocol and renderer-owned buffer path |
| OpenAPI HTTP types | Generated contract module | `openapi-typescript` 7.x and a small typed fetch client |
| SSE/runtime payload trust | Explicit runtime guards | Handwritten narrow guards initially; schema validator only when schemas justify it |

[TanStack Query v5](https://tanstack.com/query/v5/docs/framework/react/overview) is used for
request/response server state such as Pilot health, components, endpoints, snapshots, and bounded
mutations. It is not used as a 60 Hz sample database. RobotStatus uses a single external store and
React's official [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)
API so components subscribe only to the selected immutable snapshot.

[`openapi-typescript` 7.x](https://openapi-ts.dev/introduction) generates compile-time HTTP types
from a pinned Pilot v1 OpenAPI artifact. Generated TypeScript is not runtime validation. SSE and
provider adapters must still reject malformed envelopes, unexpected stream identities, invalid
sequence values, and payloads that do not meet the narrow feature contract.

The released OpenAPI input and generated output are committed so Portal builds do not require a
sibling Pilot checkout or live network access. The pinned artifact records its upstream version or
commit and digest. Regeneration is an explicit command whose diff is reviewed.

### 4.4 Components, icons, visualization, and styling

| Concern | Selection | Rationale |
| --- | --- | --- |
| Accessible primitives | Selective Radix Primitives | Use only for Dialog, Popover, Tooltip, Select, and Dropdown behavior; Portal owns appearance. |
| Icons | Lucide React | Preserves the source application's clear, consistent icon language. |
| 3D robot view | Three.js, React Three Fiber, Drei, `urdf-loader` after compatibility spike | Retains proven domain behavior while isolating React 19 compatibility risk. |
| Styling | CSS Modules plus global CSS custom-property tokens and cascade layers | Stable, explicit, themeable styling without runtime CSS work. |
| Responsive composition | CSS Grid, Flexbox, and container queries | Components adapt to their actual card/page width rather than global viewport guesses. |

[Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction) supplies
unstyled accessible behavior only where native controls are insufficient. Portal does not adopt a
pre-styled component kit because the Sphere-inspired visual system and robotics states need
explicit semantic tokens.

CSS Modules are preferred over a utility-first migration and runtime CSS-in-JS. The current
`app.css` contains useful domain layout knowledge but is a 1,700-line global stylesheet. Splitting
it into tokens, foundations, and feature modules makes ownership visible, avoids class collisions,
and keeps high-frequency pages free of style-generation work. The design uses native
[CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties)
and [container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries).

No chart library is added in the foundation checkpoints. If real time-history requirements are
approved, first define sample count, refresh rate, interaction, accessibility, and bundle budgets;
then compare a canvas-oriented telemetry library such as uPlot with an SVG/canvas dashboard
library. A visual reference containing charts is not by itself a data requirement.

### 4.5 Testing and component development

| Level | Tool | Required evidence |
| --- | --- | --- |
| Pure domain and stores | Current stable Vitest | Target math, guards, reducers, cursors, retry and recovery behavior |
| React interaction | React Testing Library and `user-event` | Accessible names, keyboard/pointer behavior, theme, navigation, failure states |
| Component state catalog | Storybook 10.4 | Black/light states, loading/empty/degraded/error variants, responsive widths |
| Browser integration | Playwright current stable | Routes, reload recovery, SSE fixtures, hold release, screenshots, accessibility smoke |
| Contract fixture | Public HTTP/SSE black-box fixture | No imports from Pilot internals or sibling repository source |

The implementation follows official guidance from
[Vitest releases](https://main.vitest.dev/releases),
[React Testing Library](https://testing-library.com/docs/react-testing-library/intro/),
[Playwright release notes](https://playwright.dev/docs/release-notes), and
[Storybook 10.4](https://storybook.js.org/blog/storybook-10-4/). Exact versions are locked at the
checkpoint that introduces each tool.

ESLint flat configuration with TypeScript and React Hooks rules provides correctness checks;
Prettier provides deterministic frontend formatting. Configuration stays small and does not invent
repository-specific naming rules beyond `docs/agent_docs/coding_rules.md`.

## 5. Target repository layout

The first implementation uses one application package at repository root. A monorepo or shared UI
package is deferred until a second real consumer exists.

```text
nodus-portal/
├── contracts/
│   └── pilot/v1/
│       ├── openapi.yaml
│       └── PROVENANCE.md
├── public/
│   ├── portal_config.json
│   └── robots/e_rob/...
├── src/
│   ├── app/
│   │   ├── app.tsx
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   └── route_error_boundary.tsx
│   ├── api/pilot/
│   │   ├── generated/pilot_v1.ts
│   │   ├── pilot_http_client.ts
│   │   ├── pilot_event_stream.ts
│   │   ├── pilot_stream_hub.ts
│   │   ├── pilot_runtime_guards.ts
│   │   └── pilot_query_keys.ts
│   ├── components/
│   │   ├── actions/
│   │   ├── feedback/
│   │   ├── layout/
│   │   └── status/
│   ├── config/
│   │   ├── portal_config.ts
│   │   └── portal_config_schema.ts
│   ├── features/
│   │   ├── home/
│   │   ├── jogging/
│   │   ├── robot_status/
│   │   ├── robot_model/
│   │   ├── camera/
│   │   └── policy/
│   ├── pages/
│   │   ├── home_page.tsx
│   │   ├── jogging_page.tsx
│   │   └── not_found_page.tsx
│   ├── shell/
│   │   ├── portal_shell.tsx
│   │   ├── portal_sidebar.tsx
│   │   ├── portal_header.tsx
│   │   ├── robot_dock.tsx
│   │   ├── robot_dock.module.css
│   │   ├── robot_dock_state.ts
│   │   └── robot_route_selection.ts
│   ├── stores/
│   │   ├── robot_directory.ts
│   │   ├── robot_selection_store.ts
│   │   └── theme_store.ts
│   ├── styles/
│   │   ├── layers.css
│   │   ├── tokens.css
│   │   ├── themes.css
│   │   ├── base.css
│   │   └── motion.css
│   ├── test/
│   │   ├── fixtures/
│   │   └── setup.ts
│   └── main.tsx
├── e2e/
├── .storybook/
├── package.json
├── package-lock.json
├── tsconfig.json
└── vite.config.ts
```

Feature folders contain only feature-owned components, hooks, domain functions, and styles.
Cross-feature primitives move to `components/` only after two concrete uses. `pages/` compose
features and route parameters; they do not implement Pilot parsing or motion math.

## 6. Application composition and ownership

### 6.1 Bootstrap order

Portal starts in this deterministic order:

1. the inline bootstrap reads the versioned theme preference and sets `data-theme` on `<html>`;
2. `portal_config.json` is fetched and validated, with same-origin defaults if absent;
3. the Pilot client, query client, and stream hub are constructed once;
4. global providers mount;
5. the router resolves the initial URL; and
6. the active page subscribes only to the data it needs.

Configuration failure renders a bounded startup error with the invalid field and recovery action.
It never falls back to a guessed sibling port. Runtime configuration contains public endpoints and
display settings only; it is not a secret store.

### 6.2 Provider tree

The provider tree remains shallow:

```text
ThemeProvider
└── PortalRuntimeProvider
    └── QueryClientProvider
        └── RouterProvider
```

`PortalRuntimeProvider` exposes stable service references, not live RobotStatus objects. Theme
preference is presentation state. RobotStatus snapshots are read through selector hooks backed by
`PilotStreamHub`; putting them into general React Context would force unrelated consumers to
rerender at the stream rate.

### 6.3 Router

Initial route objects are:

```text
/
└── PortalShell
    ├── index                 -> redirect /home
    ├── home                  -> HomePage
    ├── robots/:control_id/
    │   ├── device            -> DevicePage
    │   ├── jogging           -> JoggingPage
    │   └── operating         -> OperatingPage
    └── *                     -> NotFoundPage
```

Page modules are lazy-loaded. The Three.js and URDF graph are imported only by the Jogging page,
not by Home or the shell. Future Camera, Policy, recordings, diagnostics, and settings routes join
this tree without changing the current route semantics.

Route error elements distinguish:

- invalid or unknown `control_id`;
- Pilot unavailable;
- known robot with no current status;
- provider unavailable; and
- application/contract error.

An unknown robot route is not silently redirected to the first robot because that could target the
wrong Control.

## 7. Theme and visual system

### 7.1 Theme contract

```ts
type ThemePreference = "black" | "light" | "system";
type ResolvedTheme = "black" | "light";
```

The default preference is `black`. The versioned local key is
`nodus_portal.theme.v1`. `system` follows `prefers-color-scheme`; dark resolves to black and light
resolves to light. Theme preference is local presentation state and is never sent through Pilot.

The `<html>` element owns `data-theme` and `color-scheme`. A small bootstrap script in `index.html`
applies the stored or default theme before the application stylesheet paints. Invalid stored values
fall back to black. Changes are persisted and announced with an accessible theme control.

### 7.2 Token layers

Tokens are split into three levels:

1. primitive values: palette, spacing, radii, type scale, shadow, and duration;
2. semantic values: canvas, surface, text, border, action, focus, success, warning, and danger; and
3. component values: sidebar width, card radius, control height, chart grid, and robot-scene surface.

Robot Dock component tokens include nearly opaque theme surfaces, fixed height, expanded/collapsed
width bounds, viewport insets, border, shadow, and overlay z-index. The black theme targets
approximately 94% surface opacity and the light theme approximately 96%; optional backdrop blur is
progressive enhancement rather than a legibility dependency.

Feature modules consume semantic or component tokens, never raw theme palette names. For example,
`--color-status-danger` is valid while `--red-500` is not a feature-level dependency.

### 7.3 Initial black palette

| Token | Value | Use |
| --- | --- | --- |
| `--color-canvas` | `#07080b` | Browser and page background |
| `--color-shell` | `#0b0d12` | Persistent shell/sidebar |
| `--color-surface` | `#11141a` | Primary cards and panels |
| `--color-surface-elevated` | `#171b23` | Menus, dialogs, selected groups |
| `--color-surface-soft` | `#1c212b` | Inputs and secondary rows |
| `--color-border` | `#272d38` | Default 1 px separation |
| `--color-border-strong` | `#3a4250` | Active and high-emphasis borders |
| `--color-text` | `#f5f7fa` | Primary text |
| `--color-text-muted` | `#9aa4b2` | Secondary labels |
| `--color-accent` | `#2f6bff` | Primary action and current selection |
| `--color-accent-hover` | `#4c80ff` | Hover/pressed emphasis |
| `--color-success` | `#41d48a` | Confirmed healthy/ready only |
| `--color-warning` | `#ffb84d` | Degraded or operator attention |
| `--color-danger` | `#ff626d` | Fault, stop, destructive intent |

Black surfaces use borders and small luminance steps instead of large drop shadows or neon glows.
Blue indicates navigation, focus, active controls, and selected data. Success/warning/danger colors
are not decorative accents.

### 7.4 Initial light palette

The light mode retains the reference's broad gray canvas and white cards:

| Token | Value |
| --- | --- |
| `--color-canvas` | `#edeff3` |
| `--color-shell` | `#f7f8fa` |
| `--color-surface` | `#ffffff` |
| `--color-surface-elevated` | `#ffffff` |
| `--color-surface-soft` | `#f4f5f7` |
| `--color-border` | `#dfe3e8` |
| `--color-text` | `#101116` |
| `--color-text-muted` | `#667080` |
| `--color-accent` | `#2f6bff` |

Semantic status colors are individually checked in both themes; light mode is not produced by a
global filter or color inversion.

### 7.5 Shape, spacing, and typography

- spacing scale: 4, 8, 12, 16, 24, 32, and 48 px;
- card radii: 20 px standard and 28 px for large overview/scene surfaces;
- compact control radius: 12 to 14 px;
- sidebar: 248 px expanded and 72 px collapsed on desktop;
- minimum pointer target: 44 by 44 px;
- card borders: 1 px; and
- transitions: 120 to 180 ms for color, background, border, and small transforms.

Use one self-hosted variable UI font with a system fallback. Manrope Variable is the initial visual
candidate because its geometric softness matches the reference; its license and actual asset are
verified before introduction. Telemetry values use tabular numerals and may use the platform
monospace stack where alignment materially helps. Portal never depends on a third-party font CDN
at runtime.

Motion respects `prefers-reduced-motion`. Status updates do not pulse continuously, charts do not
animate every incoming sample, and hold feedback remains readable without animation.

### 7.6 Shell composition

Desktop uses a black sidebar and a broad content canvas. The sidebar contains product identity,
fleet navigation, robot-scoped navigation, future feature groups, theme/settings access, and a
collapse control. Selection uses a subtle elevated background, blue icon/text, and a left marker.

Below the responsive breakpoint the sidebar becomes a focus-managed drawer. The current page title,
selected robot, Pilot connection summary, and high-priority fault indicator remain in the header.
Main content owns independent scrolling; navigation does not jump when a card updates.

The persistent Robot Dock is fixed above the bottom-right page content and is not a shell grid row.
No Dock-sized bottom padding, spacer, or content-height subtraction is added. Its right edge remains
fixed and its expanded command surface grows leftward. Collapsing it leaves only robot selection and
the expand affordance; hidden commands are not focusable. The Dock therefore changes neither the
main-content dimensions nor scroll position.

### 7.7 Home composition

Home uses a responsive `repeat(auto-fit, minmax(280px, 1fr))` card grid. Each robot card presents:

- display name and stable `control_id`;
- connection/freshness state;
- concise servo, brake, fault, and operation summary supported by the latest status;
- last accepted update time;
- an optional small, non-authoritative visual summary only when data exists; and
- one explicit `Open Jogging` action.

Clicking non-interactive card space may update the Dock's preferred Control while Home remains the
active route. The explicit action still opens that exact Control and never relies on array order.

Cards use large quiet surfaces and clear vertical rhythm. Offline, never-seen, stale, malformed,
and healthy states have dedicated variants. Home does not render the URDF scene for every robot.

### 7.8 Jogging composition

Jogging starts from the existing web UI's proven functional groups but does not preserve its dense
single-page grid. The first desktop layout contains:

- a large robot-scene card;
- an operation/status summary strip;
- joint/task jog cards;
- reset-origin and Jogging-specific lifecycle cards; and
- a bounded event/activity panel.

Servo On/Off, Fault Reset, and Brake Release/Engage are rendered once by the persistent Robot Dock,
not duplicated inside Jogging. Changing the Dock selector replaces only the route Control ID, so the
Jogging workspace remounts its model/profile, RobotStatus detail, real-time values, and operation
session for the destination Control.

Controls remain visually stable while values update. A current command, pending acknowledgement,
degraded stream, and Control-reported state are distinct visual states. Camera and Policy panels
later become route-owned or feature-owned surfaces rather than rebuilding a universal dashboard.
Command disposition and recovery information share one fixed-height Jogging status panel so a
transient recovery state does not insert content above the controls or resize the operation card.

## 8. Data architecture

### 8.1 Runtime configuration

`public/portal_config.json` supports only validated public configuration:

```json
{
  "pilotBaseUrl": "same-origin",
  "portalLabel": "Nodus Portal"
}
```

Same-origin is the production default. Development may use a Vite proxy to Pilot so browser CORS
behavior remains explicit and no production URL is compiled into source. Provider endpoints are
discovered through Pilot metadata and are not permanently copied into this config.

### 8.2 Pilot HTTP client

The HTTP layer has one configured base URL, request timeout policy, normalized error model, and
generated request/response types. It does not expose raw `fetch` throughout features. Errors retain:

- HTTP status;
- contract error code/message when present;
- request correlation evidence when public;
- endpoint and method without secret query content; and
- retryability classification.

Retries are bounded and method-aware. Mutating operation requests are not blindly replayed by a
generic query retry policy. Features use stable query keys that include relevant `control_id`,
component ID, endpoint generation, or publication identity.

### 8.3 Pilot stream hub

One `PilotStreamHub` owns public sample-stream subscriptions for the browser runtime. Canonical
RobotStatus state is isolated per `(control_id, stream_kind)` and includes:

- latest accepted decoded payload;
- latest server timestamp and local receive time;
- publication identity and generation;
- sequence/cursor evidence;
- freshness classification;
- connection/recovery state; and
- last bounded error.

The hub exposes `subscribe(key, listener)` and `getSnapshot(key)` for
`useSyncExternalStore`. Snapshots are referentially stable when their selected data has not changed.
Home selectors derive small card views; Jogging selectors receive the detailed selected robot
snapshot. No global ordering is inferred across different Controls.

The hub re-queries metadata and snapshots after lifecycle events, sequence gaps, retained-record
gaps, publication/generation changes, or Pilot restart/server-instance changes. Reconnection uses
bounded exponential backoff with jitter and never creates a second live subscription for the same
canonical key.

### 8.4 Update scheduling

Incoming records are validated immediately but visual publication may be coalesced to one update
per animation frame for Home cards. Motion/hold logic reads the newest accepted store snapshot,
not the last painted React value. This distinction prevents UI scheduling from making command
targets stale.

The store does not retain unbounded telemetry history. Any future chart owns a bounded ring buffer
with an explicit sample/rate/memory budget and is separate from the canonical latest snapshot.

### 8.5 Robot directory

`RobotDirectory` is an adapter over public Pilot discovery evidence. The first implementation
derives robots from published RobotStatus stream descriptors as defined by the navigation design.
It returns stable records keyed by `control_id` and hides that temporary discovery mechanism from
Home and navigation. A future explicit Pilot Control catalog replaces the adapter implementation,
not every consumer.

### 8.6 Provider integrations

Pilot provides lifecycle, endpoint metadata, and operation routing. Camera point clouds, video, and
future Policy/recorder high-bandwidth data connect directly to advertised provider endpoints.
Provider adapters own protocol parsing, cancellation, backpressure, and cleanup. Page components
receive typed view models rather than raw WebSocket or binary buffers.

Page exit and route changes release page-owned resources. Global Pilot discovery and bounded Home
status may survive navigation. Camera render loops, object URLs, binary buffers, and Policy leases
do not.

## 9. Motion and hold-to-run architecture

### 9.1 Separation of concerns

Jogging motion is split into:

- `RobotStatusAdapter`: validates/converts authoritative status to domain units;
- `JogTargetProjector`: pure speed- and elapsed-time target calculation;
- `HoldSession`: pointer/keyboard lifecycle and monotonic timing;
- `OperationScheduler`: one in-flight operation and newest-target coalescing;
- `PilotOperationClient`: public operation request/response transport; and
- presentation components: render controls and feedback without owning target math.

### 9.2 Continuous target calculation

Every scheduling tick reads the newest accepted authoritative RobotStatus directly from the stream
store. It also maintains the previously acknowledged or projected target. The next target is based
on speed and elapsed monotonic time, reconciled so delayed status cannot move the target backward or
repeat one stale delta indefinitely.

Conceptually:

```text
authoritative = newest accepted Control position
projected     = previous projected target advanced by speed * elapsed
base          = reconcile(authoritative, projected, direction, tolerance)
next target   = base advanced by speed * scheduling horizon
```

Exact reconciliation tolerance, maximum horizon, per-joint/task limits, and Control command shape
come from the released operation contract and targeted tests. They are named configuration/domain
constants, not JSX literals.

### 9.3 Backpressure and stop behavior

Only one mutating operation is in flight per selected Control. While it is in flight, new ticks
replace one pending target rather than growing a queue. On acknowledgement, the scheduler sends the
newest pending target if the hold remains active.

Release, pointer cancellation, window blur, visibility loss, route exit, component unmount,
Control change, stream generation change, malformed/stale status, or terminal operation failure
ends the local hold immediately and clears pending work. No new target is emitted after local
release. Where the public operation contract provides an explicit stop/cancel behavior, the client
uses it; Portal does not invent an acknowledgement that the server did not provide.

Pointer capture provides reliable pointer-up behavior. Keyboard activation ignores key repeat and
uses key-down/key-up lifecycle. Buttons expose pressed and unavailable state accessibly. Home and
Ready use the same hold engine with their own target provider; they are not converted to one-shot
buttons.

## 10. Migration mapping from `pa_control/apps/web_ui`

| Existing source | Portal disposition | Target owner |
| --- | --- | --- |
| `src/app.tsx` | Do not copy; decompose behavior | shell, pages, runtime services, feature modules |
| `src/styles/app.css` | Extract visual knowledge; rewrite | `src/styles` and feature CSS Modules |
| `src/lib/theme_session.ts` | Replace two-state memory-only model | persistent black/light/system `theme_store.ts` |
| `src/components/robot_scene.tsx` | Retain behavior through compatibility rewrite | `features/robot_model` and Jogging |
| `src/lib/robot_model*.ts` | Retain domain parsing/loading; remove sibling paths | Portal-owned robot assets and repository |
| `src/lib/joint_state.ts` | Retain tested unit/target knowledge; use public types | `features/robot_status` and `features/jogging/domain` |
| `src/lib/robot_operation_session.ts` | Split; remove bridge and stale-render ownership | adapter, projector, hold session, scheduler, operation client |
| jog/task/command panels | Split shared Servo/Fault/Brake into Robot Dock; keep hold and page-specific actions in Jogging | `shell/robot_dock` and `features/jogging/components` |
| Camera components/config | Defer; retain renderer/config knowledge | `features/camera` direct provider adapter |
| Policy components/contracts | Defer; retain presentation states only | `features/policy` public provider contract |
| `src/lib/pa_cpu_client.ts` | Exclude | no Portal equivalent |
| `src/lib/pilot_bridge.ts` | Exclude | typed Pilot services replace it |
| `src/lib/pa_cpu_policy_control_client.ts` | Exclude | direct Policy/provider adapter later |
| mock Policy production path | Exclude; fixtures may be test-only | `src/test/fixtures` |
| repository-relative Vite asset plugin | Exclude | explicit Portal assets and normal Vite handling |

Migration is behavior-led, not file-copy-led. Each retained module first receives characterization
tests for valuable pure behavior, then is rewritten behind Portal contracts. PA-CONTROL remains
read-only throughout.

## 11. Accessibility, resilience, and performance budgets

### 11.1 Accessibility

- text and controls meet WCAG 2.2 AA contrast in black and light themes;
- focus is always visible with a 2 px high-contrast ring and offset;
- navigation uses landmarks and `aria-current`;
- dialogs/drawers trap and restore focus through tested primitives;
- color is never the sole status signal;
- icon-only controls have stable accessible names;
- the Robot Dock selector and expand/collapse control remain keyboard reachable in both modes;
- collapsed Dock command controls are unmounted or inert rather than visually hidden only;
- live regions announce connection/fault changes without narrating every telemetry sample;
- all hold controls support pointer and keyboard release semantics; and
- reduced motion removes nonessential animation.

### 11.2 Resilience states

Every data-driven surface defines loading, empty, stale, reconnecting, malformed, unavailable, and
permission/operation failure states. The last valid value may remain visible when marked stale; it
must not be shown as current. Errors are localized so one provider or robot does not blank the
whole shell.

### 11.3 Performance boundaries

- Home and shell initial bundles do not include Three.js, Drei, URDF Loader, or Camera renderers;
- a RobotStatus update rerenders only subscribers whose selected view changed;
- Home card visual publication is capped to the browser frame rate;
- event and telemetry histories are bounded;
- provider binary buffers are released on replacement/unmount;
- route and feature bundles have recorded size deltas at their checkpoint; and
- browser performance profiles verify the chosen multi-robot fixture before claiming capacity.

No unsupported fixed robot-count claim is made in design. Checkpoint F7 establishes the first
measured fixture and reports hardware, browser, sample rates, and resulting frame/update behavior.

## 12. Phased implementation plan

Each checkpoint ends with a focused diff, validation evidence, progress-log update, and review.
Later checkpoints do not begin by assumption when an earlier acceptance condition is unresolved.

### F0 - Design approval and baseline capture

**Work**

- review this document together with both upstream designs;
- record the current PA-CONTROL `apps/web_ui` revision and Portal base commit;
- confirm the published Pilot v1 OpenAPI and public stream/operation artifact versions;
- capture screenshots or behavior notes for the legacy UI features being retained; and
- resolve any open product decision that changes route, theme, or provider ownership.

**Validation and exit**

- no runtime files change;
- all referenced contracts have stable provenance; and
- the user approves implementation start and F1 scope explicitly.

### F1 - Standalone frontend foundation

**Work**

- add Node/npm metadata, React, Vite, TypeScript, ESLint, and Prettier;
- create the smallest static application bootstrap and production build;
- add validated runtime configuration with same-origin default and development proxy;
- create CI-ready `typecheck`, `lint`, `format:check`, `test`, and `build` scripts; and
- add a static-host route fallback note/config example.

**Validation and exit**

- clean `npm ci` from the lockfile;
- typecheck, lint, unit-test harness, and production build pass;
- built output has no sibling repository path or PA-CPU reference; and
- the page contains only a neutral bootstrap surface, not migrated product UI.

### F2 - Theme tokens and component foundations

**Work**

- implement black/light/system preference with pre-paint bootstrap and persistence;
- add primitive, semantic, and component token layers;
- create typography, focus, motion, button, card, badge, tooltip, menu, drawer, skeleton, and error
  foundations;
- introduce selective Radix and Lucide dependencies;
- add Storybook with both themes and responsive viewports; and
- document the Sphere translation with Portal-owned examples.

**Validation and exit**

- black is the first-render and default theme with no visible flash;
- theme survives reload and system-mode media changes;
- keyboard focus, contrast, reduced motion, and 44 px targets are verified;
- Storybook covers base component states in both themes; and
- no robot or Pilot feature is introduced.

### F3 - Route shell and navigation

**Work**

- implement the React Router route tree and lazy page boundaries;
- add persistent sidebar, header, responsive drawer, error boundary, and not-found page;
- implement deterministic `/` to `/home` redirect;
- provide empty-state Home and route-parameter Jogging placeholders; and
- add theme control in the shell.

**Validation and exit**

- direct navigation, reload, back/forward, and unknown route behavior pass in Playwright;
- mobile drawer focus opens/closes/restores correctly;
- Three.js is absent from the Home/shell bundle; and
- URLs match the navigation design exactly.

### F4 - Pilot contract and finite HTTP client

**Work**

- pin the released Pilot v1 OpenAPI artifact with provenance/digest;
- generate and commit TypeScript HTTP types;
- implement configuration, normalized errors, query keys, and finite HTTP resources;
- add health, components, endpoints, and bounded snapshot queries required by the next checkpoint;
- add contract regeneration/check scripts; and
- create public black-box HTTP fixtures without Pilot internal imports.

**Validation and exit**

- generated output is reproducible with no unreviewed diff;
- invalid runtime config and malformed HTTP payload states are covered;
- retries do not replay mutating requests generically;
- no direct Control/UDS or PA-CPU dependency exists; and
- public fixture tests pass against the pinned contract.

### F5 - Stream hub and recovery

**Work**

- implement runtime guards, envelope parsing, cursor/generation evidence, and per-Control stores;
- expose selector subscriptions through `useSyncExternalStore`;
- add metadata refresh and snapshot recovery for gaps, restarts, and generation changes;
- add bounded backoff, duplicate-subscription prevention, and cleanup; and
- create deterministic multi-Control/gap/restart fixtures.

**Validation and exit**

- latest status is isolated per `(control_id, stream_kind)`;
- no cross-Control ordering is claimed or used;
- gaps and generation/server-instance changes cause explicit recovery;
- stale/malformed states remain distinguishable; and
- subscription and listener counts return to baseline after unmount/reconnect tests.

### F6 - Robot directory and multi-robot Home

**Work**

- implement the replaceable `RobotDirectory` adapter over public stream descriptors;
- create Home card view models and all card states;
- subscribe to bounded multi-Control summaries;
- implement responsive grid, sorting stability, update-time presentation, and `Open Jogging` links;
- add representative one-, many-, offline-, stale-, and malformed-robot stories/tests; and
- verify that Home loads no robot 3D bundle.

**Validation and exit**

- cards are keyed and routed by `control_id`;
- display labels never replace stable identity;
- individual robot failure does not blank the fleet;
- updates do not reorder cards without an explicit sort change; and
- multi-robot browser/profile evidence is recorded.

### F7 - Jogging presentation and robot visualization

**Work**

- characterize valuable pure robot-model and joint-state behavior in PA-CONTROL read-only source;
- perform a React 19/Three/R3F/Drei/URDF Loader compatibility spike;
- move required robot assets into Portal with provenance and explicit paths;
- implement selected-robot status adapter, scene, status strip, and non-mutating Jogging cards;
- lazy-load the visualization graph; and
- add cleanup for animation frames, loaders, buffers, and route changes.

**Validation and exit**

- known URDF/model/joint conversions match characterized behavior;
- assets resolve in development and production builds without sibling paths;
- unknown/missing model and stale status are bounded UI states;
- Home bundle remains free of visualization dependencies; and
- repeated Jogging entry/exit does not leak render loops or resources.

### F8 - Pilot operations and continuous hold-to-run

**Work**

- implement typed public Pilot operation requests and response/error mapping;
- add pure projector, HoldSession, and one-in-flight newest-target scheduler;
- bind joint jog, task jog, Home, Ready, and other approved command controls;
- reconcile every target with the newest accepted authoritative status;
- implement pointer capture, keyboard lifecycle, blur/visibility/route cleanup; and
- expose factual pending/accepted/failed/degraded states without claiming Phase B authority.

**Validation and exit**

- speed and elapsed time produce expected targets under deterministic clocks;
- delayed status does not repeat an identical stale delta or move projection backward incorrectly;
- slow acknowledgements produce at most one in-flight and one coalesced pending target;
- all release/cancel paths stop local emission;
- no click-once fixed-distance replacement appears; and
- public Pilot black-box operation fixtures pass.

### F8D - Persistent Robot Dock retrofit

**Work**

- add versioned preferred-Control and Dock expanded/collapsed presentation state;
- implement effective route/preference selection and page-kind-preserving robot navigation;
- add the fixed bottom-right, slightly translucent overlay without page-layout reservation;
- move Servo On/Off, Fault Reset, and Brake Release/Engage into the Dock without creating another
  Pilot component session or operation queue;
- cancel local holds and drop unsent targets before Control replacement; and
- remount robot-scoped model, telemetry, and operation state by destination `control_id`.

**Validation and exit**

- Home selection no longer requires entering Jogging and sidebar routes use the selected Control;
- Jogging robot changes update URL, model/profile, status, real-time values, and operation ownership
  together;
- no prior-Control value or result is presented under the destination identity;
- collapsed mode exposes only robot selection and the expand control;
- expand/collapse causes no main-content reflow or scroll jump;
- black/light surfaces remain legible over representative page content; and
- direct URL, reload, back/forward, stale/offline selection, hold cancellation, and command targeting
  pass without physical hardware motion.

### F9 - Camera integration

**Work**

- define the Camera provider contract and endpoint metadata consumption;
- migrate Camera configuration and rendering knowledge behind a direct provider adapter;
- add explicit lifecycle, preview, ROI/depth, point-cloud, cancellation, and resource ownership;
- place Camera in its approved route/surface without expanding Jogging indiscriminately; and
- isolate binary buffers from query and RobotStatus stores.

**Validation and exit**

- Pilot carries metadata/lifecycle only, not provider payload bytes;
- point-cloud/video cleanup is verified on route change and provider loss;
- invalid metadata/protocol frames are bounded; and
- Camera failure does not interrupt Pilot status or Jogging.

### F10 - Policy, recording, and later providers

**Work**

- repeat the provider-boundary process for Policy and recording only after public contracts exist;
- retain useful presentation states while removing PA-CPU-specific route assumptions;
- keep mock providers in test/story fixtures only; and
- add future navigation entries through the existing shell.

**Validation and exit**

- each provider has independent discovery, lifecycle, payload, cleanup, and failure tests;
- no global aggregate event/client object reappears; and
- unavailable optional providers do not degrade unrelated pages.

### F11 - Deployment, accessibility, and performance acceptance

**Work**

- define the production static-host artifact and route fallback;
- run dependency, type, lint, unit, component, public-contract, and browser suites;
- audit both themes, keyboard flow, screen-reader landmarks, contrast, and reduced motion;
- measure route bundles, Home multi-robot updates, Jogging render behavior, and resource cleanup;
- document runtime configuration and same-origin/development proxy deployment; and
- record known limitations without presenting the research deployment as production acceptance.

**Validation and exit**

- all documented validations pass or have explicit user-approved exceptions;
- exact versions, test environments, fixture scale, and performance measurements are recorded;
- clean installation and build work without PA-CONTROL or sibling repositories; and
- progress and deployment documentation identify remaining Camera/Policy/Phase B/production work.

## 13. Checkpoint dependency graph

```text
F0 Design approval
 └─ F1 Frontend foundation
     └─ F2 Theme and primitives
         └─ F3 Shell and routes
             └─ F4 Pilot HTTP contracts
                 └─ F5 Stream hub
                     ├─ F6 Home
                     └─ F7 Jogging visualization
                         └─ F8 Operations and hold-to-run
                             └─ F8D Persistent Robot Dock
                                 ├─ F9 Camera
                                 ├─ F10 Policy and recording
                                 └─ F11 Acceptance after F9/F10
```

F6 and the non-mutating part of F7 may proceed in parallel only after F5 is accepted and only when
their files and owners do not overlap. F8 never starts before the selected-status path is proven.
F8D reuses the accepted F8 operation runtime and does not begin by creating a second session or
scheduler.
Provider checkpoints do not block the core Home/Jogging release unless the user explicitly makes
them release requirements.

## 14. Review and commit policy

- one checkpoint should normally produce one focused Conventional Commit;
- generated contract changes are reviewed with their provenance and generator version;
- dependency upgrades are separated from feature behavior when practical;
- tests must not import unpublished Pilot internals or PA-CONTROL source;
- PA-CONTROL remains read-only and no submodule is changed incidentally;
- no intentionally failing test is committed as completion evidence;
- `docs/progress.md` records change summary, result, validation, and next checkpoint; and
- pushing or opening a pull request requires an explicit user request.

## 15. Open decisions before implementation

The following are deliberately resolved at the named checkpoint rather than guessed now:

- F1: exact patched dependency versions and supported browser matrix;
- F2: final self-hosted font after license and rendering comparison;
- F4: exact released Pilot OpenAPI artifact version/digest;
- F7: React 19-compatible Three/R3F/Drei/URDF Loader version set and robot asset provenance;
- F8: contract-derived reconciliation tolerances, maximum scheduling horizon, and explicit stop
  semantics; and
- F9/F10: provider protocol versions and final route placement.

These choices may refine implementation details but must not reverse the accepted black-default
theme, route identities, public integration boundaries, multi-robot architecture, or continuous
hold-to-run product decision without an explicit design update.
