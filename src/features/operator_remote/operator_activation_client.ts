import type { components } from "../../api/operator/generated/operator_v1";
import {
  isOperatorActivationErrorResponse,
  isOperatorActivationSnapshot,
  isOperatorHoldStartResponse,
  type OperatorActivationErrorResponse,
  type OperatorActivationSnapshot,
  type OperatorHoldStartResponse
} from "./operator_activation_contract";

const OPERATOR_REQUEST_TIMEOUT_MS = 3000;
const MAX_OPERATOR_RESPONSE_BYTES = 64 * 1024;

type OperatorFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

type MutationBody =
  | components["schemas"]["LatchedActivationRequest"]
  | components["schemas"]["HoldStartRequest"]
  | components["schemas"]["HoldLeaseRequest"];

export class OperatorActivationHttpError extends Error {
  readonly status: number | null;
  readonly retryable_read: boolean;
  readonly uncertain_mutation: boolean;
  readonly response: OperatorActivationErrorResponse | null;

  constructor(
    message: string,
    options: {
      status?: number | null;
      retryable_read?: boolean;
      uncertain_mutation?: boolean;
      response?: OperatorActivationErrorResponse | null;
    } = {}
  ) {
    super(message);
    this.name = "OperatorActivationHttpError";
    this.status = options.status ?? null;
    this.retryable_read = options.retryable_read ?? false;
    this.uncertain_mutation = options.uncertain_mutation ?? false;
    this.response = options.response ?? null;
  }
}

export class OperatorActivationClient {
  private readonly fetch_operator: OperatorFetch;

  constructor(
    fetch_operator: OperatorFetch = (input, init) => fetch(input, init)
  ) {
    this.fetch_operator = fetch_operator;
  }

  async getActivation(
    endpoint: string,
    signal?: AbortSignal
  ): Promise<OperatorActivationSnapshot> {
    return this.requestSnapshot(endpoint, "GET", undefined, signal);
  }

  async setLatchedActivation(
    endpoint: string,
    request: components["schemas"]["LatchedActivationRequest"],
    signal?: AbortSignal
  ): Promise<OperatorActivationSnapshot> {
    return this.requestSnapshot(endpoint, "PUT", request, signal);
  }

  async startHold(
    endpoint: string,
    request: components["schemas"]["HoldStartRequest"],
    signal?: AbortSignal
  ): Promise<OperatorHoldStartResponse> {
    return this.request(
      endpoint,
      "POST",
      request,
      signal,
      isOperatorHoldStartResponse
    );
  }

  async heartbeatHold(
    endpoint: string,
    request: components["schemas"]["HoldLeaseRequest"],
    signal?: AbortSignal
  ): Promise<OperatorActivationSnapshot> {
    return this.requestSnapshot(endpoint, "POST", request, signal);
  }

  async stopHold(
    endpoint: string,
    request: components["schemas"]["HoldLeaseRequest"],
    signal?: AbortSignal
  ): Promise<OperatorActivationSnapshot> {
    return this.requestSnapshot(endpoint, "POST", request, signal);
  }

  private requestSnapshot(
    endpoint: string,
    method: "GET" | "POST" | "PUT",
    body: MutationBody | undefined,
    signal: AbortSignal | undefined
  ): Promise<OperatorActivationSnapshot> {
    return this.request(
      endpoint,
      method,
      body,
      signal,
      isOperatorActivationSnapshot
    );
  }

  private async request<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT",
    body: MutationBody | undefined,
    signal: AbortSignal | undefined,
    guard: (value: unknown) => value is T
  ): Promise<T> {
    const is_mutation = method !== "GET";
    const controller = new AbortController();
    let timed_out = false;
    const abort_from_parent = () => controller.abort();
    signal?.addEventListener("abort", abort_from_parent, { once: true });
    const timeout = window.setTimeout(() => {
      timed_out = true;
      controller.abort();
    }, OPERATOR_REQUEST_TIMEOUT_MS);
    try {
      let response: Response;
      try {
        response = await this.fetch_operator(endpoint, {
          method,
          headers:
            body === undefined
              ? { Accept: "application/json" }
              : {
                  Accept: "application/json",
                  "Content-Type": "application/json"
                },
          body: body === undefined ? undefined : JSON.stringify(body),
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal: controller.signal
        });
      } catch {
        throw new OperatorActivationHttpError(
          timed_out
            ? "Operator request timed out."
            : "Operator request failed.",
          {
            retryable_read: !is_mutation,
            uncertain_mutation: is_mutation
          }
        );
      }
      let payload: unknown;
      try {
        payload = await readJsonResponse(response, is_mutation);
      } catch (error) {
        if (error instanceof OperatorActivationHttpError) throw error;
        throw new OperatorActivationHttpError(
          "Operator response could not be read.",
          {
            status: response.status,
            retryable_read:
              !is_mutation && isRetryableReadStatus(response.status),
            uncertain_mutation: is_mutation
          }
        );
      }
      if (response.status === 200 && guard(payload)) return payload;
      const error_response = isOperatorActivationErrorResponse(payload)
        ? payload
        : null;
      throw new OperatorActivationHttpError(
        error_response?.error.message ?? "Operator response is incompatible.",
        {
          status: response.status,
          retryable_read:
            !is_mutation && isRetryableReadStatus(response.status),
          uncertain_mutation:
            is_mutation && (response.status !== 409 || error_response === null),
          response: error_response
        }
      );
    } finally {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort_from_parent);
    }
  }
}

async function readJsonResponse(
  response: Response,
  is_mutation: boolean
): Promise<unknown> {
  const content_type = response.headers.get("content-type");
  if (content_type === null || !content_type.startsWith("application/json")) {
    throw new OperatorActivationHttpError("Operator response is not JSON.", {
      status: response.status,
      retryable_read: !is_mutation && isRetryableReadStatus(response.status),
      uncertain_mutation: is_mutation
    });
  }
  const text = await readBoundedText(response, is_mutation);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new OperatorActivationHttpError(
      "Operator response JSON is malformed.",
      {
        status: response.status,
        retryable_read: !is_mutation && isRetryableReadStatus(response.status),
        uncertain_mutation: is_mutation
      }
    );
  }
}

async function readBoundedText(
  response: Response,
  is_mutation: boolean
): Promise<string> {
  const declared_length = response.headers.get("content-length");
  if (
    declared_length !== null &&
    Number.isSafeInteger(Number(declared_length)) &&
    Number(declared_length) > MAX_OPERATOR_RESPONSE_BYTES
  ) {
    throw new OperatorActivationHttpError(
      "Operator response exceeds its size limit.",
      {
        status: response.status,
        retryable_read: !is_mutation && isRetryableReadStatus(response.status),
        uncertain_mutation: is_mutation
      }
    );
  }
  if (response.body === null) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_OPERATOR_RESPONSE_BYTES) {
      await reader.cancel();
      throw new OperatorActivationHttpError(
        "Operator response exceeds its size limit.",
        {
          status: response.status,
          retryable_read:
            !is_mutation && isRetryableReadStatus(response.status),
          uncertain_mutation: is_mutation
        }
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function isRetryableReadStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}
