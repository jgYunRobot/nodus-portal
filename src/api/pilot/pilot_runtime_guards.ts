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
