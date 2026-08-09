import { describe, expect, it, vi } from "vitest";
import { OperatorActivationClient } from "./operator_activation_client";
import type {
  OperatorActivationEndpoints,
  OperatorActivationSnapshot,
  OperatorHoldStartResponse
} from "./operator_activation_contract";
import { OperatorHoldSession } from "./operator_hold_session";

const endpoints: OperatorActivationEndpoints = {
  read: "http://operator.test/read",
  latched: "http://operator.test/latched",
  hold_start: "http://operator.test/hold/start",
  hold_heartbeat: "http://operator.test/hold/heartbeat",
  hold_stop: "http://operator.test/hold/stop"
};

function snapshot(
  overrides: Partial<OperatorActivationSnapshot> = {}
): OperatorActivationSnapshot {
  return {
    schema_version: 1,
    component_id: "operator.leader",
    instance_id: "operator-instance-a",
    target_control_id: "control-a",
    source_id: "leader-arm",
    terminal_mode: "latched",
    run_state: "running",
    activation_kind: "remote_hold",
    generation: 3,
    revision: 4,
    ready: true,
    hold_lease: { lease_id: "lease-a", generation: 3, expires_in_ms: 500 },
    fault: null,
    ...overrides
  };
}

function holdStartResponse(): OperatorHoldStartResponse {
  return {
    lease: { lease_id: "lease-a", generation: 3, expires_in_ms: 500 },
    snapshot: snapshot()
  };
}

function deferred<T>() {
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((next_resolve, next_reject) => {
    resolve = next_resolve;
    reject = next_reject;
  });
  return { promise, resolve: resolve!, reject: reject! };
}

function createSession(
  overrides: {
    start?: () => Promise<OperatorHoldStartResponse>;
    heartbeat?: () => Promise<OperatorActivationSnapshot>;
    stop?: () => Promise<OperatorActivationSnapshot>;
  } = {}
) {
  let heartbeat_callback: (() => void) | null = null;
  const client = {
    startHold: vi.fn(overrides.start ?? (async () => holdStartResponse())),
    heartbeatHold: vi.fn(overrides.heartbeat ?? (async () => snapshot())),
    stopHold: vi.fn(
      overrides.stop ??
        (async () =>
          snapshot({
            run_state: "paused",
            activation_kind: "none",
            hold_lease: null
          }))
    )
  };
  const set_interval = vi.fn((callback: () => void) => {
    heartbeat_callback = callback;
    return 17;
  });
  const clear_interval = vi.fn();
  const received_snapshots = vi.fn();
  const session = new OperatorHoldSession({
    client: client as unknown as OperatorActivationClient,
    endpoints,
    is_current_snapshot: () => true,
    on_snapshot: received_snapshots,
    create_request_id: () => "portal-hold-request-a",
    set_interval: set_interval as unknown as typeof window.setInterval,
    clear_interval: clear_interval as unknown as typeof window.clearInterval
  });
  return {
    session,
    client,
    get_heartbeat_callback: () => heartbeat_callback,
    set_interval,
    clear_interval,
    received_snapshots
  };
}

describe("OperatorHoldSession", () => {
  it("owns one returned lease and sends heartbeats at 100 ms without overlap", async () => {
    const heartbeat = deferred<OperatorActivationSnapshot>();
    const fixture = createSession({ heartbeat: () => heartbeat.promise });

    expect(fixture.session.start()).toBe(true);
    await vi.waitFor(() => expect(fixture.session.getState()).toBe("holding"));
    expect(fixture.client.startHold).toHaveBeenCalledWith(
      endpoints.hold_start,
      {
        request_id: "portal-hold-request-a"
      }
    );
    expect(fixture.set_interval).toHaveBeenCalledWith(
      expect.any(Function),
      100
    );

    fixture.get_heartbeat_callback()?.();
    fixture.get_heartbeat_callback()?.();
    expect(fixture.client.heartbeatHold).toHaveBeenCalledTimes(1);
    heartbeat.resolve(snapshot({ revision: 5 }));
    await vi.waitFor(() =>
      expect(fixture.received_snapshots).toHaveBeenCalledTimes(2)
    );
  });

  it("stops a lease that arrives after the user has already released", async () => {
    const start = deferred<OperatorHoldStartResponse>();
    const fixture = createSession({ start: () => start.promise });

    fixture.session.start();
    fixture.session.release();
    start.resolve(holdStartResponse());

    await vi.waitFor(() =>
      expect(fixture.client.stopHold).toHaveBeenCalledTimes(1)
    );
    expect(fixture.client.stopHold).toHaveBeenCalledWith(endpoints.hold_stop, {
      lease_id: "lease-a",
      generation: 3
    });
    expect(fixture.set_interval).not.toHaveBeenCalled();
  });

  it("closes local admission after a heartbeat failure and never restarts", async () => {
    const fixture = createSession({
      heartbeat: async () => {
        throw new Error("network failed");
      }
    });

    fixture.session.start();
    await vi.waitFor(() => expect(fixture.session.getState()).toBe("holding"));
    fixture.get_heartbeat_callback()?.();
    await vi.waitFor(() =>
      expect(fixture.session.getState()).toBe("recovering")
    );
    expect(fixture.clear_interval).toHaveBeenCalledWith(17);
    expect(fixture.session.start()).toBe(false);
  });
});
