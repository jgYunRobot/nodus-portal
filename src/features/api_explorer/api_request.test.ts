import { describe, expect, it, vi } from "vitest";
import {
  RESPONSE_LIMIT,
  sendApiRequest,
  type ApiResponse
} from "./api_request";

describe("API request lifecycle", () => {
  it("preserves HTTP errors and custom headers without retries", async () => {
    const fetch_api = vi
      .fn()
      .mockResolvedValue(
        new Response('{"error":"invalid"}', {
          status: 400,
          headers: { "content-type": "application/json" }
        })
      );
    const updates: ApiResponse[] = [];
    await sendApiRequest(
      "/api/v1/operations",
      "POST",
      { "X-Test": "value" },
      "{}",
      false,
      new AbortController(),
      (value) => updates.push(value),
      fetch_api
    );
    expect(fetch_api).toHaveBeenCalledTimes(1);
    expect(fetch_api.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: "{}",
      headers: { "X-Test": "value" }
    });
    expect(updates.at(-1)).toMatchObject({
      status: 400,
      body: '{\n  "error": "invalid"\n}'
    });
  });
  it("bounds ordinary bodies and cancels the reader instead of retaining the full response", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode("x".repeat(RESPONSE_LIMIT + 100))
        );
      },
      cancel
    });
    const update = vi.fn();
    await sendApiRequest(
      "/api/v1/snapshot",
      "GET",
      {},
      undefined,
      false,
      new AbortController(),
      update,
      vi.fn().mockResolvedValue(new Response(stream))
    );
    expect(update.mock.calls.at(-1)![0]).toMatchObject({ truncated: true });
    expect(update.mock.calls.at(-1)![0].body).toHaveLength(RESPONSE_LIMIT);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("keeps the latest stream text, including split UTF-8 characters", async () => {
    const bytes = new TextEncoder().encode("한글");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode("x".repeat(RESPONSE_LIMIT))
        );
        controller.enqueue(bytes.slice(0, 2));
        controller.enqueue(bytes.slice(2));
        controller.close();
      }
    });
    const update = vi.fn();
    await sendApiRequest(
      "/api/v1/events/stream",
      "GET",
      {},
      undefined,
      true,
      new AbortController(),
      update,
      vi
        .fn()
        .mockResolvedValue(
          new Response(stream, {
            headers: { "content-type": "text/event-stream" }
          })
        )
    );
    const result = update.mock.calls.at(-1)![0] as ApiResponse;
    expect(result.body).toHaveLength(RESPONSE_LIMIT);
    expect(result.body.endsWith("한글")).toBe(true);
    expect(result.truncated).toBe(true);
  });
});
