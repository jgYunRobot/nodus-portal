import { resolvePilotPath } from "../../api/pilot/pilot_http_client";

const DEVICE_DIRECTORY_EVENT_TYPES = [
  "component_registered",
  "component_state_updated",
  "component_disconnected",
  "component_expired",
  "endpoint_catalog_published",
  "endpoint_catalog_removed",
  "gap"
] as const;

export type DeviceDirectoryEvent = {
  event_type: "component_state_updated";
  component_id: string;
  instance_id: string;
  session_generation: number;
};

interface DeviceDirectoryEventSource {
  addEventListener(type: string, listener: (event: Event) => void): void;
  close(): void;
  onerror: ((event: Event) => unknown) | null;
}

export function subscribeDeviceDirectoryEvents(
  on_change: () => void,
  create_source: (url: string) => DeviceDirectoryEventSource = (url) =>
    new EventSource(url),
  on_event?: (event: DeviceDirectoryEvent) => void
): () => void {
  const source = create_source(resolvePilotPath("/api/v1/events/stream"));
  for (const event_type of DEVICE_DIRECTORY_EVENT_TYPES)
    source.addEventListener(event_type, (event) => {
      on_change();
      const directory_event = parseDeviceDirectoryEvent(event, event_type);
      if (directory_event !== null) on_event?.(directory_event);
    });
  source.onerror = on_change;
  return () => source.close();
}

function parseDeviceDirectoryEvent(
  event: Event,
  event_type: (typeof DEVICE_DIRECTORY_EVENT_TYPES)[number]
): DeviceDirectoryEvent | null {
  if (
    event_type !== "component_state_updated" ||
    !(event instanceof MessageEvent)
  )
    return null;
  if (typeof event.data !== "string") return null;
  try {
    const envelope = JSON.parse(event.data) as unknown;
    if (!isRecord(envelope) || !isRecord(envelope.payload)) return null;
    const payload = envelope.payload;
    if (
      typeof payload.component_id !== "string" ||
      payload.component_id.length === 0 ||
      typeof payload.instance_id !== "string" ||
      payload.instance_id.length === 0 ||
      !isPositiveInteger(payload.session_generation)
    ) {
      return null;
    }
    return {
      event_type,
      component_id: payload.component_id,
      instance_id: payload.instance_id,
      session_generation: payload.session_generation
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
