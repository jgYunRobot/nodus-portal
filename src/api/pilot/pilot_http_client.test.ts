import { describe, expect, it } from "vitest";
import { PilotHttpClient } from "./pilot_http_client";

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
});
