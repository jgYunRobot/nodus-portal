import type { components } from "./generated/pilot_v1";

export function isControlStatusResponse(
  value: unknown
): value is components["schemas"]["ControlStatusResponse"] {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const status = value as Record<string, unknown>;
  return (
    typeof status.control_id === "string" &&
    typeof status.available === "boolean" &&
    typeof status.fresh === "boolean" &&
    typeof status.stale === "boolean" &&
    typeof status.connection_generation === "number" &&
    Number.isInteger(status.connection_generation) &&
    (status.sample === null || isControlStatusSample(status.sample))
  );
}

export function isSampleStreamsResponse(
  value: unknown
): value is components["schemas"]["SampleStreamsResponse"] {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const response = value as Record<string, unknown>;
  return (
    typeof response.server_instance_id === "string" &&
    Array.isArray(response.streams) &&
    response.streams.every(isSampleStreamDescriptor)
  );
}

function isSampleStreamDescriptor(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const descriptor = value as Record<string, unknown>;
  return (
    typeof descriptor.stream_id === "string" &&
    descriptor.owner === "pilot" &&
    typeof descriptor.control_id === "string" &&
    descriptor.stream_kind === "robot_status" &&
    typeof descriptor.schema_id === "string" &&
    descriptor.schema_version === 1 &&
    Array.isArray(descriptor.source_clock_domains) &&
    descriptor.source_clock_domains.every(
      (clock_domain) => typeof clock_domain === "string"
    ) &&
    (typeof descriptor.configured_production_hz === "number" ||
      descriptor.configured_production_hz === null) &&
    typeof descriptor.retention_capacity === "number" &&
    descriptor.recording_grade === true
  );
}

function isControlStatusSample(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const sample = value as Record<string, unknown>;
  return (
    typeof sample.sample_sequence === "number" &&
    Number.isInteger(sample.sample_sequence) &&
    sample.sample_sequence > 0 &&
    typeof sample.connection_generation === "number" &&
    Number.isInteger(sample.connection_generation) &&
    typeof sample.source_timestamp_ns === "number" &&
    typeof sample.pilot_receive_monotonic_ns === "number" &&
    sample.robot_state !== null &&
    typeof sample.robot_state === "object"
  );
}
