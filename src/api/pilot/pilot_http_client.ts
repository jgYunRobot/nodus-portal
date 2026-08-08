import type { components } from "./generated/pilot_v1";
import { getPortalConfig } from "../../config/portal_config";
import {
  isComponentRegistrationResponse,
  isErrorResponse,
  isLifecycleAcceptedResponse,
  isOperationResult,
  isSampleStreamsResponse
} from "./pilot_runtime_guards";

export class PilotHttpError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PilotHttpError";
    this.status = status;
    this.retryable = status === 408 || status === 429 || status >= 500;
  }
}

export class PilotProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PilotProtocolError";
  }
}

type PilotFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface PilotHttpResponse<T> {
  status: number;
  body: T;
}

export interface PilotEndpointDirectory {
  server_instance_id: string;
  catalog_revision: number;
  endpoints: unknown[];
}

export interface PilotComponentDirectory {
  components: unknown[];
  snapshot_revision: number;
}

const PILOT_REQUEST_TIMEOUT_MS = 5000;

export function resolvePilotPath(
  path: string,
  base_url = getPortalConfig().pilot_base_url
): string {
  return base_url === "same-origin" ? path : new URL(path, base_url).toString();
}

export class PilotHttpClient {
  private readonly base_url: string;
  private readonly fetch_pilot: PilotFetch;
  constructor(
    base_url = getPortalConfig().pilot_base_url,
    fetch_pilot?: PilotFetch
  ) {
    this.base_url = base_url;
    this.fetch_pilot = fetch_pilot ?? ((input, init) => fetch(input, init));
  }
  getHealth(): Promise<components["schemas"]["HealthResponse"]> {
    return this.get("/api/v1/health");
  }
  getSnapshot(): Promise<components["schemas"]["PilotSnapshot"]> {
    return this.get("/api/v1/snapshot");
  }
  async getComponents(): Promise<PilotComponentDirectory> {
    const response = await this.get<unknown>("/api/v1/components");
    if (!isComponentDirectoryEnvelope(response)) {
      throw new PilotProtocolError(
        "Pilot component directory response does not match the public contract."
      );
    }
    return response;
  }
  async getEndpoints(): Promise<PilotEndpointDirectory> {
    const endpoints: unknown[] = [];
    const seen_cursors = new Set<string>();
    let cursor: string | null = null;
    let server_instance_id: string | null = null;
    let catalog_revision: number | null = null;

    do {
      const query: string =
        cursor === null ? "" : `?cursor=${encodeURIComponent(cursor)}`;
      const page: unknown = await this.get<unknown>(
        `/api/v1/endpoints${query}`
      );
      if (!isEndpointDirectoryEnvelope(page)) {
        throw new PilotProtocolError(
          "Pilot endpoint directory response does not match the public contract."
        );
      }
      if (
        (server_instance_id !== null &&
          page.server_instance_id !== server_instance_id) ||
        (catalog_revision !== null &&
          page.catalog_revision !== catalog_revision)
      ) {
        throw new PilotProtocolError(
          "Pilot endpoint directory changed while its pages were being read."
        );
      }
      server_instance_id = page.server_instance_id;
      catalog_revision = page.catalog_revision;
      endpoints.push(...page.endpoints);
      cursor = page.next_cursor;
      if (
        cursor !== null &&
        (seen_cursors.has(cursor) || seen_cursors.size >= 128)
      ) {
        throw new PilotProtocolError(
          "Pilot endpoint directory pagination did not terminate."
        );
      }
      if (cursor !== null) seen_cursors.add(cursor);
    } while (cursor !== null);

    return { server_instance_id, catalog_revision, endpoints };
  }
  async getRobotStatusStreams(): Promise<
    components["schemas"]["SampleStreamsResponse"]
  > {
    const response = await this.get<unknown>(
      "/api/v1/pilot/streams?stream_kind=robot_status"
    );
    if (!isSampleStreamsResponse(response)) {
      throw new PilotProtocolError(
        "Pilot stream directory response does not match the public contract."
      );
    }
    return response;
  }
  getControlStatus(
    control_id: string
  ): Promise<components["schemas"]["ControlStatusResponse"]> {
    return this.get(
      `/api/v1/controls/${encodeURIComponent(control_id)}/status`
    );
  }
  async registerComponent(
    request: components["schemas"]["ComponentRegistrationRequest"]
  ): Promise<components["schemas"]["ComponentRegistrationResponse"]> {
    const response = await this.post("/api/v1/components/register", request);
    if (
      response.status !== 201 ||
      !isComponentRegistrationResponse(response.body)
    ) {
      throw new PilotProtocolError(
        "Pilot component registration response is invalid."
      );
    }
    return response.body;
  }
  async heartbeat(
    session_id: string,
    request: components["schemas"]["HeartbeatRequest"]
  ): Promise<components["schemas"]["LifecycleAcceptedResponse"]> {
    return this.lifecyclePost(
      `/api/v1/components/${encodeURIComponent(session_id)}/heartbeat`,
      request
    );
  }
  async updateComponentState(
    session_id: string,
    request: components["schemas"]["ComponentStateUpdate"]
  ): Promise<components["schemas"]["LifecycleAcceptedResponse"]> {
    return this.lifecyclePost(
      `/api/v1/components/${encodeURIComponent(session_id)}/state`,
      request
    );
  }
  async submitOperation(
    request: components["schemas"]["OperationRequest"]
  ): Promise<
    PilotHttpResponse<
      | components["schemas"]["OperationResult"]
      | components["schemas"]["ErrorResponse"]
    >
  > {
    const response = await this.post("/api/v1/operations", request);
    if (
      ![200, 202, 409, 404, 503].includes(response.status) ||
      (!isOperationResult(response.body) && !isErrorResponse(response.body))
    ) {
      throw new PilotProtocolError("Pilot operation response is invalid.");
    }
    return response as PilotHttpResponse<
      | components["schemas"]["OperationResult"]
      | components["schemas"]["ErrorResponse"]
    >;
  }
  private async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      PILOT_REQUEST_TIMEOUT_MS
    );
    try {
      const response = await this.fetch_pilot(this.resolvePath(path), {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok)
        throw new PilotHttpError(
          response.status,
          `Pilot GET ${path} failed with HTTP ${response.status}.`
        );
      return response.json() as Promise<T>;
    } finally {
      window.clearTimeout(timeout);
    }
  }
  private async lifecyclePost<T>(path: string, request: T) {
    const response = await this.post(path, request);
    if (
      response.status !== 200 ||
      !isLifecycleAcceptedResponse(response.body)
    ) {
      throw new PilotProtocolError(
        "Pilot component lifecycle response is invalid."
      );
    }
    return response.body;
  }
  private async post<T>(
    path: string,
    body: T
  ): Promise<PilotHttpResponse<unknown>> {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      PILOT_REQUEST_TIMEOUT_MS
    );
    try {
      const response = await this.fetch_pilot(this.resolvePath(path), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const response_body = await response.json().catch(() => null);
      if (![200, 201, 202, 404, 409, 503].includes(response.status)) {
        throw new PilotHttpError(
          response.status,
          `Pilot POST ${path} failed with HTTP ${response.status}.`
        );
      }
      return { status: response.status, body: response_body };
    } finally {
      window.clearTimeout(timeout);
    }
  }
  private resolvePath(path: string): string {
    return resolvePilotPath(path, this.base_url);
  }
}

function isEndpointDirectoryEnvelope(value: unknown): value is {
  server_instance_id: string;
  catalog_revision: number;
  endpoints: unknown[];
  next_cursor: string | null;
} {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const response = value as Record<string, unknown>;
  return (
    typeof response.server_instance_id === "string" &&
    isNonNegativeInteger(response.catalog_revision) &&
    Array.isArray(response.endpoints) &&
    (typeof response.next_cursor === "string" || response.next_cursor === null)
  );
}

function isComponentDirectoryEnvelope(value: unknown): value is {
  components: unknown[];
  snapshot_revision: number;
} {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const response = value as Record<string, unknown>;
  return (
    Array.isArray(response.components) &&
    isNonNegativeInteger(response.snapshot_revision)
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
