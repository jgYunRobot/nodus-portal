# Pilot Commands workspace

- Date: 2026-11-01
- Scope: user-requested Commands tab, under the existing Portal shell at /commands.
- Source: Portal-owned snapshot of Pilot public OpenAPI only. No Pilot implementation imports,
  Control IPC, new UI dependency, or provider payload relay.
- Navigation: global Workspace entry, retaining selected Pilot and Robot Dock preference.
- Flow: search/select HTTP endpoint; select a Control operation variant for POST /operations;
  edit path values, query/header JSON and request JSON; Send; inspect HTTP status, duration,
  headers and bounded response. Scalar payload fields also have direct value inputs.
- All published HTTP endpoints and OperationRequest variants derive from the pinned schema.
  Query/header editors also permit parameters not described by the schema.
- The UI states the pinned API version; this is not runtime version discovery. Updating Pilot
  requires deliberately updating the snapshot/provenance and regenerating TypeScript.
- Automatic operation mode uses the existing Portal session, allocating request identity, sequence,
  generation and timestamp at Send time. It never creates another automatic component session.
  Manual lifecycle/session APIs remain explicit raw requests with caller-supplied tokens/cursors.
- Mutating requests share a runtime exclusion gate with Dock commands and robot selection.
  One in-flight request per explorer; no retries or replay. Session invalidation cancels local mutating work.
  Leaving the page or changing endpoint aborts the request. Aborting cannot undo delivery.
- SSE uses fetch streams (so query/header inputs work), explicit Start/Stop, one connection,
  a rolling 64 KiB text buffer and 10 Hz response rendering. Ordinary HTTP has a 10-second timeout
  and bounded response text; no persistent history or accumulated telemetry.
- UX: existing Portal theme tokens, paired endpoint/editor columns, monospace paths and JSON,
  visible labels/focus/status, responsive single column. Existing product design takes precedence
  over external Stripe reference; adopt request/response hierarchy only, no marketing styling.
- Validation: targeted catalog/request/runtime/UI regression cases; run builds/tests only on
  explicit user request per shared rules. Browser checks send only read-only requests to hardware Pilot.

## Command-first refinement

The user clarified that moveL/moveJ/setForce experiments must not require HTTP endpoint or JSON
envelope editing. The default mode therefore lists all32 Control commands with these three
prominent aliases. HTTP APIs retains all17 raw public endpoints as an advanced mode.

- Use schema-derived scalar, enum, nested, vector and union-format inputs.
- Joint positions/limits use degrees in the form and radians on the wire. MoveL poses use XYZ
  metres and Z-Y-X degree angles, converted to published xyz+qx,qy,qz,qw.
- Force/torque and diagonal stiffness/damping have named axes and visible units.
- Motion Request APIs expose auto_play=true as an explicit Run-after-preparation checkbox;
  clearing it changes the action to Prepare. No second request or replay is synthesized.
- Target/reference frame selectors show names from public status, so IDs need not be memorized.
- Current-state buttons use only fresh public Control status. Cartesian state loading is available
  only with world reference0 and a matching target frame. Joint vectors resize to observed DOF.
- Keep command drafts in memory while switching within this page; never persist session tokens.
- Templates and displayed defaults are editable inputs, not a claim that a motion is validated
  for the selected physical robot. Validation uses isolated mocked Pilot commands only.
