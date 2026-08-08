import type {
  DeviceDirectoryEntry,
  DeviceEndpoint
} from "../device_directory/device_directory";

const VISION_CONTRACT_VERSION = 1;
const VISION_API_VERSION = "1.3.0";

export interface VisionCameraEndpoints {
  health: DeviceEndpoint;
  metadata: DeviceEndpoint;
  color: DeviceEndpoint;
  depth: DeviceEndpoint | null;
}

export interface VisionCameraHealth {
  state: "starting" | "ready" | "degraded" | "stopping";
  camera_state: "disconnected" | "connected" | "streaming" | "degraded";
}

export interface VisionCameraMetadata {
  device_id: string;
  adapter: "fake" | "intel_d435";
  calibration_id: string;
  sensor_frame: string;
  mount_frame: string;
}

export interface VisionCameraRuntime {
  health: VisionCameraHealth;
  metadata: VisionCameraMetadata;
}

export function selectVisionCameraEndpoints(
  entry: DeviceDirectoryEntry
): VisionCameraEndpoints | null {
  if (entry.card_kind !== "camera") return null;
  const health = findEndpoint(
    entry.endpoints,
    "health",
    "service",
    "camera.health.get",
    "application/json",
    "nodus.vision.health.response.v1",
    "GET"
  );
  const metadata = findEndpoint(
    entry.endpoints,
    "metadata",
    "service",
    "camera.metadata.get",
    "application/json",
    "nodus.vision.metadata.response.v1",
    "GET"
  );
  const color = findEndpoint(
    entry.endpoints,
    "color-preview",
    "stream",
    "camera.stream.color.preview",
    "multipart/x-mixed-replace",
    "nodus.vision.mjpeg.color_part.v1",
    null
  );
  if (health === null || metadata === null || color === null) return null;
  return {
    health,
    metadata,
    color,
    depth: findEndpoint(
      entry.endpoints,
      "depth-preview",
      "stream",
      "camera.stream.depth.preview",
      "multipart/x-mixed-replace",
      "nodus.vision.mjpeg.depth_part.v1",
      null
    )
  };
}

export async function fetchVisionCameraRuntime(
  health_endpoint: string,
  metadata_endpoint: string,
  signal: AbortSignal
): Promise<VisionCameraRuntime> {
  const [health, metadata] = await Promise.all([
    fetchJson(health_endpoint, signal),
    fetchJson(metadata_endpoint, signal)
  ]);
  if (!isVisionHealth(health) || !isVisionMetadata(metadata)) {
    throw new Error(
      "Vision provider response does not match the pinned 1.3.0 contract."
    );
  }
  return { health, metadata };
}

function findEndpoint(
  endpoints: DeviceEndpoint[],
  descriptor_id: string,
  kind: DeviceEndpoint["kind"],
  capability: string,
  media_type: string,
  schema_id: string,
  service_method: DeviceEndpoint["service_method"]
): DeviceEndpoint | null {
  const matches = endpoints.filter(
    (endpoint) =>
      endpoint.descriptor_id === descriptor_id &&
      endpoint.kind === kind &&
      endpoint.capability === capability &&
      endpoint.contract_version === VISION_CONTRACT_VERSION &&
      endpoint.media_type === media_type &&
      endpoint.schema_id === schema_id &&
      endpoint.service_method === service_method &&
      hasMatchingProtocol(endpoint)
  );
  return matches.length === 1 ? matches[0] : null;
}

function hasMatchingProtocol(endpoint: DeviceEndpoint): boolean {
  try {
    return new URL(endpoint.endpoint).protocol === `${endpoint.protocol}:`;
  } catch {
    return false;
  }
}

async function fetchJson(
  endpoint: string,
  signal: AbortSignal
): Promise<unknown> {
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    signal
  });
  if (!response.ok) {
    throw new Error(
      `Vision GET ${endpoint} failed with HTTP ${response.status}.`
    );
  }
  const content_type = response.headers.get("content-type");
  if (content_type === null || !content_type.includes("application/json")) {
    throw new Error(`Vision GET ${endpoint} did not return JSON.`);
  }
  return response.json();
}

function isVisionHealth(value: unknown): value is VisionCameraHealth {
  if (!isRecord(value) || value.schema_version !== 1 || !isRecord(value.camera))
    return false;
  return (
    ["starting", "ready", "degraded", "stopping"].includes(
      value.state as string
    ) &&
    ["disconnected", "connected", "streaming", "degraded"].includes(
      value.camera.state as string
    )
  );
}

function isVisionMetadata(value: unknown): value is VisionCameraMetadata {
  if (
    !isRecord(value) ||
    value.schema_version !== 1 ||
    value.api_version !== VISION_API_VERSION ||
    !isRecord(value.calibration)
  ) {
    return false;
  }
  return (
    typeof value.device_id === "string" &&
    ["fake", "intel_d435"].includes(value.adapter as string) &&
    typeof value.calibration.calibration_id === "string" &&
    typeof value.calibration.sensor_frame === "string" &&
    typeof value.calibration.mount_frame === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
