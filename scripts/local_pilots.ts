import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  request as requestHttp,
  type IncomingMessage,
  type ServerResponse
} from "node:http";
import { request as requestHttps } from "node:https";
import { URL } from "node:url";
import type { Connect, Plugin } from "vite";
import type {
  DiscoveredPilot,
  PilotDirectory
} from "../src/features/pilot_directory/pilot_directory";

const DIRECTORY_PATH = "/__portal/pilots";
const DISCOVERY_INTERVAL_MS = 3000;
const PROBE_TIMEOUT_MS = 400;
const MAX_CANDIDATES = 256;
const PROBE_CONCURRENCY = 8;
const MAX_PROBE_RESPONSE_BYTES = 1024 * 1024;
const FORWARD_TIMEOUT_MS = 5000;

export function parseListeningEndpoints(text: string, ipv6 = false): string[] {
  return text.split("\n").flatMap((line) => {
    const fields = line.trim().split(/\s+/);
    if (fields[3] !== "0A") return [];
    const [address, port_hex] = fields[1].split(":");
    const port = parseInt(port_hex, 16);
    if (ipv6) {
      if (!/^(0{32}|0{24}01000000)$/.test(address)) return [];
      return [`http://[::1]:${port}`];
    }
    if (address !== "00000000" && !address.endsWith("7F")) return [];
    const host =
      address === "00000000"
        ? "127.0.0.1"
        : address
            .match(/../g)!
            .reverse()
            .map((octet) => parseInt(octet, 16))
            .join(".");
    return [`http://${host}:${port}`];
  });
}

async function readLocalEndpoints(): Promise<string[]> {
  const tables = await Promise.all([
    readFile("/proc/net/tcp", "utf8"),
    readFile("/proc/net/tcp6", "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return "";
    })
  ]);
  return [
    ...parseListeningEndpoints(tables[0]),
    ...parseListeningEndpoints(tables[1], true)
  ];
}

function endpointUrl(endpoint: string, path: string): URL {
  return new URL(path.replace(/^\//, ""), `${endpoint.replace(/\/$/, "")}/`);
}

async function readPilotJson(
  endpoint: string,
  path: string
): Promise<Record<string, unknown>> {
  const response = await fetch(endpointUrl(endpoint, path), {
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    redirect: "error"
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Pilot probe HTTP ${response.status}`);
  }
  const reader = response.body?.getReader();
  if (reader === undefined)
    throw new Error("Pilot probe returned no JSON body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PROBE_RESPONSE_BYTES)
        throw new Error("Pilot probe JSON exceeds the response size limit.");
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(body)) as Record<
      string,
      unknown
    >;
  } finally {
    try {
      await reader.cancel();
    } finally {
      reader.releaseLock();
    }
  }
}

async function probePilot(endpoint: string): Promise<DiscoveredPilot | null> {
  try {
    const health = await readPilotJson(endpoint, "/api/v1/health");
    if (health.status !== "ok" || typeof health.server_instance_id !== "string")
      return null;
    const streams = await readPilotJson(endpoint, "/api/v1/pilot/streams");
    if (
      streams.server_instance_id !== health.server_instance_id ||
      !Array.isArray(streams.streams)
    )
      return null;
    const control_ids = [
      ...new Set(
        streams.streams.flatMap((stream) =>
          stream?.stream_kind === "robot_status" &&
          typeof stream.control_id === "string"
            ? [stream.control_id as string]
            : []
        )
      )
    ].sort();
    return {
      pilot_id: createHash("sha256")
        .update(endpoint)
        .digest("hex")
        .slice(0, 24),
      endpoint,
      server_instance_id: health.server_instance_id,
      control_ids
    };
  } catch {
    // Listening sockets belonging to other applications are not Pilot candidates.
    return null;
  }
}

interface DirectoryOptions {
  configured_endpoints?: string[];
  local_endpoints?: () => Promise<string[]>;
  own_port?: () => number | undefined;
}

export function createLocalPilotMiddleware(
  options: DirectoryOptions = {}
): Connect.NextHandleFunction {
  let catalog: PilotDirectory = {
    schema_version: 1,
    pilots: [],
    partial: false,
    discovery_error: null
  };
  const known_pilots = new Map<string, DiscoveredPilot>();
  let discovered_pilots: DiscoveredPilot[] = [];
  const identity_checks = new Map<string, Promise<Record<string, unknown>>>();

  function checkIdentity(
    pilot: DiscoveredPilot
  ): Promise<Record<string, unknown>> {
    let check = identity_checks.get(pilot.pilot_id);
    if (check === undefined) {
      check = readPilotJson(pilot.endpoint, "/api/v1/health").finally(() => {
        identity_checks.delete(pilot.pilot_id);
      });
      identity_checks.set(pilot.pilot_id, check);
    }
    return check;
  }
  let refresh_at = 0;
  let pending: Promise<PilotDirectory> | null = null;

  async function refresh(): Promise<PilotDirectory> {
    if (pending !== null) return pending;
    if (Date.now() < refresh_at) return catalog;
    pending = (async () => {
      let discovery_error: string | null = null;
      const local = await (
        options.local_endpoints ?? readLocalEndpoints
      )().catch((error: Error) => {
        discovery_error = `Local Pilot socket discovery unavailable: ${error.message}`;
        return [];
      });
      const candidates = [
        ...new Set([
          ...catalog.pilots.map((pilot) => pilot.endpoint),
          ...(options.configured_endpoints ?? []),
          ...[...known_pilots.values()].map((pilot) => pilot.endpoint),
          ...local
        ])
      ].filter((endpoint) => {
        const url = new URL(endpoint);
        return !(
          Number(url.port) === options.own_port?.() &&
          ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
        );
      });
      const endpoints = candidates.slice(0, MAX_CANDIDATES);
      let partial = candidates.length > endpoints.length;
      const deadline = Date.now() + DISCOVERY_INTERVAL_MS;
      const found: DiscoveredPilot[] = [];
      let index = 0;
      await Promise.all(
        Array.from({ length: PROBE_CONCURRENCY }, async () => {
          while (index < endpoints.length) {
            if (Date.now() >= deadline) {
              partial = true;
              break;
            }
            const endpoint = endpoints[index++];
            const pilot = await probePilot(endpoint);
            if (pilot !== null) found.push(pilot);
          }
        })
      );
      // Prefer explicit origins over another interface of the same Pilot process.
      const unique = new Map<string, DiscoveredPilot>();
      found.sort(
        (a, b) => endpoints.indexOf(a.endpoint) - endpoints.indexOf(b.endpoint)
      );
      discovered_pilots = found;
      for (const pilot of found)
        if (!unique.has(pilot.server_instance_id))
          unique.set(pilot.server_instance_id, pilot);
      catalog = {
        schema_version: 1,
        pilots: [...unique.values()].sort((a, b) =>
          a.endpoint.localeCompare(b.endpoint)
        ),
        partial,
        discovery_error
      };
      // Keep every verified address current, even when the displayed process is deduplicated.
      for (const pilot of found) {
        known_pilots.delete(pilot.pilot_id);
        known_pilots.set(pilot.pilot_id, pilot);
      }
      while (known_pilots.size > MAX_CANDIDATES)
        known_pilots.delete(known_pilots.keys().next().value!);
      refresh_at = Date.now() + DISCOVERY_INTERVAL_MS;
      return catalog;
    })().finally(() => {
      pending = null;
    });
    return pending;
  }

  return (request, response, next) => {
    const request_url = new URL(request.url ?? "/", "http://portal.local");
    const path = request_url.pathname;
    if (path !== DIRECTORY_PATH && !path.startsWith(`${DIRECTORY_PATH}/`))
      return next();
    void (async () => {
      if (path === DIRECTORY_PATH) {
        const directory = await refresh();
        if (request.method !== "GET")
          return sendError(response, 405, "GET required");
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-store");
        const selected = discovered_pilots.find(
          (pilot) => pilot.pilot_id === request_url.searchParams.get("pilot")
        );
        response.end(
          JSON.stringify(
            selected === undefined
              ? directory
              : {
                  ...directory,
                  pilots: directory.pilots
                    .map((pilot) =>
                      pilot.server_instance_id === selected.server_instance_id
                        ? selected
                        : pilot
                    )
                    .sort((a, b) => a.endpoint.localeCompare(b.endpoint))
                }
          )
        );
        return;
      }
      const match = /^\/__portal\/pilots\/([a-f0-9]{24})(\/api\/v1\/.*)$/.exec(
        path
      );
      const pilot = match === null ? undefined : known_pilots.get(match[1]);
      if (pilot === undefined || match === null)
        return sendError(
          response,
          503,
          "Selected Pilot is unavailable; select a discovered robot."
        );
      const health = await checkIdentity(pilot);
      // The browser may have left while the identity probe was pending.
      if (request.aborted || response.destroyed || response.writableEnded)
        return;
      if (
        health.status !== "ok" ||
        health.server_instance_id !== pilot.server_instance_id
      )
        return sendError(
          response,
          503,
          "Selected Pilot restarted; waiting for discovery refresh."
        );
      const query = new URL(request.url ?? "/", "http://portal.local").search;
      forwardRequest(
        request,
        response,
        endpointUrl(pilot.endpoint, `${match[2]}${query}`)
      );
    })().catch(() =>
      sendError(response, 503, "Selected Pilot is unavailable.")
    );
  };
}

function sendError(
  response: ServerResponse,
  status: number,
  message: string
): void {
  if (response.destroyed || response.writableEnded) return;
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  response.end(
    JSON.stringify({ error: { code: "pilot_unavailable", message } })
  );
}

function forwardRequest(
  request: IncomingMessage,
  response: ServerResponse,
  target: URL
): void {
  const headers = { ...request.headers, host: target.host };
  delete headers.connection;
  const upstream = (target.protocol === "https:" ? requestHttps : requestHttp)(
    target,
    {
      method: request.method,
      headers
    },
    (incoming) => {
      if (response.destroyed || response.writableEnded) {
        incoming.destroy();
        return;
      }
      if (incoming.headers["content-type"]?.startsWith("text/event-stream"))
        upstream.setTimeout(0);
      const outgoing_headers = { ...incoming.headers };
      delete outgoing_headers.connection;
      response.writeHead(incoming.statusCode ?? 502, outgoing_headers);
      incoming.pipe(response);
      incoming.on("error", () => response.destroy());
      incoming.on("aborted", () => response.destroy());
    }
  );
  upstream.setTimeout(FORWARD_TIMEOUT_MS, () => {
    upstream.destroy(new Error("Selected Pilot response timed out."));
  });
  upstream.on("error", () =>
    sendError(response, 503, "Selected Pilot connection failed.")
  );
  request.on("aborted", () => upstream.destroy());
  response.on("close", () => upstream.destroy());
  response.on("error", () => upstream.destroy());
  request.pipe(upstream);
}

export function localPilotPlugin(configured_endpoints: string[] = []): Plugin {
  function install(server: {
    middlewares: Connect.Server;
    httpServer: { address(): unknown } | null;
  }): void {
    server.middlewares.use(
      createLocalPilotMiddleware({
        configured_endpoints,
        own_port: () => {
          const address = server.httpServer?.address();
          return typeof address === "object" &&
            address !== null &&
            "port" in address
            ? Number(address.port)
            : undefined;
        }
      })
    );
  }
  return {
    name: "nodus-local-pilots",
    configureServer: install,
    configurePreviewServer: install
  };
}
