import type {
  DeviceDirectoryEntry,
  DeviceEndpoint
} from "../device_directory/device_directory";
import type { components } from "../../api/operator/generated/operator_v1";

const OPERATOR_CONTRACT_VERSION = 1;
const ACTIVATION_SNAPSHOT_SCHEMA = "operator.activation.v1.ActivationSnapshot";

export interface OperatorActivationEndpoints {
  read: string;
  latched: string;
  hold_start: string;
  hold_heartbeat: string;
  hold_stop: string;
}

export type OperatorActivationSnapshot =
  components["schemas"]["ActivationSnapshot"];
export type OperatorActivationFault = components["schemas"]["ActivationFault"];
export type OperatorHoldLease = components["schemas"]["HoldLease"];
export type OperatorHoldStartResponse =
  components["schemas"]["HoldStartResponse"];
export type OperatorActivationErrorResponse =
  components["schemas"]["ErrorResponse"];

interface EndpointRequirement {
  key: keyof OperatorActivationEndpoints;
  descriptor_id: string;
  capability: string;
  service_method: DeviceEndpoint["service_method"];
  request_schema_id: string | null;
  response_schema_id: string;
}

const ENDPOINT_REQUIREMENTS: EndpointRequirement[] = [
  {
    key: "read",
    descriptor_id: "operator.activation.read",
    capability: "operator.activation.read.v1",
    service_method: "GET",
    request_schema_id: null,
    response_schema_id: ACTIVATION_SNAPSHOT_SCHEMA
  },
  {
    key: "latched",
    descriptor_id: "operator.activation.latched",
    capability: "operator.activation.latched.v1",
    service_method: "PUT",
    request_schema_id: "operator.activation.v1.LatchedActivationRequest",
    response_schema_id: ACTIVATION_SNAPSHOT_SCHEMA
  },
  {
    key: "hold_start",
    descriptor_id: "operator.activation.hold-start",
    capability: "operator.activation.hold.start.v1",
    service_method: "POST",
    request_schema_id: "operator.activation.v1.HoldStartRequest",
    response_schema_id: "operator.activation.v1.HoldStartResponse"
  },
  {
    key: "hold_heartbeat",
    descriptor_id: "operator.activation.hold-heartbeat",
    capability: "operator.activation.hold.heartbeat.v1",
    service_method: "POST",
    request_schema_id: "operator.activation.v1.HoldLeaseRequest",
    response_schema_id: ACTIVATION_SNAPSHOT_SCHEMA
  },
  {
    key: "hold_stop",
    descriptor_id: "operator.activation.hold-stop",
    capability: "operator.activation.hold.stop.v1",
    service_method: "POST",
    request_schema_id: "operator.activation.v1.HoldLeaseRequest",
    response_schema_id: ACTIVATION_SNAPSHOT_SCHEMA
  }
];

export function resolveOperatorActivationEndpoints(
  entry: DeviceDirectoryEntry
): OperatorActivationEndpoints | null {
  if (entry.component_type !== "input_source") return null;
  const endpoints = {} as OperatorActivationEndpoints;
  for (const requirement of ENDPOINT_REQUIREMENTS) {
    const matches = entry.endpoints.filter((endpoint) =>
      matchesRequirement(endpoint, requirement)
    );
    if (matches.length !== 1) return null;
    endpoints[requirement.key] = matches[0].endpoint;
  }
  return endpoints;
}

function matchesRequirement(
  endpoint: DeviceEndpoint,
  requirement: EndpointRequirement
): boolean {
  return (
    endpoint.descriptor_id === requirement.descriptor_id &&
    endpoint.kind === "service" &&
    endpoint.capability === requirement.capability &&
    endpoint.contract_version === OPERATOR_CONTRACT_VERSION &&
    endpoint.media_type === "application/json" &&
    endpoint.schema_id === requirement.response_schema_id &&
    endpoint.service_method === requirement.service_method &&
    endpoint.request_schema_id === requirement.request_schema_id &&
    endpoint.response_schema_id === requirement.response_schema_id &&
    hasMatchingProtocol(endpoint)
  );
}

function hasMatchingProtocol(endpoint: DeviceEndpoint): boolean {
  try {
    return new URL(endpoint.endpoint).protocol === `${endpoint.protocol}:`;
  } catch {
    return false;
  }
}

export function isOperatorActivationSnapshot(
  value: unknown
): value is OperatorActivationSnapshot {
  if (!hasExactKeys(value, ACTIVATION_SNAPSHOT_KEYS)) return false;
  const snapshot = value as Record<string, unknown>;
  return (
    snapshot.schema_version === 1 &&
    isIdentifier(snapshot.component_id) &&
    isIdentifier(snapshot.instance_id) &&
    isIdentifier(snapshot.target_control_id) &&
    isIdentifier(snapshot.source_id) &&
    (snapshot.terminal_mode === "latched" ||
      snapshot.terminal_mode === "hold_to_run") &&
    [
      "connecting",
      "paused",
      "starting",
      "running",
      "stopping",
      "fault",
      "shutting_down"
    ].includes(snapshot.run_state as string) &&
    ["none", "latched", "local_hold", "remote_hold"].includes(
      snapshot.activation_kind as string
    ) &&
    isNonNegativeSafeInteger(snapshot.generation) &&
    isNonNegativeSafeInteger(snapshot.revision) &&
    typeof snapshot.ready === "boolean" &&
    (snapshot.hold_lease === null ||
      isOperatorHoldLease(snapshot.hold_lease)) &&
    (snapshot.fault === null || isOperatorActivationFault(snapshot.fault))
  );
}

export function isOperatorHoldLease(
  value: unknown
): value is OperatorHoldLease {
  if (!hasExactKeys(value, HOLD_LEASE_KEYS)) return false;
  const lease = value as Record<string, unknown>;
  return (
    isIdentifier(lease.lease_id) &&
    isPositiveSafeInteger(lease.generation) &&
    isNonNegativeSafeInteger(lease.expires_in_ms) &&
    lease.expires_in_ms <= 5000
  );
}

export function isOperatorHoldStartResponse(
  value: unknown
): value is OperatorHoldStartResponse {
  if (!hasExactKeys(value, HOLD_START_RESPONSE_KEYS)) return false;
  const response = value as Record<string, unknown>;
  return (
    isOperatorHoldLease(response.lease) &&
    isOperatorActivationSnapshot(response.snapshot)
  );
}

export function isOperatorActivationErrorResponse(
  value: unknown
): value is OperatorActivationErrorResponse {
  if (!hasExactKeys(value, ERROR_RESPONSE_KEYS)) return false;
  const response = value as Record<string, unknown>;
  return (
    isOperatorActivationFault(response.error) &&
    (response.snapshot === null ||
      isOperatorActivationSnapshot(response.snapshot))
  );
}

export function matchesOperatorActivationRuntime(
  snapshot: OperatorActivationSnapshot,
  entry: DeviceDirectoryEntry,
  control_id: string
): boolean {
  return (
    snapshot.component_id === entry.component_id &&
    snapshot.instance_id === entry.instance_id &&
    snapshot.target_control_id === control_id
  );
}

function isOperatorActivationFault(
  value: unknown
): value is OperatorActivationFault {
  if (!hasExactKeys(value, ACTIVATION_FAULT_KEYS)) return false;
  const fault = value as Record<string, unknown>;
  return isBoundedString(fault.code, 64) && isBoundedString(fault.message, 256);
}

function hasExactKeys(value: unknown, keys: readonly string[]): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const value_keys = Object.keys(value).sort();
  return (
    value_keys.length === keys.length &&
    value_keys.every((key, index) => key === keys[index])
  );
}

function isIdentifier(value: unknown): value is string {
  return isBoundedString(value, 128);
}

function isBoundedString(
  value: unknown,
  maximum_length: number
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum_length
  );
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

const ACTIVATION_SNAPSHOT_KEYS = [
  "activation_kind",
  "component_id",
  "fault",
  "generation",
  "hold_lease",
  "instance_id",
  "ready",
  "revision",
  "run_state",
  "schema_version",
  "source_id",
  "target_control_id",
  "terminal_mode"
] as const;
const HOLD_LEASE_KEYS = ["expires_in_ms", "generation", "lease_id"] as const;
const HOLD_START_RESPONSE_KEYS = ["lease", "snapshot"] as const;
const ACTIVATION_FAULT_KEYS = ["code", "message"] as const;
const ERROR_RESPONSE_KEYS = ["error", "snapshot"] as const;
