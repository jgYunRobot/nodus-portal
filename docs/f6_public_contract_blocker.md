# F6 RobotDirectory public-contract resolution record

Date: 2026-08-07

The previous pinned Pilot v1 OpenAPI artifact exposed `GET /api/v1/pilot/streams`, but its 200
response schema was only an unconstrained JSON `object`. The artifact contained
`SampleStreamDescriptor`, but the route response did not reference it or define the collection
field, pagination, stream generation, or catalog identity required for a Portal RobotDirectory
adapter.

The user identified `nodus-pilot` revision `fc6aa0511e92ff4722fa51c439609bde8391d970`, whose
public OpenAPI 1.0.1 defines `SampleStreamsResponse` for this route and explicitly exposes the
`control_id`, `stream_kind`, and `schema_id` filters. Portal pins that artifact before resuming F6.

The F6 implementation uses only those public descriptors and explicit per-Control status routes;
it does not infer any Control catalog from Pilot internals.
