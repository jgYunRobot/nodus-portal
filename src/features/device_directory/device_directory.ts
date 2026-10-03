import type { components } from "../../api/pilot/generated/pilot_v1";
import type {
  PilotComponentDirectory,
  PilotEndpointDirectory
} from "../../api/pilot/pilot_http_client";

const DEVICE_COMPONENT_TYPES = new Set<components["schemas"]["ComponentType"]>([
  "camera",
  "input_source",
  "policy"
]);

export type DeviceCardKind = "camera" | "operator" | "generic";

export interface DeviceDirectoryEntry {
  component_id: string;
  display_name: string;
  component_type: components["schemas"]["ComponentType"];
  card_kind: DeviceCardKind;
  lifecycle_state: components["schemas"]["CommonState"]["health"];
  lifecycle_reason: string | null;
  instance_id: string;
  session_generation: number;
  catalog_generation: number | null;
  capabilities: string[];
  endpoints: DeviceEndpoint[];
  endpoint_count: number;
  malformed_endpoint_count: number;
  runtime_key: string;
}

export interface DeviceEndpoint {
  descriptor_id: string;
  kind: "service" | "stream";
  capability: string;
  contract_version: number;
  protocol: "http" | "https";
  endpoint: string;
  media_type: string;
  schema_id: string | null;
  service_method: "GET" | "POST" | "PUT" | "DELETE" | null;
  request_schema_id: string | null;
  response_schema_id: string | null;
}

export interface EmptyDeviceSlot {
  kind: "empty";
  slot_number: number;
}

export interface ConnectedDeviceSlot {
  kind: "connected";
  entry: DeviceDirectoryEntry;
}

export type DeviceDeckSlot = ConnectedDeviceSlot | EmptyDeviceSlot;

export interface DeviceDirectory {
  entries: DeviceDirectoryEntry[];
  slots: DeviceDeckSlot[];
  server_instance_id: string;
  catalog_revision: number;
}

interface EndpointSummary {
  valid_endpoints: ParsedEndpoint[];
  malformed_endpoint_count: number;
}

interface ParsedEndpoint {
  component_type: components["schemas"]["ComponentType"];
  instance_id: string;
  session_generation: number;
  catalog_generation: number;
  descriptor: DeviceEndpoint;
}

export function createDeviceDirectory(
  components_response: PilotComponentDirectory,
  endpoint_directory: PilotEndpointDirectory
): DeviceDirectory {
  const endpoint_summaries = createEndpointSummaries(
    endpoint_directory.endpoints
  );
  const entries = components_response.components
    .flatMap(parsePublicComponent)
    .filter((component) => DEVICE_COMPONENT_TYPES.has(component.component_type))
    .map((component) => {
      const endpoint_summary = endpoint_summaries.get(component.component_id);
      const matched_endpoints = endpoint_summary?.valid_endpoints.filter(
        (endpoint) =>
          endpoint.component_type === component.component_type &&
          endpoint.instance_id === component.instance_id &&
          endpoint.session_generation === component.session_generation
      );
      const catalog_generation = getCatalogGeneration(matched_endpoints ?? []);
      return {
        component_id: component.component_id,
        display_name: getDisplayName(component),
        component_type: component.component_type,
        card_kind: getDeviceCardKind(component.component_type),
        lifecycle_state: component.state.health,
        lifecycle_reason: component.state.reason,
        instance_id: component.instance_id,
        session_generation: component.session_generation,
        catalog_generation,
        capabilities: [...component.capabilities].sort(),
        endpoints:
          matched_endpoints?.map((endpoint) => endpoint.descriptor) ?? [],
        endpoint_count: matched_endpoints?.length ?? 0,
        malformed_endpoint_count:
          endpoint_summary?.malformed_endpoint_count ?? 0,
        runtime_key: [
          endpoint_directory.server_instance_id,
          component.component_id,
          component.instance_id,
          component.session_generation,
          catalog_generation ?? "no-catalog"
        ].join(":")
      };
    })
    .sort(compareDeviceEntries);

  return {
    entries,
    slots: createDeviceDeckSlots(entries),
    server_instance_id: endpoint_directory.server_instance_id,
    catalog_revision: endpoint_directory.catalog_revision
  };
}

export function createDeviceDeckSlots(
  entries: DeviceDirectoryEntry[]
): DeviceDeckSlot[] {
  const empty_count = Math.max(0, 5 - entries.length);
  return [
    ...entries.map((entry) => ({ kind: "connected" as const, entry })),
    ...Array.from({ length: empty_count }, (_, index) => ({
      kind: "empty" as const,
      slot_number: index + 1
    }))
  ];
}

function createEndpointSummaries(
  endpoints: unknown[]
): Map<string, EndpointSummary> {
  const summaries = new Map<string, EndpointSummary>();
  for (const endpoint of endpoints) {
    const component_id = getEndpointComponentId(endpoint);
    if (component_id === null) continue;
    const summary = summaries.get(component_id) ?? {
      valid_endpoints: [],
      malformed_endpoint_count: 0
    };
    const parsed_endpoint = parseEndpoint(endpoint);
    if (parsed_endpoint === null) {
      summary.malformed_endpoint_count += 1;
    } else {
      summary.valid_endpoints.push(parsed_endpoint);
    }
    summaries.set(component_id, summary);
  }
  return summaries;
}

function getEndpointComponentId(value: unknown): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return null;
  const entry = value as Record<string, unknown>;
  return typeof entry.component_id === "string" ? entry.component_id : null;
}

function parsePublicComponent(
  value: unknown
): components["schemas"]["PublicComponent"][] {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return [];
  const component = value as Record<string, unknown>;
  if (
    typeof component.component_id !== "string" ||
    typeof component.instance_id !== "string" ||
    !isComponentType(component.component_type) ||
    !isPositiveInteger(component.session_generation) ||
    !Array.isArray(component.capabilities) ||
    !component.capabilities.every(
      (capability) => typeof capability === "string"
    ) ||
    !isComponentState(component.state) ||
    !isRecord(component.metadata)
  ) {
    return [];
  }
  return [component as components["schemas"]["PublicComponent"]];
}

function parseEndpoint(value: unknown): ParsedEndpoint | null {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return null;
  const entry = value as Record<string, unknown>;
  const descriptor = parseEndpointDescriptor(entry.descriptor);
  if (
    typeof entry.instance_id !== "string" ||
    !isComponentType(entry.component_type) ||
    !isPositiveInteger(entry.session_generation) ||
    !isPositiveInteger(entry.catalog_generation) ||
    descriptor === null
  ) {
    return null;
  }
  return {
    component_type: entry.component_type,
    instance_id: entry.instance_id,
    session_generation: entry.session_generation,
    catalog_generation: entry.catalog_generation,
    descriptor
  };
}

function parseEndpointDescriptor(value: unknown): DeviceEndpoint | null {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return null;
  const descriptor = value as Record<string, unknown>;
  if (
    typeof descriptor.descriptor_id !== "string" ||
    typeof descriptor.capability !== "string" ||
    !isPositiveInteger(descriptor.contract_version) ||
    !["http", "https"].includes(descriptor.protocol as string) ||
    typeof descriptor.endpoint !== "string" ||
    typeof descriptor.media_type !== "string"
  ) {
    return null;
  }
  let endpoint_url: URL;
  try {
    endpoint_url = new URL(descriptor.endpoint);
  } catch {
    return null;
  }
  if (endpoint_url.protocol !== `${descriptor.protocol as string}:`)
    return null;
  if (
    (descriptor.kind !== "service" && descriptor.kind !== "stream") ||
    (typeof descriptor.schema_id !== "string" &&
      descriptor.schema_id !== null) ||
    !isRecord(descriptor.metadata)
  ) {
    return null;
  }
  let service_method: DeviceEndpoint["service_method"] = null;
  let request_schema_id: string | null = null;
  let response_schema_id: string | null = null;
  if (descriptor.kind === "service") {
    if (
      !isRecord(descriptor.service) ||
      descriptor.stream !== null ||
      !["GET", "POST", "PUT", "DELETE"].includes(
        descriptor.service.method as string
      ) ||
      !isNullableString(descriptor.service.request_schema_id) ||
      !isNullableString(descriptor.service.response_schema_id)
    ) {
      return null;
    }
    service_method = descriptor.service
      .method as DeviceEndpoint["service_method"];
    request_schema_id = descriptor.service.request_schema_id;
    response_schema_id = descriptor.service.response_schema_id;
  } else if (descriptor.service !== null || !isRecord(descriptor.stream)) {
    return null;
  }
  return {
    descriptor_id: descriptor.descriptor_id,
    kind: descriptor.kind,
    capability: descriptor.capability,
    contract_version: descriptor.contract_version,
    protocol: descriptor.protocol as "http" | "https",
    endpoint: descriptor.endpoint,
    media_type: descriptor.media_type,
    schema_id: descriptor.schema_id,
    service_method,
    request_schema_id,
    response_schema_id
  };
}

function getDisplayName(
  component: components["schemas"]["PublicComponent"]
): string {
  const display_name = component.metadata.display_name;
  return typeof display_name === "string" && display_name.length > 0
    ? display_name
    : component.component_id;
}

function getDeviceCardKind(
  component_type: components["schemas"]["ComponentType"]
): DeviceCardKind {
  if (component_type === "camera") return "camera";
  if (component_type === "input_source") return "operator";
  return "generic";
}

function compareDeviceEntries(
  left: DeviceDirectoryEntry,
  right: DeviceDirectoryEntry
): number {
  return (
    left.display_name.localeCompare(right.display_name, "en-US", {
      sensitivity: "base"
    }) || left.component_id.localeCompare(right.component_id, "en-US")
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isComponentType(
  value: unknown
): value is components["schemas"]["ComponentType"] {
  return [
    "input_source",
    "camera",
    "policy",
    "ui",
    "observer",
    "service_provider"
  ].includes(value as string);
}

function isComponentState(
  value: unknown
): value is components["schemas"]["CommonState"] {
  if (!isRecord(value)) return false;
  return (
    ["starting", "ready", "degraded", "faulted", "stopping"].includes(
      value.health as string
    ) &&
    (typeof value.reason === "string" || value.reason === null) &&
    isRecord(value.details)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function getCatalogGeneration(endpoints: ParsedEndpoint[]): number | null {
  if (endpoints.length === 0) return null;
  return Math.max(...endpoints.map((endpoint) => endpoint.catalog_generation));
}
