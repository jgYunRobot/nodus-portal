# F9 Public Camera Provider Contract Blocker

## Status

- Date: 2026-08-07
- Checkpoint: F9 - Camera integration
- Result: blocked before implementation by the absence of a released Camera provider payload
  contract.

## Evidence

The pinned Pilot OpenAPI 1.0.2 does provide public generic discovery:

- `GET /api/v1/endpoints` returns an `EndpointDirectoryResponse`;
- an entry identifies `component_id`, `instance_id`, `component_type`, session/catalog generations,
  and a generic `EndpointDescriptor`; and
- a descriptor supplies `capability`, `contract_version`, HTTP/HTTPS `endpoint`, `media_type`,
  optional `schema_id`, opaque bounded metadata, and generic service/stream fields.

That artifact does **not** define a Camera provider contract. In particular, it contains no released
Camera capability vocabulary, descriptor-selection policy, schema for color/depth/ROI/point-cloud
payloads, request query/body shape, frame metadata/header semantics, binary point-cloud layout,
provider lifecycle/error states, or direct-client recovery contract.

The Portal workspace has no separate published Camera OpenAPI/schema artifact. The available
`nodus-pilot` Camera text is design/fixture material for the generic component registry; it is not
a released Camera provider contract and must not be imported or treated as Portal's wire contract.

## Why Portal cannot proceed safely

F9 requires direct provider connections. Guessing endpoint paths, capability strings, JPEG/MJPEG
frame headers, ROI parameters, or point-cloud bytes would violate the approved boundary: Pilot
must not relay payloads, and Portal must not rely on Pilot internals, PA-CONTROL, or sibling source
implementation details.

## Required resolution

Publish a versioned Camera provider contract that, at minimum, defines:

1. exact descriptor selection tuple: component ID, descriptor ID, capability, contract version,
   schema ID, media type, and endpoint semantics;
2. color/depth preview, snapshot, ROI/depth query, and point-cloud request/response schemas;
3. frame identity, timestamps, calibration/image-shape metadata, binary payload layout, and error
   status semantics;
4. provider lifecycle/replacement/revocation/reconnect behavior and direct browser CORS/auth
   requirements; and
5. an immutable provenance revision/digest suitable for Portal pinning and black-box fixtures.

With that artifact, Portal can implement F9 through public endpoint discovery and direct provider
clients without changing Pilot or relaying Camera bytes through it.
