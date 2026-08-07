import { describe, expect, it } from "vitest";
import { PortalComponentSession } from "./pilot_component_session";

function response(server_time = 1_000_000_000) {
  return {
    session_id: "opaque-session",
    server_instance_id: "pilot-a",
    accepted_protocol_version: 1 as const,
    accepted_schema_versions: [1] as [1],
    heartbeat_interval_ms: 10,
    lease_timeout_ms: 1_000,
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

  it("discards the anchor and operations on visibility loss and server replacement", async () => {
    let invalidations = 0;
    const session = new PortalComponentSession({
      client: {
        registerComponent: async () => response(),
        updateComponentState: async () => lifecycleResponse(),
        heartbeat: async () => lifecycleResponse()
      } as never,
      clock: { now: () => 10 },
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
