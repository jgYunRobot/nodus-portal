# Nodus Portal Device Page Design

## 1. Document status

- Date: 2026-08-08
- Status: approved product direction; implementation not started by this document
- Owner: `src/pages/device_page`
- Related designs:
  - `src_nodus_portal_camera_device_integration_interim_design.md`
  - `src_nodus_portal_navigation_and_multi_robot_home_design.md`
  - `src_shell_robot_dock_design.md`
  - `src_nodus_portal_frontend_detailed_architecture_and_phased_implementation_design.md`
- Scope: global device discovery, overlapping card-deck navigation, device information, capability-
  driven settings, Camera preview, and Operator presentation

This document supersedes the former robot-scoped Device page that displayed RobotStatus. It does
not approve implementation or invent provider settings APIs that have not been released.

## 2. Accepted product direction

- Device is a global page for external components connected through Pilot, not a robot-status page.
- Robot type, DOF, Servo, Brake, and RobotStatus age are removed from Device.
- The page remains accessible when no Control or robot is connected.
- One logical device is represented by one card.
- The deck always contains at least five card slots. Connected devices fill those slots first,
  unused slots remain visible as empty cards, and additional cards are appended when more than five
  devices are connected.
- Cards overlap as a navigable deck. The operator swipes, clicks, or uses keyboard controls to bring
  the desired device card to the front.
- The active card presents that device's identity, health, information, available views, and
  settings supported by its public provider contract.
- A Camera card presents its color image and, when advertised, its depth image.
- Nodus Operator is a device. Its current Pilot component type is `input_source`, but Portal presents
  it as an Operator when a future public identity contract provides that classification.
- Inactive cards do not retain live video, query loops, writable forms, or operation controls.
- Device capability determines visible features. Portal never guesses a provider route or displays
  a setting merely because another device type supports it.

## 3. Goals and non-goals

### 3.1 Goals

- provide one place to discover and inspect supported Camera, Operator, and later provider devices;
- make device selection visual and touch-friendly without reducing keyboard or direct-link access;
- keep device identity stable across Pilot endpoint refresh and provider session replacement;
- show only capabilities proven by published contracts and current endpoint descriptors;
- isolate failures and drafts per device;
- release Camera streams and other device resources promptly on card change or page exit; and
- preserve the existing Pilot metadata/direct-provider payload boundary.

### 3.2 Non-goals

- displaying robot status or making the selected Robot Dock Control the Device page owner;
- treating Control, a robot model, or every Pilot component as a configurable device;
- relaying Camera or Operator provider payloads through Pilot;
- connecting Portal to Control IPC;
- inventing Camera or Operator write APIs;
- starting multiple background MJPEG streams for decorative stacked cards;
- treating the Portal's own `ui` lifecycle component as a user-managed device; or
- coordinating recording, dataset ownership, or process supervision before their separate
  contracts are approved.

## 4. Route and shell behavior

### 4.1 Global route

Device moves from `/robots/:control_id/device` to the global route:

```text
/devices?device=<component_id>
```

The optional query value identifies the logical selected device. Query encoding is used so device
identities do not become unvalidated path structure. The stable `component_id` is the presentation
identity; `instance_id`, session generation, and catalog generation identify the current runtime
behind that logical device.

- On initial `/devices` entry, the page selects the first connected device in stable directory order
  for presentation only. If no device is connected, it presents the first empty slot without adding
  a device query value. A user may subsequently navigate to another empty slot in page-local state.
- A user selection updates the query and browser history.
- Direct links, reload, and back/forward restore the requested device.
- An unknown or authoritatively removed query identity clears the stale `device` query with replace
  navigation and selects the first available empty slot. If five or more live devices leave no
  empty slot, it selects the first live card without submitting any device operation.
- The legacy `/robots/:control_id/device` route redirects to `/devices` without retaining the
  Control identity.

Selecting another robot in the persistent Robot Dock does not change the Device URL, selected
device, card draft, or Camera stream. The Dock remains a shell-owned overlay under its existing
design, but the Device page does not subscribe to RobotStatus.

### 4.2 Navigation

The expanded sidebar groups entries as:

```text
Portal
  Home
  Devices

Robot
  Jogging
  Operating
```

`Devices` is enabled even when RobotDirectory is empty. Only robot-scoped Jogging and Operating
depend on the selected Control.

The shell header labels the route `Device directory`; it does not display a Control identity as the
page context.

## 5. Device directory model

### 5.1 Sources

Portal builds the directory by joining public Pilot data:

- component lifecycle records provide component identity, type, state, instance, and session
  generation;
- endpoint-directory records provide catalog generation and exact provider descriptors; and
- provider health and metadata are fetched directly only for the active card.

Endpoint pagination must be exhausted before the joined directory is considered complete. Portal
re-queries the directory after catalog publication/removal, Pilot server replacement, lifecycle
generation change, a retained-event gap, or a direct provider failure that may indicate a stale
descriptor. One Device-page refresh owner listens to the public Pilot event stream, coalesces
relevant lifecycle/catalog invalidations, and uses bounded low-rate polling as fallback for event
loss, SSE capacity exhaustion, or Pilot restart.

### 5.2 Inclusion policy

The initial card registry includes:

| Pilot component type | Portal card |
|---|---|
| `camera` | Camera adapter when the Vision contract matches; generic read-only card otherwise |
| `input_source` | Operator/input-source adapter when its public contract matches; generic read-only card otherwise |
| `policy` | Generic read-only card until a Policy card design and contract are approved |
| approved future provider type | Registered adapter or generic read-only card |

The default directory excludes `ui`, `observer`, and internal service components unless a later
design explicitly registers a user-manageable adapter for them. This prevents Portal itself from
appearing as a Device card merely because it maintains a Pilot lifecycle session.

### 5.3 Identity and ordering

The logical card key is `component_id`. Runtime state is additionally qualified by:

- `instance_id`;
- component session generation;
- endpoint catalog generation; and
- Pilot server-instance identity.

A generation change replaces the active runtime inside the same logical card. Old health,
metadata, endpoint URLs, pending writes, errors, and media resources are discarded before the new
runtime is shown.

Cards use deterministic ordering by normalized display name and then `component_id`. Directory
refresh does not reorder equal live identities based on response arrival time. The selected card
remains selected across unrelated additions or removals.

### 5.4 Minimum five-slot deck

The presentation deck is built from a slot count of:

```text
max(5, connected_device_count)
```

- Connected devices occupy the leading slots in deterministic directory order.
- When fewer than five devices are connected, the remaining slots render explicit empty cards.
- When a sixth or later device connects, one card is appended per additional device; no connected
  device is hidden to preserve the five-card appearance.
- When the count falls back below five, the deck returns to five total slots and exposes enough
  empty cards to make up the difference.
- Empty slots are presentation placeholders, not Pilot components. They have no `component_id`,
  endpoint, provider query, settings draft, health poll, or lifecycle state.
- Empty cards participate in swipe, picker, Previous/Next, and keyboard navigation so the stacked
  five-card shape remains real and predictable, but their bodies contain no interactive device
  controls.
- A connected device never inherits state from the empty slot it replaces. The device card mounts
  from its own current component/session/catalog identity.

The picker labels empty entries as `Empty slot 1`, `Empty slot 2`, and so on after the connected
device entries. Empty slot identities are local deck indices and are never written into the URL.
If a new connection fills the currently active empty slot, the placeholder is replaced in place and
the new device initializes from empty state. Directory refresh continues to preserve any selected
real device by `component_id`, not by its former numeric slot.

## 6. Overlapping card-deck interaction

### 6.1 Visual model

The deck uses CSS layout and transforms, not a canvas or WebGL scene.

```text
                 2 / 5       [device picker]

           +--------------------------------+
       +---|                                |---+
   +---|   |       active device card       |   |---+
   |   |   |                                |   |   |
   +---|   +--------------------------------+   |---+
       +----------------------------------------+

             Previous                 Next
```

- the active card is frontmost, full-scale, and visually opaque;
- up to two previous and two next cards may appear as progressively offset, scaled, and dimmed
  layers;
- with zero connected devices, five empty cards still form the same visible stack;
- a visible inactive card edge may be selected directly;
- deck height follows a stable responsive card frame rather than each card's latest payload;
- status or preview changes never alter stack positioning; and
- reduced-motion mode replaces animated travel with an immediate crossfade/state change.

The overlap is a navigation affordance, not a way to operate several devices at once.

### 6.2 Input methods

Equivalent selection is available through:

- horizontal swipe or pointer drag on non-interactive card space;
- Previous and Next buttons;
- Left and Right Arrow while focus is in the deck navigation region;
- clicking a visible adjacent card edge; and
- a device picker that directly selects any device when the deck becomes large.

Horizontal dragging does not start from buttons, links, text fields, selects, sliders, image ROI
tools, or scrollable setting regions. A movement threshold separates click from swipe. Touch
behavior preserves vertical page/card scrolling and avoids taking over the browser's edge-back
gesture.

### 6.3 Accessibility

- The deck is labelled as a device carousel region.
- The active card announces device name, type, position, and connection state.
- Inactive cards are `inert` and excluded from the tab order; decorative duplicate content is
  hidden from assistive technology.
- Selection never moves focus into a hidden card. After explicit Previous/Next navigation, focus
  remains on the navigation control unless the user enters the active card.
- The picker provides a non-gesture path to every device.
- Status is never communicated by color alone.

## 7. Common active-card structure

Every supported card follows the same high-level frame while allowing a type-specific workspace:

1. **Header**
   - device icon and display name;
   - type label such as `Camera` or `Operator`;
   - online, stale, recovering, offline, or incompatible status;
   - concise `component_id`; and
   - deck position.
2. **Primary workspace**
   - type-specific media, live state, or primary device function.
3. **Information**
   - public identity, software/provider version, capabilities, runtime instance, and last update;
   - provider-specific sanitized metadata; and
   - optional attachment/frame information as descriptive metadata only.
4. **Settings**
   - provider-authoritative editable settings only when an exact versioned read/write contract is
     available;
   - otherwise a clear `Read-only information` state, not disabled fabricated controls.
5. **Diagnostics disclosure**
   - endpoint generation, schema/media matches, direct connection error, and recovery state for
     debugging without dominating the normal view.

The card header and navigation frame remain stable while the workspace loads or recovers. A
provider error appears inside the card and does not resize or replace the entire Device page.

## 8. Camera card

### 8.1 Capability binding

The Camera adapter selects each function by exact component identity, capability, contract
version, schema identity, and media type. It does not bind the first endpoint containing the word
`camera`.

The active Camera card can present:

- provider and capture health;
- sanitized metadata;
- color MJPEG when `camera.stream.color.preview` matches;
- depth MJPEG when `camera.stream.depth.preview` matches;
- color/depth snapshots as recovery or explicit capture actions;
- mount and sensor frame information; and
- later ROI, pixel-to-point, and point-cloud tools behind their exact capabilities.

### 8.2 Image layout

On desktop and wide tablets:

- color is the primary image;
- depth appears beside it when available; and
- a Camera without depth uses the full media width without an empty placeholder.

On narrow tablets and phones:

- Color and Depth use an internal segmented view;
- switching the segment starts the selected stream and releases the hidden one; and
- a Camera with only color has no Depth segment.

Only the active Camera card owns live streams. Inactive stacked cards render a non-live poster,
device icon, or cached snapshot that is safe to retain. They never keep hidden MJPEG connections.

### 8.3 Camera information and settings

The initial Vision 1.3.0 contract supports read-only display of device ID, adapter, API version,
calibration ID, sensor frame, mount frame, and static optical-to-mount geometry. It does not define
runtime mutation of resolution, FPS, exposure, serial selection, depth range, or mount geometry.

Therefore the first Camera card labels these values as information. Editable Camera settings are
added only after Vision publishes a versioned settings contract with validation, apply/restart
semantics, revision conflict handling, and failure recovery.

Recording state may later be displayed if advertised. Recording start/stop is not included in the
initial card because recording coordination and ownership remain a separate decision.

## 9. Operator card

Nodus Operator is included in the Device directory through its Pilot `input_source` component.

The current reviewed Operator implementation registers:

- component type `input_source`;
- capability `control.operation.v1`; and
- empty registration metadata.

It does not currently publish a provider endpoint catalog for health, configuration, activation,
adapter identity, leader-arm state, or terminal mode. Portal can therefore show only the generic
Pilot lifecycle identity and capability today. It must not infer Operator settings from
`component_id` text or reach into Operator files/process state.

A full Operator card requires a separately released direct provider contract that can describe, as
approved later:

- device kind and display name;
- active adapter and hardware connection state;
- paused, latched-run, or hold-to-run state;
- read-only effective configuration; and
- explicitly authorized configuration or activation operations.

The Terminal UI remains authoritative until such a contract defines how remote Portal control and
local keyboard control coexist. Merely displaying Operator as a card does not grant Portal remote
activation authority.

## 10. Generic and incompatible cards

A component that passes the inclusion policy but lacks a matching type adapter still receives a
generic read-only card containing only validated Pilot data:

- component ID and public type;
- lifecycle state;
- instance and generation diagnostics;
- declared capabilities; and
- a factual `No compatible Portal device adapter` explanation.

Malformed, unsupported, or mixed-version descriptors are isolated to that device. They do not
prevent other cards from rendering. Portal does not fall back to guessed URLs or schemas.

## 11. Settings interaction contract

When a future provider exposes mutable settings, its card follows these rules:

- fetch and retain the provider's authoritative settings revision;
- keep a per-device draft separate from the last accepted value;
- validate locally only from the published schema, then validate again at the provider;
- expose Save and Discard only while the active card is dirty;
- do not optimistically present a write as applied;
- re-read authoritative settings after acceptance;
- retain a factual error and the draft after a recoverable rejection;
- reject writes through a descriptor whose instance or catalog generation has changed; and
- never replay a pending mutation automatically after provider recovery or card replacement.

Switching cards may retain an unsaved draft in Portal memory for the same live device generation and
show a dirty badge in the picker. Page reload, provider generation replacement, or device removal
discards that draft. No draft is stored as durable configuration or command authority.

## 12. State and resource ownership

| State/resource | Owner | Lifetime |
|---|---|---|
| component and endpoint directory | global Pilot query service | Pilot server instance/catalog revision |
| selected device ID | router query | URL and browser history |
| selected empty slot | Device page presentation | current page runtime only |
| active device runtime | Device directory join | component/session/catalog generation |
| provider health/metadata | active type adapter | active card runtime generation |
| Camera MJPEG/image resources | active Camera workspace | selected stream and active card |
| settings draft | per-device card state | current page runtime and device generation |
| deck transform/gesture state | Device page presentation | current interaction only |
| selected robot | Robot Dock | independent of Device page |

On selection change, page exit, provider removal, or runtime replacement, Portal cancels direct
requests, closes streams, releases object URLs and binary buffers, disables stale controls, and
then activates the destination card. An old provider response cannot update the new active card.

## 13. Responsive and visual behavior

- The black theme remains primary; cards use the existing elevated surfaces and restrained accent
  lighting rather than a separate visual system.
- Overlap, scale, shadow, and opacity communicate deck depth without reducing active-card contrast.
- Desktop keeps adjacent card edges visible and provides a broad active workspace.
- Tablet supports touch swipe while keeping image and setting targets large enough for direct use.
- Phone uses one dominant card with a small next-card peek, internal media segments, and a compact
  device picker.
- The card frame accounts for safe-area insets and the floating Robot Dock without adding a
  Dock-sized page spacer.
- Streaming state, heartbeat age, and settings errors do not animate or resize the deck.

## 14. Failure and empty states

- **No supported devices:** keep `/devices` accessible and explain that no Camera, Operator, or
  supported provider is registered with Pilot inside the active empty card while retaining all five
  empty card slots.
- **Pilot unavailable:** retain the last directory only as visibly stale presentation and disable
  settings writes; do not claim providers are offline solely from Pilot loss.
- **Descriptor present, provider unreachable:** keep the selected card dimensions, show a concise
  recovering state, retry with bounded backoff, and trigger directory revalidation. Raw transport
  text and endpoint URLs belong only in diagnostics.
- **Provider replaced:** clear old runtime data/resources/drafts before binding the replacement.
- **One device malformed:** isolate the error to its card.
- **Selected device removed:** remove its stale URL query with replace navigation and activate the
  first empty slot after Pilot confirms lifecycle removal or expiry.
- **Camera stream failure:** retain card dimensions and information/settings access while showing a
  stable preview error surface.

## 15. Implementation checkpoints

Implementation requires separate approval and follows these checkpoints:

### DV0 - Route and regression baseline

- record the current robot-scoped Device behavior and route tests;
- add the global `/devices` contract and legacy redirect; and
- remove RobotStatus ownership from Device without changing Jogging, Operating, Home, or Robot Dock
  command behavior.

### DV1 - Device directory

- join component lifecycle and paginated endpoint catalogs;
- implement inclusion, stable identity, ordering, replacement, and empty states;
- materialize at least five deck slots, fill connected devices first, and append beyond five; and
- add exact fixtures for Camera, Operator/input-source, generic, malformed, and removed devices.

### DV2 - Accessible overlapping deck

- implement active/inert stacked cards, picker, pointer/touch/keyboard navigation, URL selection,
  reduced motion, and responsive geometry; and
- verify that inactive cards own no live resources or focusable controls.

### DV3 - Camera read-only card

- pin Vision 1.3.0 with immutable provenance;
- add exact descriptor matching and runtime validation;
- implement health, metadata, color, optional depth, cancellation, and replacement recovery; and
- keep Camera configuration values read-only.

### DV4 - LAN browser integration

- consume only explicitly advertised provider URLs;
- add the separately approved Vision LAN address and CORS contract changes in the owning repository;
- verify desktop and tablet access without proxying payloads through Pilot; and
- document the HTTP/HTTPS deployment boundary.

### DV5 - Operator and provider extensions

- first release an Operator-owned provider contract;
- add Operator information and controls only for exact advertised capabilities; and
- keep local Terminal UI and remote-control coexistence explicit.

### DV6 - Settings and advanced Camera tools

- add provider settings only after versioned read/write contracts exist;
- add Camera ROI, pixel-to-point, and PCD1 tools independently of basic preview; and
- retain recording coordination as a separate approved capability.

## 16. Acceptance criteria

- Device contains no RobotStatus card or Control-status subscription.
- `/devices` remains accessible with zero robots and zero devices.
- Zero through four connected devices still render exactly five total cards; six connected devices
  render six cards, with no artificial maximum.
- Camera and Operator appear as separate stable logical cards when registered.
- Cards visibly overlap and support swipe, click, picker, and keyboard selection.
- Only the active card is interactive and only the active Camera owns live streams.
- A depth view appears only when an exact compatible depth endpoint is advertised.
- Generic Operator information does not pretend that unimplemented settings are available.
- Robot Dock selection changes neither the selected device nor its URL.
- Direct links and back/forward restore the exact device selection.
- Provider replacement cannot leak old health, image, draft, or error state into the new generation.
- One device failure does not affect RobotStatus, Jogging, Operating, or another Device card.
- No provider payload byte travels through Pilot.

## 17. Deferred decisions

- the exact Vision writable settings API;
- the exact Operator identity, health, settings, and activation contract;
- remote Operator activation authority relative to the Terminal UI;
- Camera recording ownership and controls;
- optional Camera-to-Control attachment display and filtering; and
- production HTTPS/provider routing and authentication.

These deferred items limit only their corresponding card functions. They do not block the global
Device directory, overlapping deck, generic lifecycle cards, or read-only Camera preview.
