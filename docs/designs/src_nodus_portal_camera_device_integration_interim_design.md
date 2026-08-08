# Camera Device Integration Interim Design

## 1. Document status

This document records the verified integration baseline for presenting cameras on the Portal
Device page. It is an interim design, not implementation approval for Camera UI, Camera settings
mutation, Vision changes, or Pilot changes.

The Device page layout and interaction design is now owned by
`src_pages_device_page_design.md`. That design resolves the page as a global minimum-five-slot
device deck. Remaining provider-contract decisions in this interim baseline must not be guessed
during implementation.

## 2. Goal

The eventual Device page shall allow an operator to:

- discover Camera providers currently registered with Pilot;
- inspect a selected Camera's connection and capture health;
- inspect its published, sanitized metadata and mount geometry;
- view color and depth previews supplied directly by Vision; and
- access later approved Camera functions without routing Camera payload bytes through Pilot.

The first Device-page design may expose read-only information and previews without exposing Camera
configuration mutation.

## 3. Verified ownership boundary

The integration has two separate paths:

```text
Vision -- component lifecycle and endpoint metadata --> Pilot
Portal -- component and endpoint discovery ----------> Pilot

Portal -- image, depth, query, and point-cloud data --> Vision directly
```

Responsibilities remain divided as follows:

| Owner | Responsibility |
|---|---|
| Vision | Physical/fake Camera adapter, capture, encoding, Camera health, metadata, queries, point cloud, and optional recording endpoints |
| Pilot | Generic component lifecycle, lease, state, and endpoint-directory metadata |
| Portal | Camera discovery, selection, presentation, direct provider access, cancellation, and UI resource cleanup |
| Control | Robot state and frame world poses; no Camera payload ownership |

Pilot must not proxy MJPEG, JPEG, depth, point-cloud, or recording payloads. Portal must not connect
to Control IPC or import Vision or Pilot implementation source.

## 4. Current Vision public contract

The reviewed Vision provider contract is OpenAPI 3.1.0 with provider API version 1.3.0. It currently
publishes these routes:

| Route | Purpose |
|---|---|
| `GET /health` | Provider, Camera, Pilot integration, and recording health |
| `GET /metadata` | Sanitized device, calibration, frame, mount geometry, and active endpoint metadata |
| `GET /stream/color.mjpg` | Long-lived color preview |
| `GET /stream/depth.mjpg` | Long-lived depth preview |
| `GET /snapshot/color` | Color JPEG snapshot |
| `GET /snapshot/depth` | Depth preview JPEG snapshot |
| `POST /query/roi_depth` | Depth statistics for a requested image ROI |
| `POST /query/pixel_to_point` | Deproject an image pixel into the optical frame |
| `GET /snapshot/pointcloud.bin` | PCD1 v2 binary point-cloud snapshot |
| `POST /recordings/start` | Start an optional Vision-owned recording |
| `POST /recordings/stop` | Stop an optional Vision-owned recording |
| `GET /recordings/current` | Inspect the optional recording state |

The endpoint catalog uses explicit Camera capabilities including:

- `camera.health.get`;
- `camera.metadata.get`;
- `camera.stream.color.preview`;
- `camera.stream.depth.preview`;
- `camera.snapshot.color`;
- `camera.snapshot.depth.preview`;
- `camera.query.roi_depth`;
- `camera.query.pixel_to_point`; and
- `camera.snapshot.pointcloud`.

Recording capabilities are advertised only when recording is enabled by the Vision deployment.

## 5. Vision and Pilot exchange

### 5.1 Vision to Pilot

Vision registers a generic public component and publishes:

- component and runtime instance identities;
- component type `camera`;
- lifecycle state and heartbeat;
- supported Camera capabilities;
- the direct endpoint catalog;
- `device_id`, provider API version, and calibration identity;
- `sensor_frame` and `mount_frame`; and
- the static mount-from-camera-optical 4x4 matrix.

The endpoint directory describes how a consumer reaches Vision. It does not contain Camera payload
bytes.

### 5.2 Pilot to Vision

Pilot returns and maintains:

- the component `session_id`;
- Pilot server-instance identity;
- heartbeat and lease timing;
- accepted component state; and
- endpoint catalog generation and revision results.

Vision is responsible for recovering its lifecycle session and republishing its catalog after
Pilot replacement or loss.

### 5.3 Pilot to Portal

Portal can use the generic public APIs to obtain:

- registered components and their lifecycle state;
- endpoint-directory entries including component, instance, session, and catalog generations; and
- each Camera descriptor's capability, media type, schema identity, endpoint URL, and metadata.

A basic Camera directory and preview do not require a new Camera-specific Pilot route.

## 6. Verified runtime behavior

A fake Vision provider was connected to a running Pilot during the investigation. The following
behavior was observed:

- `camera.fake_top` registered as a ready Camera component;
- nine non-recording Camera descriptors appeared in Pilot's endpoint directory;
- Vision health and metadata were available from its direct provider address;
- color and depth snapshot requests returned JPEG responses successfully; and
- stopping Vision removed its component and endpoint catalog from Pilot.

No physical Camera was accessed and no recording was started.

## 7. Current Portal gap

The existing Device page presents only the selected Control's robot type, DOF, servo state, brake
state, and status age. Portal already has a generic Pilot endpoint-directory query, but the Device
page does not consume it and no Vision provider client or Camera feature module exists.

The earlier F9 blocker states that no released Camera provider contract exists. Vision now owns a
versioned 1.3.0 public contract, so that statement is stale. F9 remains unimplemented because Portal
has not yet:

- pinned the Vision contract with immutable provenance;
- generated or authored its public provider types and runtime guards;
- defined Camera endpoint selection and catalog recovery;
- implemented browser-compatible direct Vision access; or
- designed the Device-page Camera experience.

Portal's current Pilot contract remains pinned separately. Updating either public contract must be
an explicit reviewed checkpoint rather than an implicit copy from a sibling worktree.

## 8. Deployment gaps to resolve before browser integration

### 8.1 LAN-reachable provider address

The reviewed fake Camera example binds and advertises `127.0.0.1:8900`. A remote tablet interprets
that address as the tablet itself. A LAN deployment requires:

- a Vision listener bound to `0.0.0.0` or the host's LAN interface; and
- an advertised base URL containing the host's reachable LAN IP or DNS name.

`0.0.0.0` is a bind address and must not be advertised as a consumer endpoint.

### 8.2 Browser cross-origin access

The reviewed Vision provider does not implement an explicit CORS or `OPTIONS` policy. A browser may
render a cross-origin MJPEG URL as an image, but Portal cannot reliably fetch health, metadata,
binary data, or JSON POST queries without provider-approved cross-origin responses and preflight
handling.

The later integration design must define explicit allowed Portal origins. Wildcard production
access must not be assumed merely because the current deployment is a trusted home research LAN.

### 8.3 Optional Camera-to-Control association

Vision currently publishes `mount_frame` but no `control_id`. The approved Device page is global,
so Camera discovery and membership no longer depend on a Camera-to-Control association.

An optional future attachment contract may still support:

1. descriptive grouping or filtering by attached Control;
2. Camera overlays on a selected robot visualization; or
3. dynamic composition of Camera geometry with Control frame world poses.

Adding an attachment identity to Vision metadata would not make Vision dependent on Control IPC;
it would only describe deployment topology. It remains deferred and does not block the Device
directory or Camera card.

### 8.4 HTTP and HTTPS compatibility

A future HTTPS Portal cannot load an HTTP Vision provider without a mixed-content-compatible
deployment design. This is not an immediate blocker for the current HTTP LAN development setup,
but it must be resolved before production hosting.

## 9. Configuration visibility boundary

The current provider contract supports read-only inspection of sanitized metadata. It does not
define mutation of resolution, frame rate, exposure, serial selection, depth range, mount geometry,
or other Camera configuration.

The initial Device design should therefore distinguish:

- **published information**, which Portal may display immediately after validating it; and
- **mutable settings**, which require a separate versioned Vision configuration contract,
  validation rules, apply/restart behavior, and failure recovery before controls are added.

Vision's private filesystem paths and full deployment configuration must not be inferred from
metadata or exposed merely to populate a settings panel.

## 10. Proposed incremental Device design sequence

The Device page is designed in `src_pages_device_page_design.md` and shall be implemented in small
approved checkpoints rather than directly from this interim note:

1. replace the robot-scoped status page with the global minimum-five-slot Device deck;
2. define the device directory, stable selection, empty, replaced, stale, and offline states;
3. define read-only health, metadata, and color/depth preview presentation;
4. define endpoint pagination, catalog-event invalidation, direct-client recovery, cancellation,
   and resource ownership;
5. add ROI, pixel-to-point, and point-cloud interaction only after the preview path is accepted;
6. design mutable settings and recording controls as separate later capabilities rather than
   silently including them in the initial page.

## 11. Open decisions

Later provider-specific designs must settle these questions explicitly:

- Which published metadata belongs in the normal view and which belongs in diagnostics?
- Does the first release show color and depth simultaneously or load only the selected stream?
- Which preview resources remain alive while navigating within Device, and which stop immediately?
- Is recording status visible on Device while start/stop coordination remains outside Portal?
- What user-visible recovery behavior applies when Pilot retains a Camera descriptor but the
  direct Vision endpoint is unreachable?

Until those questions are approved, this document is the integration baseline only.
