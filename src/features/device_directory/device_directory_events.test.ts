import { describe, expect, it, vi } from "vitest";
import { subscribeDeviceDirectoryEvents } from "./device_directory_events";

class FakeEventSource {
  readonly listeners = new Map<string, (event: Event) => void>();
  closed = false;
  onerror: ((event: Event) => unknown) | null = null;

  addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, listener);
  }

  emit(type: string, data?: string): void {
    this.listeners.get(type)?.(new MessageEvent(type, { data }));
  }

  close(): void {
    this.closed = true;
  }
}

describe("subscribeDeviceDirectoryEvents", () => {
  it("refreshes for lifecycle, catalog, gap, and connection errors", () => {
    const source = new FakeEventSource();
    const on_change = vi.fn();
    const create_source = vi.fn(() => source);
    const unsubscribe = subscribeDeviceDirectoryEvents(
      on_change,
      create_source
    );

    expect(create_source).toHaveBeenCalledWith("/api/v1/events/stream");
    source.emit("component_disconnected");
    source.emit("endpoint_catalog_removed");
    source.emit("gap");
    source.emit("unrelated");
    source.onerror?.(new Event("error"));
    expect(on_change).toHaveBeenCalledTimes(4);

    unsubscribe();
    expect(source.closed).toBe(true);
  });

  it("forwards only validated component-state evidence without another source", () => {
    const source = new FakeEventSource();
    const on_change = vi.fn();
    const on_event = vi.fn();
    const unsubscribe = subscribeDeviceDirectoryEvents(
      on_change,
      () => source,
      on_event
    );

    source.emit(
      "component_state_updated",
      JSON.stringify({
        payload: {
          component_id: "operator.leader",
          instance_id: "operator-instance-a",
          session_generation: 2
        }
      })
    );
    source.emit("component_state_updated", "not-json");
    source.emit(
      "component_state_updated",
      JSON.stringify({ payload: { component_id: "operator.leader" } })
    );

    expect(on_change).toHaveBeenCalledTimes(3);
    expect(on_event).toHaveBeenCalledTimes(1);
    expect(on_event).toHaveBeenCalledWith({
      event_type: "component_state_updated",
      component_id: "operator.leader",
      instance_id: "operator-instance-a",
      session_generation: 2
    });

    unsubscribe();
    expect(source.closed).toBe(true);
  });
});
