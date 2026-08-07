import type { components } from "./generated/pilot_v1";
import { isSampleStreamsResponse } from "./pilot_runtime_guards";

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
  private resolvePath(path: string): string {
    return this.base_url === "same-origin"
      ? path
      : new URL(path, this.base_url).toString();
  }
}
