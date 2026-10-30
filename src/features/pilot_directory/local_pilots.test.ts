import { createServer, request as requestHttp, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLocalPilotMiddleware,
  parseListeningEndpoints
} from "../../../scripts/local_pilots";
import type { PilotDirectory } from "./pilot_directory";

const servers: Server[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        })
    )
  );
});

async function listen(server: Server): Promise<string> {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function fakePilot(id: string) {
  const state = { id, operations: [] as string[] };
  const endpoint = await listen(
    createServer((request, response) => {
      if (request.url?.endsWith("/status/stream")) {
        response.writeHead(200, { "Content-Type": "text/event-stream" });
        response.write(
          `event: robot_status\ndata: ${JSON.stringify({ from: state.id })}\n\n`
        );
        return;
      }
      response.setHeader("Content-Type", "application/json");
      if (request.url === "/api/v1/health")
        response.end(
          JSON.stringify({ status: "ok", server_instance_id: state.id })
        );
      else if (request.url === "/api/v1/pilot/streams")
        response.end(
          JSON.stringify({
            server_instance_id: state.id,
            streams: [
              {
                stream_kind: "robot_status",
                control_id: "control.same",
                stream_id: "status"
              }
            ]
          })
        );
      else if (request.method === "POST") {
        let body = "";
        request.on("data", (chunk) => {
          body += chunk;
        });
        request.on("end", () => {
          state.operations.push(body);
          response.end(JSON.stringify({ from: state.id }));
        });
      } else
        response.end(JSON.stringify({ from: state.id, path: request.url }));
    })
  );
  return { endpoint, state };
}

async function host(endpoints: string[]) {
  const middleware = createLocalPilotMiddleware({
    local_endpoints: async () => endpoints
  });
  return listen(
    createServer((request, response) =>
      middleware(request, response, () => {
        response.writeHead(404);
        response.end();
      })
    )
  );
}

describe("local Pilot discovery and identity-scoped proxy", () => {
  it("reads only listening loopback/all-interface TCP sockets", () => {
    expect(
      parseListeningEndpoints(
        "0: 0100007F:C351 00000000:0000 0A\n1: 0100007F:C352 00000000:0000 01\n2: 0101A8C0:C353 00000000:0000 0A"
      )
    ).toEqual(["http://127.0.0.1:50001"]);
    expect(
      parseListeningEndpoints(
        "0: 00000000000000000000000001000000:C351 0:0 0A",
        true
      )
    ).toEqual(["http://[::1]:50001"]);
  });

  it("keeps duplicate Control IDs isolated and forwards a command only once to the chosen Pilot", async () => {
    const a = await fakePilot("pilot-a");
    const b = await fakePilot("pilot-b");
    const origin = await host([a.endpoint, b.endpoint]);
    const directory: PilotDirectory = await (
      await fetch(`${origin}/__portal/pilots`)
    ).json();
    expect(directory.pilots).toHaveLength(2);
    expect(directory.pilots.map((p) => p.control_ids)).toEqual([
      ["control.same"],
      ["control.same"]
    ]);
    const selected = directory.pilots.find(
      (p) => p.server_instance_id === "pilot-b"
    )!;
    const response = await fetch(
      `${origin}/__portal/pilots/${selected.pilot_id}/api/v1/operations`,
      { method: "POST", body: "command-b" }
    );
    expect(await response.json()).toEqual({ from: "pilot-b" });
    expect(a.state.operations).toEqual([]);
    expect(b.state.operations).toEqual(["command-b"]);
    expect(
      (
        await fetch(`${origin}/__portal/pilots/unselected/api/v1/operations`, {
          method: "POST"
        })
      ).status
    ).toBe(503);
  });

  it("retains the selected endpoint across restart and blocks mutations until rediscovery", async () => {
    const pilot = await fakePilot("old-process");
    const origin = await host([pilot.endpoint]);
    const first: PilotDirectory = await (
      await fetch(`${origin}/__portal/pilots`)
    ).json();
    const old_id = first.pilots[0].pilot_id;
    pilot.state.id = "replacement-process";
    expect(
      (
        await fetch(`${origin}/__portal/pilots/${old_id}/api/v1/operations`, {
          method: "POST",
          body: "must-not-run"
        })
      ).status
    ).toBe(503);
    expect(pilot.state.operations).toEqual([]);
    const future = Date.now() + 5000;
    vi.spyOn(Date, "now").mockReturnValue(future);
    const next: PilotDirectory = await (
      await fetch(`${origin}/__portal/pilots`)
    ).json();
    expect(next.pilots[0].pilot_id).toBe(old_id);
    expect(next.pilots[0].server_instance_id).toBe("replacement-process");
    const recovered = await fetch(
      `${origin}/__portal/pilots/${old_id}/api/v1/health`
    );
    expect(await recovered.json()).toMatchObject({
      server_instance_id: "replacement-process"
    });
    expect(pilot.state.operations).toEqual([]);
    const restarted_origin = await host([pilot.endpoint]);
    const restarted: PilotDirectory = await (
      await fetch(`${restarted_origin}/__portal/pilots`)
    ).json();
    expect(restarted.pilots[0].pilot_id).toBe(old_id);
  });

  it("streams SSE immediately through the selected namespace", async () => {
    const pilot = await fakePilot("stream-pilot");
    const origin = await host([pilot.endpoint]);
    const directory: PilotDirectory = await (
      await fetch(`${origin}/__portal/pilots`)
    ).json();
    const response = await fetch(
      `${origin}/__portal/pilots/${directory.pilots[0].pilot_id}/api/v1/controls/control.same/status/stream`
    );
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      '"from":"stream-pilot"'
    );
    await reader.cancel();
  });

  it("publishes discovery limitations instead of claiming a complete empty directory", async () => {
    const middleware = createLocalPilotMiddleware({
      local_endpoints: async () => {
        throw new Error("socket list denied");
      }
    });
    const origin = await listen(
      createServer((req, res) => middleware(req, res, () => res.end()))
    );
    const directory: PilotDirectory = await (
      await fetch(`${origin}/__portal/pilots`)
    ).json();
    expect(directory.pilots).toEqual([]);
    expect(directory.discovery_error).toContain("socket list denied");
  });
});

describe("selected Pilot request latency isolation", () => {
  it("forwards through a verified namespace while an unrelated discovery refresh is blocked", async () => {
    const pilot = await fakePilot("selected-process");
    let release!: (endpoints: string[]) => void;
    let entered!: () => void;
    const refresh_entered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const blocked = new Promise<string[]>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const middleware = createLocalPilotMiddleware({
      local_endpoints: async () => {
        if (calls++ === 0) return [pilot.endpoint];
        entered();
        return blocked;
      }
    });
    const origin = await listen(
      createServer((req, res) => middleware(req, res, () => res.end()))
    );
    const first: PilotDirectory = await (
      await fetch(`${origin}/__portal/pilots`)
    ).json();
    const future = Date.now() + 5000;
    vi.spyOn(Date, "now").mockReturnValue(future);
    const directory_response = fetch(`${origin}/__portal/pilots`);
    await refresh_entered;
    const command = await fetch(
      `${origin}/__portal/pilots/${first.pilots[0].pilot_id}/api/v1/operations`,
      { method: "POST", body: "selected-command" }
    );
    expect(command.status).toBe(200);
    expect(pilot.state.operations).toEqual(["selected-command"]);
    release([pilot.endpoint]);
    await directory_response;
  });
});

describe("selected Pilot proxy resource cleanup", () => {
  it("does not open an orphan SSE when the browser disconnects during the identity probe", async () => {
    let release_probe!: () => void;
    let entered_probe!: () => void;
    const probe_entered = new Promise<void>((resolve) => {
      entered_probe = resolve;
    });
    const probe_gate = new Promise<void>((resolve) => {
      release_probe = resolve;
    });
    let probes = 0;
    let streams_opened = 0;
    const connections = new Set<import("node:net").Socket>();
    const identified = new Set<import("node:net").Socket>();
    const pilot_server = createServer(async (request, response) => {
      identified.add(request.socket);
      if (request.url === "/api/v1/health") {
        if (++probes === 2) {
          entered_probe();
          await probe_gate;
        }
        response.end(
          JSON.stringify({ status: "ok", server_instance_id: "probe-race" })
        );
      } else if (request.url === "/api/v1/pilot/streams") {
        response.end(
          JSON.stringify({ server_instance_id: "probe-race", streams: [] })
        );
      } else {
        streams_opened++;
        response.writeHead(200, { "Content-Type": "text/event-stream" });
        response.write(": fixture\n\n");
      }
    });
    pilot_server.on("connection", (socket) => {
      connections.add(socket);
      socket.once("close", () => connections.delete(socket));
    });
    const endpoint = await listen(pilot_server);
    const middleware = createLocalPilotMiddleware({
      local_endpoints: async () => [endpoint]
    });
    let browser_closed!: () => void;
    const browser_gone = new Promise<void>((resolve) => {
      browser_closed = resolve;
    });
    const origin = await listen(
      createServer((req, res) => {
        if (req.url?.endsWith("/status/stream"))
          res.once("close", browser_closed);
        middleware(req, res, () => res.end());
      })
    );
    const directory: PilotDirectory = await (
      await fetch(`${origin}/__portal/pilots`)
    ).json();
    const browser = requestHttp(
      `${origin}/__portal/pilots/${directory.pilots[0].pilot_id}/api/v1/controls/control.same/status/stream`
    );
    browser.on("error", () => undefined);
    browser.end();
    await probe_entered;
    browser.destroy();
    await browser_gone;
    release_probe();
    // Observe the completed delayed probe and its network continuation before checking for a leaked stream.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(streams_opened).toBe(0);
    expect(
      [...connections].filter((socket) => !identified.has(socket))
    ).toHaveLength(0);
  });
});

describe("bounded Pilot probe and forwarding work", () => {
  it("coalesces simultaneous identity probes for the same selected Pilot", async () => {
    let health_requests = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const endpoint = await listen(
      createServer(async (request, response) => {
        if (request.url === "/api/v1/health") {
          if (++health_requests > 1) await gate;
          response.end(
            JSON.stringify({ status: "ok", server_instance_id: "coalesced" })
          );
        } else if (request.url === "/api/v1/pilot/streams") {
          response.end(
            JSON.stringify({ server_instance_id: "coalesced", streams: [] })
          );
        } else response.end(JSON.stringify({ status: "fixture" }));
      })
    );
    const middleware = createLocalPilotMiddleware({
      local_endpoints: async () => [endpoint]
    });
    let requests = 0;
    const origin = await listen(
      createServer((req, res) => {
        if (req.url !== "/__portal/pilots" && ++requests === 24) release();
        middleware(req, res, () => res.end());
      })
    );
    const directory: PilotDirectory = await (
      await fetch(`${origin}/__portal/pilots`)
    ).json();
    const responses = await Promise.all(
      Array.from({ length: 24 }, async () => {
        const response = await fetch(
          `${origin}/__portal/pilots/${directory.pilots[0].pilot_id}/api/v1/status`
        );
        await response.json();
        return response.status;
      })
    );
    expect(responses).toEqual(Array(24).fill(200));
    expect(health_requests).toBe(2);
  });

  it("rejects oversized discovery JSON instead of retaining an unbounded response", async () => {
    const endpoint = await listen(
      createServer((request, response) => {
        response.setHeader("Content-Type", "application/json");
        response.end(
          JSON.stringify(
            request.url === "/api/v1/health"
              ? {
                  status: "ok",
                  server_instance_id: "oversized",
                  padding: "x".repeat(1024 * 1024)
                }
              : { server_instance_id: "oversized", streams: [] }
          )
        );
      })
    );
    const origin = await host([endpoint]);
    const directory: PilotDirectory = await (
      await fetch(`${origin}/__portal/pilots`)
    ).json();
    expect(directory.pilots).toEqual([]);
  });

  it("times out a silent upstream and closes it without retrying the request", async () => {
    let forwarded = 0;
    let open_requests = 0;
    const endpoint = await listen(
      createServer((request, response) => {
        if (request.url === "/api/v1/health")
          response.end(
            JSON.stringify({ status: "ok", server_instance_id: "silent" })
          );
        else if (request.url === "/api/v1/pilot/streams")
          response.end(
            JSON.stringify({ server_instance_id: "silent", streams: [] })
          );
        else {
          forwarded++;
          open_requests++;
          response.once("close", () => {
            open_requests--;
          });
        }
      })
    );
    const origin = await host([endpoint]);
    const directory: PilotDirectory = await (
      await fetch(`${origin}/__portal/pilots`)
    ).json();
    const response = await fetch(
      `${origin}/__portal/pilots/${directory.pilots[0].pilot_id}/api/v1/hang`,
      { method: "POST", body: "once" }
    );
    expect(response.status).toBe(503);
    await response.json();
    await vi.waitFor(() => expect(open_requests).toBe(0));
    expect(forwarded).toBe(1);
  }, 10000);
});
