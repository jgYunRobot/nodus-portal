import { afterEach, describe, expect, it, vi } from "vitest";
import { PortalComponentSession } from "./pilot_component_session";

function response(
  server_time = 1_000_000_000,
  heartbeat_interval_ms = 10,
  lease_timeout_ms = 1_000
) {
  return {
    session_id: "opaque-session",
    server_instance_id: "pilot-a",
    accepted_protocol_version: 1 as const,
    accepted_schema_versions: [1] as [1],
    heartbeat_interval_ms,
    lease_timeout_ms,
    server_time
  };
}

function lifecycleResponse() {
  return {
    status: "accepted" as const,
    snapshot: { server_instance_id: "pilot-a" }
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("PortalComponentSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates an RFC 4122 instance ID when randomUUID is unavailable", async () => {
    const random_bytes = Uint8Array.from({ length: 16 }, (_, index) => index);
    vi.stubGlobal("crypto", {
      getRandomValues: (target: Uint8Array) => {
        target.set(random_bytes);
        return target;
      }
    });
    let instance_id = "";
    const session = new PortalComponentSession({
      client: {
        registerComponent: async (request: { instance_id: string }) => {
          instance_id = request.instance_id;
          return response();
        },
        updateComponentState: async () => lifecycleResponse(),
        heartbeat: async () => lifecycleResponse()
      } as never
    });

    session.start();
    await flush();

    expect(instance_id).toBe("portal-00010203-0405-4607-8809-0a0b0c0d0e0f");
  });

  it("reuses one component ID for the same browser profile", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "browser-profile-id"
    });
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      }
    };
    const component_ids: string[] = [];
    const client = {
      registerComponent: async (request: { component_id: string }) => {
        component_ids.push(request.component_id);
        return response();
      },
      updateComponentState: async () => lifecycleResponse(),
      heartbeat: async () => lifecycleResponse()
    };

    const first_session = new PortalComponentSession({
      client: client as never,
      component_id: undefined,
      instance_id: "portal-first",
      storage
    });
    first_session.start();
    await flush();
    first_session.stop();

    const second_session = new PortalComponentSession({
      client: client as never,
      component_id: undefined,
      instance_id: "portal-second",
      storage
    });
    second_session.start();
    await flush();
    second_session.stop();

    expect(component_ids).toEqual([
      "nodus-portal.browser-profile-id",
      "nodus-portal.browser-profile-id"
    ]);
  });

  it("serializes lifecycle writes while keeping operation sequence separate", async () => {
    const calls: string[] = [];
    let heartbeat: (() => void) | undefined;
    const client = {
      registerComponent: async () => response(),
      updateComponentState: async (
        _session_id: string,
        request: { sequence: number }
      ) => {
        calls.push(`state:${request.sequence}`);
        return lifecycleResponse();
      },
      heartbeat: async (_session_id: string, request: { sequence: number }) => {
        calls.push(`heartbeat:${request.sequence}`);
        return lifecycleResponse();
      }
    };
    let now_ms = 10;
    const session = new PortalComponentSession({
      client: client as never,
      clock: { now: () => now_ms },
      component_id: "nodus-portal.test",
      instance_id: "portal-test",
      set_timeout: ((callback: () => void) => {
        heartbeat = callback;
        return 1;
      }) as typeof window.setTimeout,
      clear_timeout: (() => undefined) as typeof window.clearTimeout
    });

    session.start();
    await flush();
    now_ms = 20;
    heartbeat?.();
    await flush();
    const operation = session.reserveOperation();

    expect(calls).toEqual(["state:1", "heartbeat:2"]);
    expect(operation).toMatchObject({ generation: 0, sequence: 1 });
    expect(operation?.source_timestamp_ns).toBe(1_010_000_000);
  });

  it("keeps one registration while successful heartbeats renew multiple lease windows", async () => {
    let registrations = 0;
    let heartbeat_calls = 0;
    let heartbeat: (() => void) | undefined;
    let now_ms = 0;
    const session = new PortalComponentSession({
      client: {
        registerComponent: async () => {
          registrations += 1;
          return response(1_000_000_000, 100, 250);
        },
        updateComponentState: async () => lifecycleResponse(),
        heartbeat: async () => {
          heartbeat_calls += 1;
          return lifecycleResponse();
        }
      } as never,
      clock: { now: () => now_ms },
      component_id: "nodus-portal.test",
      instance_id: "portal-test",
      set_timeout: ((callback: () => void) => {
        heartbeat = callback;
        return 1;
      }) as typeof window.setTimeout,
      clear_timeout: (() => undefined) as typeof window.clearTimeout
    });

    session.start();
    await flush();
    for (let cycle = 0; cycle < 12; cycle += 1) {
      now_ms += 100;
      heartbeat?.();
      await flush();
    }

    expect(registrations).toBe(1);
    expect(heartbeat_calls).toBe(12);
    expect(session.getSnapshot().phase).toBe("ready");
  });

  it("discards the anchor and operations on visibility loss and server replacement", async () => {
    let invalidations = 0;
    const session = new PortalComponentSession({
      client: {
        registerComponent: async () => response(),
        updateComponentState: async () => lifecycleResponse(),
        heartbeat: async () => lifecycleResponse()
      } as never,
      clock: { now: () => 10 },
      component_id: "nodus-portal.test",
      instance_id: "portal-test",
      on_invalidate: () => {
        invalidations += 1;
      }
    });

    session.start();
    await flush();
    expect(session.reserveOperation()).not.toBeNull();
    session.observeServerInstance("pilot-b");
    expect(session.reserveOperation()).toBeNull();
    session.notifyVisibilityChange(true);
    expect(invalidations).toBeGreaterThanOrEqual(1);
  });

  it("does not reuse an old operation cursor after recovery", async () => {
    let registrations = 0;
    const session = new PortalComponentSession({
      client: {
        registerComponent: async () => {
          registrations += 1;
          return response(1_000 + registrations);
        },
        updateComponentState: async () => lifecycleResponse(),
        heartbeat: async () => lifecycleResponse()
      } as never,
      clock: { now: () => 10 },
      component_id: "nodus-portal.test",
      instance_id: "portal-test"
    });
    session.start();
    await flush();
    expect(session.reserveOperation()?.sequence).toBe(1);
    session.invalidate("unknown_session");
    await flush();
    expect(registrations).toBe(2);
    expect(session.reserveOperation()?.sequence).toBe(1);
  });
});
