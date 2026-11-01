import { resolvePilotPath } from "../../api/pilot/pilot_http_client";

export interface ApiResponse {
  status: number | null;
  status_text: string;
  headers: Record<string, string>;
  body: string;
  elapsed_ms: number;
  truncated: boolean;
}
export const RESPONSE_LIMIT = 64 * 1024;
const CONNECT_TIMEOUT_MS = 10000;
const STREAM_REFRESH_MS = 100;

export async function sendApiRequest(
  path: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  streaming: boolean,
  controller: AbortController,
  on_response: (response: ApiResponse) => void,
  fetch_api: typeof fetch = fetch
): Promise<void> {
  const started = performance.now();
  const timer = window.setTimeout(
    () => controller.abort("Request timed out after 10 seconds."),
    CONNECT_TIMEOUT_MS
  );
  let refresh: number | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch_api(resolvePilotPath(path), {
      method,
      headers: {
        Accept: streaming ? "text/event-stream" : "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers
      },
      body,
      signal: controller.signal,
      cache: "no-store"
    });
    const is_stream =
      streaming &&
      response.ok &&
      (response.headers.get("content-type") ?? "").includes(
        "text/event-stream"
      );
    if (is_stream) window.clearTimeout(timer);
    const snapshot: ApiResponse = {
      status: response.status,
      status_text: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: "",
      elapsed_ms: performance.now() - started,
      truncated: false
    };
    const publish = () =>
      on_response({ ...snapshot, elapsed_ms: performance.now() - started });
    publish();
    if (!response.body) return;
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    if (is_stream) refresh = window.setInterval(publish, STREAM_REFRESH_MS);
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      snapshot.body += decoder.decode(chunk.value, { stream: true });
      if (snapshot.body.length > RESPONSE_LIMIT) {
        snapshot.truncated = true;
        snapshot.body = is_stream
          ? snapshot.body.slice(-RESPONSE_LIMIT)
          : snapshot.body.slice(0, RESPONSE_LIMIT);
        if (!is_stream) {
          await reader.cancel();
          break;
        }
      }
    }
    snapshot.body += decoder.decode();
    if (snapshot.body.length > RESPONSE_LIMIT) {
      snapshot.truncated = true;
      snapshot.body = is_stream
        ? snapshot.body.slice(-RESPONSE_LIMIT)
        : snapshot.body.slice(0, RESPONSE_LIMIT);
    }
    if (!is_stream && !snapshot.truncated) {
      try {
        snapshot.body = JSON.stringify(JSON.parse(snapshot.body), null, 2);
      } catch {
        /* Keep non-JSON response bodies readable, including proxy errors. */
      }
    }
    if (snapshot.body.length > RESPONSE_LIMIT) {
      snapshot.truncated = true;
      snapshot.body = snapshot.body.slice(0, RESPONSE_LIMIT);
    }
    publish();
  } finally {
    window.clearTimeout(timer);
    if (refresh !== undefined) window.clearInterval(refresh);
    if (reader) {
      try {
        await reader.cancel();
      } finally {
        reader.releaseLock();
      }
    }
  }
}
