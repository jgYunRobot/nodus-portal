# Operator workspace visual refresh

## Direction and scope

Date: 2026-10-03. The user requested a UI/UX overhaul of the current Portal with
excellent usability and a beautiful interface. This is a presentation refresh of
the existing operator application, within the approved navigation, Device deck,
Robot Dock and Operation contracts. No web UI migration is part of this work.

Portal is an independently launched robotics workspace: discover robots on Home,
inspect live status, open the exact robot's Operation workspace, and inspect
Camera/Operator providers through Devices. The black/blue identity, light/system
themes, real URDF assets, CSS Modules, Radix and Lucide remain the foundation.

## User flow and visual decisions

- Give navigation a recognizable product identity, distinct icons, clear active
  states, a usable collapsed form, and a keyboard skip link. Replace the connection
  placeholder with the existing discovery query's actual state. A directory query
  succeeding is never described as a live Control connection.
- Home introduces the task, shows the actual discovered robot count, and separates
  identity, freshness, mechanical state and the explicit Operation link. A native
  selection button makes card selection available from the keyboard as well as
  the existing pointer interaction. Selection does not navigate or send commands.
- Operation gives the real robot visualization the largest surface, a clear model
  selector and useful empty-state instructions. Measurements remain legible with
  tabular figures and units. A comfortable remote rail holds the existing Joint/
  Task controls and Operator panel; smaller screens show the model, motion controls,
  then measurements, so operating does not require scrolling past every joint.
- Increase jog controls to the approved 44 px minimum target, retain compact
  label/minus/plus rows on phones, and explain press-and-hold behavior inline.
  The availability message must agree with the existing disabled state.
- Retain the Device deck's five-slot minimum, overlapping cards, URL selection,
  keyboard, wheel and swipe behavior. Polish its typography and surfaces.
  Expose visible previous/next buttons backed by the existing selection handler.
- Keep the Robot Dock fixed at the right bottom, with its existing width transition
  and command ownership. No state-dependent shell resizing or Dock-sized content
  spacer is introduced. Theme colors, typography and control treatments are shared.

Design references: local UI UX Pro Max focus/touch guidance; IBM DESIGN.md's
restrained accent, surface separation and numeric hierarchy; Taste's product-
specific identity; Impeccable Operate's legible states and task-led layout. These
are adapted principles, not imported design libraries or copied brand identities.
No decorative metrics, fake activity, continuous glow or reconstructed robot asset.

## Fixed-position real-time measurements

2026-10-03 follow-up: reserve one sign position and eight magnitude positions
(four integer digits, decimal point, three fractional digits) in Operation's
existing monospace/tabular figures. Show both `+` and `−` explicitly and pad the
rounded magnitude on the left. Preserve `toFixed(3)` rounding, including negative
values that round to `−0.000`, and the existing unavailable-value dash.

Render the unit separately so sign changes and ordinary integer digit changes do
not move the decimal point or unit. Wrap only between the complete number and its
unit on narrow screens. Values exceeding the reserved integer capacity remain
fully visible and may extend the number field; do not truncate or clamp telemetry.
Inspect positive/negative transitions, zero, integer digit changes, unavailable
values and a 320 px layout without changing status cadence or numerical inputs.

## Contract and validation boundaries

Keep all published Pilot/provider endpoints, subscription ownership, exact Control
identity, freshness handling, operation scheduler, switching cancellation, and
hold-to-run handlers unchanged. No extra polling, direct Control dependency,
provider relay, command authority claim or new dependency.

Inspect desktop/mobile and black/light renders with intercepted public-contract
fixtures; use only presentation interactions, not hardware commands. Report
fixture inspection separately from runtime/hardware evidence. Format changed
files, inspect scoped lint and diff whitespace. Shared rules require an explicit
user request before builds or test suites, so neither runs by default.

## Tactile teaching-pendant motion

2026-10-03: the user requested a more elastic interaction feel for Portal as a
teaching pendant. Keep motion tied to actions: immediate press feedback, a short
spring-like release, sliding selection, panel reveal and navigation transitions.
Use shared CSS durations/easing and existing primitives without a new dependency.

- Animate the inside of buttons rather than the command hit areas. Jog pointer
  capture, pointer/key release, cancellation and command scheduling remain synchronous.
- Give Joint/Task an animated sliding selection surface driven by the existing mode.
- Animate the existing route container with opacity only: no transforms that would
  change positioning contexts or move measurements/command targets. Do not add a new
  route key or remount boundary; do not animate each status update.
- Smooth sidebar width, right-anchored Dock width, Device card position/scale and
  mobile drawer entry/exit. Keep Dock space independent of main-content dimensions.
- Reveal the theme menu and acknowledge Home selection; avoid continuous pulses,
  loading choreography, telemetry interpolation or optimistic hardware-state changes.
- Honor reduced motion with immediate visual states and no delayed animations.
  Inspect mouse, keyboard, touch, focus return, rapid reversals and disabled states.
