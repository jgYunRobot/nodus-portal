import type { components } from "./generated/pilot_v1";

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

type PilotFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export class PilotHttpClient {
  private readonly base_url: string;
  private readonly fetch_pilot: PilotFetch;
  constructor(base_url = "same-origin", fetch_pilot: PilotFetch = fetch) {
    this.base_url = base_url;
    this.fetch_pilot = fetch_pilot;
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
  getControlStatus(
    control_id: string
  ): Promise<components["schemas"]["ControlStatusResponse"]> {
    return this.get(
      `/api/v1/controls/${encodeURIComponent(control_id)}/status`
    );
  }
  private async get<T>(path: string): Promise<T> {
    const response = await this.fetch_pilot(this.resolvePath(path), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok)
      throw new PilotHttpError(
        response.status,
        `Pilot GET ${path} failed with HTTP ${response.status}.`
      );
    return response.json() as Promise<T>;
  }
  private resolvePath(path: string): string {
    return this.base_url === "same-origin"
      ? path
      : new URL(path, this.base_url).toString();
  }
}
