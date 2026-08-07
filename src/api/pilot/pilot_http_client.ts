import type { components } from "./generated/pilot_v1";
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

export class PilotHttpClient {
  private readonly base_url: string;
  private readonly fetch_pilot: PilotFetch;
  constructor(base_url = "same-origin", fetch_pilot?: PilotFetch) {
    this.base_url = base_url;
    this.fetch_pilot = fetch_pilot ?? ((input, init) => fetch(input, init));
  }
  getHealth(): Promise<components["schemas"]["HealthResponse"]> {
    return this.get("/api/v1/health");
  }
  getSnapshot(): Promise<components["schemas"]["PilotSnapshot"]> {
    return this.get("/api/v1/snapshot");
  }
  getComponents(): Promise<components["schemas"]["ComponentsResponse"]> {
    return this.get("/api/v1/components");
  }
  getEndpoints(): Promise<components["schemas"]["EndpointDirectoryResponse"]> {
    return this.get("/api/v1/endpoints");
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
    const timeout = window.setTimeout(() => controller.abort(), 5000);
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
    const response = await this.fetch_pilot(this.resolvePath(path), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const response_body = await response.json().catch(() => null);
    if (![200, 201, 202, 404, 409, 503].includes(response.status)) {
      throw new PilotHttpError(
        response.status,
        `Pilot POST ${path} failed with HTTP ${response.status}.`
      );
    }
    return { status: response.status, body: response_body };
  }
  private resolvePath(path: string): string {
    return this.base_url === "same-origin"
      ? path
      : new URL(path, this.base_url).toString();
  }
}
