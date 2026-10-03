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
