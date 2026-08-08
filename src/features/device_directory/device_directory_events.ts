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

interface DeviceDirectoryEventSource {
  addEventListener(type: string, listener: (event: Event) => void): void;
  close(): void;
  onerror: ((event: Event) => unknown) | null;
}

export function subscribeDeviceDirectoryEvents(
  on_change: () => void,
  create_source: (url: string) => DeviceDirectoryEventSource = (url) =>
    new EventSource(url)
): () => void {
  const source = create_source(resolvePilotPath("/api/v1/events/stream"));
  for (const event_type of DEVICE_DIRECTORY_EVENT_TYPES)
    source.addEventListener(event_type, on_change);
  source.onerror = on_change;
  return () => source.close();
}
