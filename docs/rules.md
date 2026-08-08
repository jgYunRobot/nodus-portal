# Project Documentation Rules

## Design documents

- Keep every project design document directly under `docs/designs/` in a flat layout. Do not create subdirectories below `docs/designs/`.
- Name design documents `<path>_<design_name>_design.md`. Convert the repository-relative owner path and design name to lowercase `snake_case`, and replace path separators with underscores.
- Record migration constraints and the exact source inventory before copying files from `pa_control/apps/web_ui`.
- Keep Portal integration designs based on published Pilot contracts and direct provider endpoints; do not design against Pilot internals or Control IPC.
- Before changing the application shell, routes, sidebar, Home robot cards, Jogging page ownership, or multi-robot status subscriptions, read and follow `docs/designs/src_nodus_portal_navigation_and_multi_robot_home_design.md`.
- Before changing persistent robot selection, the floating Robot Dock, shared Servo/Fault/Brake
  command ownership, or robot-switch handoff, read and follow
  `docs/designs/src_shell_robot_dock_design.md`.
- Before selecting frontend dependencies, creating the application layout, implementing themes, migrating `pa_control/apps/web_ui`, or starting a frontend checkpoint, read and follow `docs/designs/src_nodus_portal_frontend_detailed_architecture_and_phased_implementation_design.md` together with its two upstream designs.

## Current research deployment decision

- The current target is a private home research and development deployment. Pilot Phase B command authority and production security hardening are intentionally deferred.
- Assume one operator coordinates at most one active mutating source per Control. Do not treat the absence of Phase B as a reason to remove, disable, or downgrade an otherwise approved Portal command feature.
- Do not add repeated warning dialogs, modal acknowledgement gates, or recurring design objections solely because the accepted development deployment lacks enforced command authority.
- Preserve joint jog, task jog, Home, and Ready as hold-to-run continuous interactions. Do not replace them with click-once fixed-distance controls unless the user explicitly changes this decision.
- Hold-to-run calculations must read the newest accepted authoritative Control status every time and reconcile it with a speed- and elapsed-time-based projected target. Do not repeatedly derive targets from a stale React render snapshot or a hold-start closure, and do not let delayed status delivery collapse continuous motion into repeated identical deltas.
- Revisit this accepted decision when the deployment adds multiple independent mutating sources, untrusted users or networks, unattended operation, production acceptance, or when the user explicitly asks.
- This decision does not authorize direct Control IPC, false server-enforced ownership claims, or production-safety claims.

## Progress log

- Keep the project progress log in `docs/progress.md`.
- After every coding task, update `docs/progress.md` with the change summary, current status/result, and next planned goals or remaining TODOs.
