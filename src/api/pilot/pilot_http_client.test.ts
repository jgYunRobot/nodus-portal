import { afterEach, describe, expect, it } from "vitest";
import {
  configurePortalConfig,
  DEFAULT_PORTAL_CONFIG
} from "../../config/portal_config";
import { PilotHttpClient } from "./pilot_http_client";
import type { components } from "./generated/pilot_v1";

afterEach(() => configurePortalConfig(DEFAULT_PORTAL_CONFIG));

describe("PilotHttpClient", () => {
  it("uses the public same-origin health path", async () => {
    const requests: string[] = [];
    const client = new PilotHttpClient("same-origin", async (input) => {
      requests.push(String(input));
      return Response.json({ ready: true });
    });
    await expect(client.getHealth()).resolves.toEqual({ ready: true });
    expect(requests).toEqual(["/api/v1/health"]);
  });
  it("does not mark a mutation-like client failure retryable by default", async () => {
    const client = new PilotHttpClient(
      "https://pilot.example.test",
      async () => new Response(null, { status: 409 })
    );
    await expect(client.getComponents()).rejects.toMatchObject({
      status: 409,
      retryable: false
    });
  });
  it("accepts Pilot's native worker-completed operation result", async () => {
    const client = new PilotHttpClient("same-origin", async () =>
      Response.json({
        schema_version: 2,
        request_id: "jog-1",
        operation: "control.move_joint_online",
        control_id: "control.default",
        pilot_disposition: "forwarded",
        delivery: { outcome: "worker_completed", connection_generation: 1 },
        control_outcome: { status: "not_reported", code: null, message: null },
        result: null,
        error: null
      })
    );

    await expect(
      client.submitOperation({
        schema_version: 1,
        request_id: "jog-1",
        operation: "control.move_joint_online",
        session_id: "session-1",
        generation: 0,
        sequence: 1,
        source_timestamp_ns: 1_000,
        ttl_ms: 250,
        control_id: "control.default",
        payload: { target_position: [0, 0, 0, 0, 0, 0] }
      })
    ).resolves.toMatchObject({
      status: 200,
      body: { schema_version: 2, delivery: { outcome: "worker_completed" } }
    });
  });
  it.each(["linear", "circle", "joint"] as const)(
    "sends schema-v2 %s preparation and preserves the schema-v3 motion result",
    async (kind) => {
      const common = {
        schema_version: 2 as const,
        request_id: "motion-1",
        session_id: "session-1",
        generation: 0,
        sequence: 1,
        source_timestamp_ns: 1_000,
        ttl_ms: 250,
        control_id: "control.default"
      };
      const task_payload = {
        frame_id: 3,
        reference_id: 0,
        start: [0, 0, 0, 0, 0, 0, 1],
        dest: [0.1, 0, 0, 0, 0, 0, 1],
        linear_limit: [0.1, 0.2, 0.3],
        angular_limit: [0.1, 0.2, 0.3],
        auto_play: false
      };
      const request: components["schemas"]["OperationRequest"] =
        kind === "joint"
          ? {
              ...common,
              operation: "control.move_joint_request",
              payload: {
                start: [0],
                dest: [0.1],
                velocity_limit: [0.1],
                acceleration_limit: [0.2],
                jerk_limit: [0.3],
                auto_play: false
              }
            }
          : kind === "circle"
            ? {
                ...common,
                operation: "control.move_circle_request",
                payload: { ...task_payload, via: [0.05, 0.05, 0] }
              }
            : {
                ...common,
                operation: "control.move_linear_request",
                payload: task_payload
              };
      const result: components["schemas"]["OperationResultV3"] = {
        schema_version: 3,
        request_id: request.request_id,
        operation: request.operation,
        control_id: request.control_id,
        pilot_disposition: "forwarded",
        delivery: { outcome: "worker_completed", connection_generation: 1 },
        control_outcome: { status: "not_reported", code: null, message: null },
        result: { motion_id: 42, duration: 1.5, play_queued: false },
        error: null
      };
      const requests: { url: string; body: unknown }[] = [];
      const client = new PilotHttpClient("same-origin", async (input, init) => {
        requests.push({
          url: String(input),
          body: JSON.parse(String(init?.body))
        });
        return Response.json(result);
      });

      await expect(client.submitOperation(request)).resolves.toEqual({
        status: 200,
        body: result
      });
      expect(requests).toEqual([{ url: "/api/v1/operations", body: request }]);
    }
  );
  it.each([
    null,
    { motion_id: 0, duration: 1, play_queued: false },
    { motion_id: 42, duration: -1, play_queued: false },
    { motion_id: 42, duration: 1 },
    { motion_id: 42, duration: 1, play_queued: "false" }
  ])("rejects malformed preparation result %j", async (result) => {
    const client = new PilotHttpClient("same-origin", async () =>
      Response.json({
        schema_version: 3,
        request_id: "motion-1",
        operation: "control.move_joint_request",
        control_id: "control.default",
        pilot_disposition: "forwarded",
        delivery: { outcome: "worker_completed", connection_generation: 1 },
        control_outcome: { status: "not_reported", code: null, message: null },
        result,
        error: null
      })
    );
    await expect(
      client.submitOperation({
        schema_version: 2,
        request_id: "motion-1",
        operation: "control.move_joint_request",
        session_id: "session-1",
        generation: 0,
        sequence: 1,
        source_timestamp_ns: 1_000,
        ttl_ms: 250,
        control_id: "control.default",
        payload: {
          start: [0],
          dest: [0.1],
          velocity_limit: [0.1],
          acceleration_limit: [0.2],
          jerk_limit: [0.3],
          auto_play: false
        }
      })
    ).rejects.toThrow("Pilot operation response is invalid.");
  });
  it("queries only public RobotStatus stream descriptors", async () => {
    const requests: string[] = [];
    const client = new PilotHttpClient("same-origin", async (input) => {
      requests.push(String(input));
      return Response.json({ server_instance_id: "pilot-a", streams: [] });
    });

    await expect(client.getRobotStatusStreams()).resolves.toEqual({
      server_instance_id: "pilot-a",
      streams: []
    });
    expect(requests).toEqual([
      "/api/v1/pilot/streams?stream_kind=robot_status"
    ]);
  });
  it("exhausts the public endpoint directory pages before returning", async () => {
    const requests: string[] = [];
    const pages = [
      {
        server_instance_id: "pilot-a",
        catalog_revision: 2,
        endpoints: [{ component_id: "camera-a" }],
        next_cursor: "next page"
      },
      {
        server_instance_id: "pilot-a",
        catalog_revision: 2,
        endpoints: [{ component_id: "operator-a" }],
        next_cursor: null
      }
    ];
    const client = new PilotHttpClient("same-origin", async (input) => {
      requests.push(String(input));
      const page = pages.shift();
      return Response.json(page);
    });

    await expect(client.getEndpoints()).resolves.toEqual({
      server_instance_id: "pilot-a",
      catalog_revision: 2,
      endpoints: [{ component_id: "camera-a" }, { component_id: "operator-a" }]
    });
    expect(requests).toEqual([
      "/api/v1/endpoints",
      "/api/v1/endpoints?cursor=next%20page"
    ]);
  });
  it("uses the configured Pilot base URL when no constructor override is given", async () => {
    configurePortalConfig({
      pilot_base_url: "https://pilot.example.test",
      portal_label: "Research Portal"
    });
    const requests: string[] = [];
    const client = new PilotHttpClient(undefined, async (input) => {
      requests.push(String(input));
      return Response.json({ status: "ok" });
    });

    await client.getHealth();
    expect(requests).toEqual(["https://pilot.example.test/api/v1/health"]);
  });
});
