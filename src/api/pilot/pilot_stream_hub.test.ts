import { describe, expect, it, vi } from "vitest";
import { PilotStreamHub } from "./pilot_stream_hub";

function status(control_id: string, generation: number, sequence: number) {
  return {
    control_id,
    available: true,
    fresh: true,
    stale: false,
    age_ms: 1,
    request_pending: false,
    connection_generation: generation,
    last_success_monotonic_ns: 1,
    last_failure_monotonic_ns: null,
    configured_polling_hz: 60,
    measured_polling_hz: 60,
    missed_poll_count: 0,
    timeout_count: 0,
    gateway_queue_high_watermark: 0,
    sample: {
      sample_sequence: sequence,
      connection_generation: generation,
      source_timestamp_ns: 1,
      pilot_receive_monotonic_ns: 1,
      robot_state: {
        timestamp_ns: 1,
        real: { pos: [0, 0, 0, 0, 0, 0], vel: [], acc: [], torque: [] },
        desired: { pos: [0, 0, 0, 0, 0, 0], vel: [], acc: [], torque: [] },
        interface: {
          schema_version: 1,
          robot_type: "test",
          connected: true,
          dof: 6,
          servo_activated: true,
          brake_released: true,
          brake_state_source: "test",
          motion_gate_state: "test",
          motion_gate_reason: "",
          expected_wkc: 0,
          last_wkc: 0,
          last_error: ""
        },
        frames: []
      }
    }
  };
}

describe("PilotStreamHub", () => {
  it("keeps the initial external-store snapshot referentially stable", () => {
    const hub = new PilotStreamHub({
      create_source: () => ({
        addEventListener: () => undefined,
        close: () => undefined,
        onerror: null
      })
    });

    expect(hub.getSnapshot("control-alpha")).toBe(
      hub.getSnapshot("control-alpha")
    );
  });

  it("isolates controls and ignores duplicate or old samples", () => {
    const hub = new PilotStreamHub();
    const listener = vi.fn();
    hub.subscribe("alpha", listener);
    hub.accept("alpha", status("alpha", 1, 2));
    hub.accept("alpha", status("alpha", 1, 2));
    hub.accept("alpha", status("alpha", 1, 1));
    hub.accept("bravo", status("bravo", 1, 1));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(hub.getSnapshot("alpha").status?.sample?.sample_sequence).toBe(2);
    expect(hub.getSnapshot("bravo").status?.sample?.sample_sequence).toBe(1);
  });
  it("accepts skipped samples from the latest-only UI stream", () => {
    const read_latest = vi.fn(async () => status("alpha", 1, 2) as never);
    const hub = new PilotStreamHub({
      read_latest
    });
    hub.accept("alpha", status("alpha", 1, 1));
    hub.accept("alpha", status("alpha", 1, 3));
    expect(hub.getSnapshot("alpha").state).toBe("live");
    expect(hub.getSnapshot("alpha").status?.sample?.sample_sequence).toBe(3);
    expect(read_latest).not.toHaveBeenCalled();
  });
  it("accepts a new generation without comparing its old cursor", () => {
    const hub = new PilotStreamHub();
    hub.accept("alpha", status("alpha", 1, 1));
    hub.accept("alpha", status("alpha", 2, 1));
    expect(hub.getSnapshot("alpha").state).toBe("live");
    expect(hub.getSnapshot("alpha").status?.connection_generation).toBe(2);
  });
  it("bounds malformed status independently", () => {
    const hub = new PilotStreamHub();
    hub.accept("alpha", { control_id: "bravo" });
    expect(hub.getSnapshot("alpha").state).toBe("malformed");
  });
  it("rejects a status whose nested robot state is incomplete", () => {
    const hub = new PilotStreamHub();
    const malformed = status("alpha", 1, 1);
    malformed.sample.robot_state = {} as never;
    hub.accept("alpha", malformed);
    expect(hub.getSnapshot("alpha").state).toBe("malformed");
  });
  it("closes the one canonical SSE source after the last listener leaves", () => {
    const source = { addEventListener: vi.fn(), close: vi.fn(), onerror: null };
    const create_source = vi.fn(() => source);
    const hub = new PilotStreamHub({
      create_source,
      read_latest: async () => status("alpha", 1, 1) as never
    });
    hub.connect("alpha");
    hub.connect("alpha");
    const unsubscribe = hub.subscribe("alpha", vi.fn());
    unsubscribe();
    expect(create_source).toHaveBeenCalledTimes(1);
    expect(source.close).toHaveBeenCalledTimes(1);
    expect(hub.getSnapshot("alpha").state).toBe("recovering");
  });

  it("reseeds a retained snapshot before a reconnect can expose it as live", async () => {
    let latest_sequence = 1;
    const source = { addEventListener: vi.fn(), close: vi.fn(), onerror: null };
    const hub = new PilotStreamHub({
      create_source: () => source,
      read_latest: async () => status("alpha", 1, latest_sequence) as never
    });
    hub.accept("alpha", status("alpha", 1, 1));
    const first_unsubscribe = hub.subscribe("alpha", vi.fn());
    first_unsubscribe();
    expect(hub.getSnapshot("alpha").state).toBe("recovering");

    latest_sequence = 2;
    hub.connect("alpha");
    expect(hub.getSnapshot("alpha").state).toBe("recovering");
    await vi.waitFor(() => expect(hub.getSnapshot("alpha").state).toBe("live"));
    expect(hub.getSnapshot("alpha").status?.sample?.sample_sequence).toBe(2);
  });

  it("does not let an older recovery response replace a newer stream sample", async () => {
    let resolve_latest:
      ((value: ReturnType<typeof status>) => void) | undefined;
    const hub = new PilotStreamHub({
      create_source: () => ({
        addEventListener: () => undefined,
        close: () => undefined,
        onerror: null
      }),
      read_latest: () =>
        new Promise((resolve) => {
          resolve_latest = resolve;
        }) as never
    });
    hub.connect("alpha");
    hub.accept("alpha", status("alpha", 1, 3));
    resolve_latest?.(status("alpha", 1, 1));
    await Promise.resolve();
    expect(hub.getSnapshot("alpha").status?.sample?.sample_sequence).toBe(3);
  });
});
