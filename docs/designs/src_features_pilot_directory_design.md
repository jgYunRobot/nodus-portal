# Pilot discovery and robot selection

## Approved scope

The operator approved discovering physical and Gym/VC Pilot instances and selecting their robots
through the existing Robot Dock. Preserve the current layout, hold-to-run controls, public Pilot
HTTP/SSE boundary, and single active command source. This checkpoint owns only Portal files.

## Host discovery

Portal's Vite host installs the same middleware in development and local built-file preview. It
reads Linux listening TCP sockets without a file watcher and probes only loopback Pilot public
health and RobotStatus stream-directory APIs. No Control IPC, ROS dependency, motion command, Pilot
internal import, or new daemon is used. VC's port-zero allocation remains unchanged. Explicit
`PORTAL_PILOT_URLS` entries also support remote or non-Linux deployments; the existing proxy target
is an additional explicit candidate. Arbitrary LAN scanning is outside this implementation.

Discovery uses at most 256 endpoints, eight concurrent probes, 400 ms probe timeouts, and a three-second refresh budget/cache. Selected API/SSE forwarding uses a separate bounded known-identity map and a direct identity check; it never waits for catalog refresh. Partial discovery and host errors are
reported. Only matching health and stream-directory server identities are published. The host owns
the discovered list; browser requests cannot specify a proxy destination.

A Pilot may be reachable through more than one verified address (including a local reverse proxy).
Retain all verified address identities in the bounded forwarding map while showing each process
once. Discovery also retries known addresses after an empty outage, before considering newly
enumerated sockets. `GET /__portal/pilots?pilot=<selected-id>` projects the same deduplicated
catalog using the selected verified address for that process. Both launch resolution and periodic
browser discovery supply the saved/URL selection, and the browser query key includes that selection.
This keeps a bookmark usable when socket enumeration order changes or another address becomes
canonical. The query selects only an address discovered by the host; it cannot introduce a URL.
Unknown or currently absent selections remain unavailable, and forwarding still checks process
identity before every request.

Each Pilot selection has an opaque ID bound to its endpoint; `server_instance_id` identifies the
current process separately. The endpoint ID remains stable across Pilot and Portal host restarts.
The host checks the last discovered process identity before forwarding. Until discovery confirms
a restarted process at the selected endpoint, forwarding remains unavailable. Once confirmed,
existing session/stream recovery registers a new session and reseeds status without changing the
selected robot. HTTP bodies and SSE are streamed; mutating requests are never retried or replayed.
Old session IDs remain invalid in the restarted Pilot. Provider payload endpoints remain direct.
A different Pilot intentionally placed at the same endpoint is also treated as that endpoint's
new process; this is address-based selection, not persistent robot identity authentication.

## Resource ownership and recovery bounds

- Probe JSON is limited to 1 MiB while streaming; failed/oversized responses cancel the reader and
  release its lock. A probe still has the 400 ms deadline. Concurrent identity checks for the same
  selected Pilot share one in-flight promise and remove it on completion; there is no identity TTL
  cache that could adopt a stale process.
- A browser that disconnects while its identity check is pending never opens an upstream request.
  Response closure/error cancels forwarding; aborted upstream bodies close the downstream response.
  Ordinary forwarding and waiting for response headers use a five-second inactivity timeout. An
  established SSE remains streaming until closure; normal backpressure is preserved.
- Final unsubscribe is idempotent even when called again by a recovery callback. Retry timers are
  installed before recovery notifications, allowing synchronous unsubscribe to cancel them. SSE
  backoff resets only after valid status arrives, not merely after an open/close handshake.
- This keeps restart recovery observational: no mutation is retried and no old hold is resumed.

## Selection and lifecycle

- `Select Robot` groups public Control IDs by Pilot endpoint. Identical Control IDs on different
  Pilots are distinct selections. Unknown model/environment labels are not invented.
- A first visit connects automatically only if discovery is complete and exactly one Pilot exists. With several Pilots,
  keep an unselected state. A URL or saved Pilot selection is never silently replaced when absent.
- `?pilot=<opaque-id>` identifies the Pilot in bookmarks. Robot paths still own `control_id`.
  Navigation retains Pilot scope and robot preference is stored per Pilot.
- Changing Controls in one Pilot retains the existing client-side route handoff. Changing Pilot
  cancels local holds/pending targets, stops the component session and unmounts the old React tree
  before loading the destination document. This deliberately starts a new client/query/stream
  runtime instead of mutating the base URL of existing clients. No old status or operation result
  is reused or replayed. Existing in-flight/active-hold selection locks are preserved.
- Restart at the selected endpoint preserves the Pilot/Control selection and automatically recovers
  observation and the component session after discovery. Never resume an old hold or replay a command.
  A Pilot at another endpoint is still a different selection, even if it exposes the same Control ID.
- Legacy bookmarks/preferences made with process-scoped IDs require selecting the endpoint once;
  those hashes do not contain a recoverable address. New endpoint-scoped selections survive restart.
- Global Home may show metadata cards for other Pilots. Detailed status subscriptions and commands
  belong to the selected Pilot; unselected cards never subscribe through its Control-ID namespace.

## Compatibility and verification

Load public configuration and resolve Pilot selection before dynamically importing application
modules that construct singleton clients. Static hosts without this middleware keep the existing
explicit `pilotBaseUrl` behavior. Prefix-aware HTTP and SSE URL resolution supports the selected
namespace. Local preview continues to serve built assets without development file watching.

Verify duplicate Control IDs, late/empty/multiple discovery, missing saved selection, prefix URLs,
identity replacement and port reuse, streaming SSE, command non-replay, selection locks, and actual
browser selection. Use software/mock Pilot instances only; hardware motion is not authorized.

## Software verification

- The formal TypeScript/Vite build and focused tests cover bootstrap-before-client construction,
  duplicate Control identities, scoped HTTP/SSE paths, per-Pilot preference, incomplete catalogs,
  invalid metadata, missing selections, reused ports, command non-replay, and discovery latency
  isolation.
- Chromium uses actual random-port HTTP Pilot fixtures and the real host middleware. It checks
  Select Robot on Home/Operation, mock command routing, in-flight locks across Home and Dock,
  old SSE close, browser Back, late discovery, unavailable selection, and desktop/mobile renders.
- This is local software evidence. It does not certify hardware operation or arbitrary LAN
  discovery. Vite preview retains zero inotify watchers; provider payload routing is unchanged.

## 2026-10-30 stability verification

- Reproduced an upstream socket left without an HTTP request after browser cancellation during a
  delayed identity probe, and recursive unsubscribe during recovery. Added failing regression cases
  before fixing both paths. Backoff, coalescing, oversized JSON and silent-upstream cases are covered.
- Scoped Vitest: 44/44. Chromium: 3/3, including five mock Pilot outages/recoveries. The selected URL
  and Control persist, a new session registers, exactly one SSE returns and zero remain after leaving.
  There were no page errors or robot operations; each restart used 21–29 browser API requests.
- Browser GC heap was 3.59 MiB initially and 4.38 MiB after five restarts (about 325 KiB growth after
  the first recovery). This is bounded short-run evidence, not an unlimited-lifetime leak guarantee.
- An isolated Node HTTP harness performed 12,500 regular requests, 2,500 SSE open/close cycles with
  up to ten concurrent streams, and 250 process-identity changes. Cache time was advanced in this
  synthetic load; these were mock identity changes, not 250 native process launches. Every batch
  returned to zero active SSE. Last 15 batches grew GC heap by 125,864 bytes with a three-FD range.
  After 12 seconds idle RSS dropped to about 120 MiB and FD count to 30. No mutating operations ran.
- TypeScript build, Vite production build, scoped lint/format and whitespace checks passed. This
  software run does not establish physical robot or long-duration production acceptance.
