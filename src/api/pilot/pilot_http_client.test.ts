import { afterEach, describe, expect, it } from "vitest";
import {
  configurePortalConfig,
  DEFAULT_PORTAL_CONFIG
} from "../../config/portal_config";
import { PilotHttpClient } from "./pilot_http_client";

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
