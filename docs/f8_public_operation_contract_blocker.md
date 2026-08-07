# F8 public operation-contract resolution

Date: 2026-08-07
Status: resolved for the current same-host research profile

The original F8 review correctly stopped before manufacturing operation session fields, but it
overstated the missing contract. Pilot already treated component type as descriptive under
`pass_through`; the remaining public-artifact gap was an explicit UI/session explanation and a
browser mapping for the enabled same-host monotonic clock profile.

Pilot OpenAPI 1.0.2 at revision `46d35dea702e71ae78aa2bb932a11e1bf5e79a73` now publishes the
required semantics:

- Portal registers one generic `component_type: ui` session with `control.operation.v1` capability.
- `session_id` is copied only from `ComponentRegistrationResponse`; it is never inferred.
- lifecycle heartbeat/state sequence and operation `(generation, sequence)` are independent.
- Portal owns the operation cursor and resets it only for a newly registered session.
- session replacement, expiry, or Pilot restart cancels active holds and never replays an old
  mutating request.
- `source_timestamp_ns` uses the registered `monotonic_same_host` clock profile.

For a browser running on the same Linux host, Portal records `performance.now()` when the
registration response is received and maps later timestamps as:

```text
source_timestamp_ns = registration.server_time
                    + elapsed performance.now() monotonic nanoseconds
```

Because `server_time` was captured before response receipt, the mapped timestamp is conservatively
backdated by response transit time. Wake, clock discontinuity, session loss, or Pilot restart
invalidates the mapping, cancels active hold state, and requires registration again.

This resolution does not enable remote/cross-host browser mutation. Such a browser is not a
`monotonic_same_host` source and requires a later clock-domain or same-host command-sidecar
contract. That deferred boundary does not block F8 for the approved current profile.

F8 may resume against the pinned 1.0.2 artifact. Its implementation must keep the component session
at application scope, keep one operation in flight per selected Control, coalesce only the newest
pending target, and preserve the approved continuous hold-to-run cleanup and status-reconciliation
rules.
