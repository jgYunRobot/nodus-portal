import type {
  DeviceDirectoryEntry,
  DeviceEndpoint
} from "../device_directory/device_directory";

const OPERATOR_CONTRACT_VERSION = 1;
const ACTIVATION_SNAPSHOT_SCHEMA = "operator.activation.v1.ActivationSnapshot";

export interface OperatorActivationEndpoints {
  read: string;
  latched: string;
  hold_start: string;
  hold_heartbeat: string;
  hold_stop: string;
}

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
