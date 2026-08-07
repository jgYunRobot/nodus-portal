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
    isNullableFiniteNumber(status.age_ms) &&
    typeof status.request_pending === "boolean" &&
    isNonNegativeInteger(status.connection_generation) &&
    isNullableNonNegativeInteger(status.last_success_monotonic_ns) &&
    isNullableNonNegativeInteger(status.last_failure_monotonic_ns) &&
    isFiniteNumber(status.configured_polling_hz) &&
    isFiniteNumber(status.measured_polling_hz) &&
    isNonNegativeInteger(status.missed_poll_count) &&
    isNonNegativeInteger(status.timeout_count) &&
    isNonNegativeInteger(status.gateway_queue_high_watermark) &&
    (status.sample === null ||
      (isControlStatusSample(status.sample) &&
        status.sample.connection_generation === status.connection_generation))
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

export function isComponentRegistrationResponse(
  value: unknown
): value is components["schemas"]["ComponentRegistrationResponse"] {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const response = value as Record<string, unknown>;
  return (
    typeof response.session_id === "string" &&
    typeof response.server_instance_id === "string" &&
    response.accepted_protocol_version === 1 &&
    Array.isArray(response.accepted_schema_versions) &&
    typeof response.heartbeat_interval_ms === "number" &&
    typeof response.lease_timeout_ms === "number" &&
    typeof response.server_time === "number"
  );
}

export function isLifecycleAcceptedResponse(
  value: unknown
): value is components["schemas"]["LifecycleAcceptedResponse"] {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const response = value as Record<string, unknown>;
  return (
    response.status === "accepted" &&
    response.snapshot !== null &&
    typeof response.snapshot === "object"
  );
}

export function isErrorResponse(
  value: unknown
): value is components["schemas"]["ErrorResponse"] {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const response = value as Record<string, unknown>;
  if (response.error === null || typeof response.error !== "object")
    return false;
  const error = response.error as Record<string, unknown>;
  return typeof error.code === "string" && typeof error.message === "string";
}

export function isOperationResult(
  value: unknown
): value is components["schemas"]["OperationResult"] {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const result = value as Record<string, unknown>;
  return (
    result.schema_version === 1 &&
    typeof result.request_id === "string" &&
    typeof result.operation === "string" &&
    typeof result.control_id === "string" &&
    typeof result.pilot_disposition === "string" &&
    result.control_outcome !== null &&
    typeof result.control_outcome === "object"
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

function isControlStatusSample(
  value: unknown
): value is components["schemas"]["ControlStatusSample"] {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const sample = value as Record<string, unknown>;
  return (
    isPositiveInteger(sample.sample_sequence) &&
    isNonNegativeInteger(sample.connection_generation) &&
    isNonNegativeInteger(sample.source_timestamp_ns) &&
    isNonNegativeInteger(sample.pilot_receive_monotonic_ns) &&
    isRobotStatus(sample.robot_state)
  );
}

function isRobotStatus(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const status = value as Record<string, unknown>;
  return (
    isNonNegativeInteger(status.timestamp_ns) &&
    isJointState(status.real) &&
    isJointState(status.desired) &&
    isRobotInterface(status.interface) &&
    Array.isArray(status.frames) &&
    status.frames.every(isRobotFrame)
  );
}

function isJointState(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const state = value as Record<string, unknown>;
  return (
    isFiniteNumberArray(state.pos) &&
    isFiniteNumberArray(state.vel) &&
    isFiniteNumberArray(state.acc) &&
    isFiniteNumberArray(state.torque)
  );
}

function isRobotInterface(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const robot_interface = value as Record<string, unknown>;
  return (
    isNonNegativeInteger(robot_interface.schema_version) &&
    typeof robot_interface.robot_type === "string" &&
    typeof robot_interface.connected === "boolean" &&
    isNonNegativeInteger(robot_interface.dof) &&
    typeof robot_interface.servo_activated === "boolean" &&
    typeof robot_interface.brake_released === "boolean" &&
    typeof robot_interface.brake_state_source === "string" &&
    typeof robot_interface.motion_gate_state === "string" &&
    typeof robot_interface.motion_gate_reason === "string" &&
    isNonNegativeInteger(robot_interface.expected_wkc) &&
    isNonNegativeInteger(robot_interface.last_wkc) &&
    typeof robot_interface.last_error === "string"
  );
}

function isRobotFrame(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const frame = value as Record<string, unknown>;
  return (
    isNonNegativeInteger(frame.id) &&
    typeof frame.name === "string" &&
    isFiniteNumber(frame.x) &&
    isFiniteNumber(frame.y) &&
    isFiniteNumber(frame.z) &&
    isFiniteNumber(frame.r1) &&
    isFiniteNumber(frame.r2) &&
    isFiniteNumber(frame.r3) &&
    typeof frame.euler_type === "string" &&
    ["XYZ", "XZY", "YXZ", "YZX", "ZXY", "ZYX", "ZXZ", "ZYZ"].includes(
      frame.euler_type
    )
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isFiniteNumber);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isNullableNonNegativeInteger(value: unknown): value is number | null {
  return value === null || isNonNegativeInteger(value);
}
