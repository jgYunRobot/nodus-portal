import { describe, expect, it } from "vitest";
import {
  OperatorActivationClient,
  OperatorActivationHttpError
} from "./operator_activation_client";
import type { OperatorActivationSnapshot } from "./operator_activation_contract";

function snapshot(
  overrides: Partial<OperatorActivationSnapshot> = {}
): OperatorActivationSnapshot {
  return {
    schema_version: 1,
    component_id: "operator.leader",
    instance_id: "operator-instance-a",
    target_control_id: "control-a",
    source_id: "leader-arm",
    terminal_mode: "latched",
    run_state: "paused",
    activation_kind: "none",
    generation: 1,
    revision: 1,
    ready: true,
    hold_lease: null,
    fault: null,
    ...overrides
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

describe("OperatorActivationClient", () => {
  it("calls only the discovered endpoint with bounded direct request settings", async () => {
    const requests: [RequestInfo | URL, RequestInit | undefined][] = [];
    const fetch_operator = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      requests.push([input, init]);
      return jsonResponse(snapshot());
    };
    const client = new OperatorActivationClient(fetch_operator);

    await expect(
      client.getActivation("http://192.168.219.106:8770/api/v1/activation")
    ).resolves.toMatchObject({ run_state: "paused" });

    expect(requests).toHaveLength(1);
    expect(requests[0][0]).toBe(
      "http://192.168.219.106:8770/api/v1/activation"
    );
    const init = requests[0][1];
    if (init === undefined)
      throw new Error("Operator request init is missing.");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("accept")).toBe("application/json");
    expect(init.credentials).toBe("omit");
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("error");
  });

  it("does not retry an uncertain mutation", async () => {
    let request_count = 0;
    const fetch_operator = async () => {
      request_count += 1;
      throw new TypeError("network down");
    };
    const client = new OperatorActivationClient(fetch_operator);

    await expect(
      client.setLatchedActivation(
        "http://192.168.219.106:8770/api/v1/activation/latched",
        { desired_state: "running", observed_generation: 1 }
      )
    ).rejects.toMatchObject({
      uncertain_mutation: true,
      retryable_read: false
    });
    expect(request_count).toBe(1);
  });

  it("preserves a validated 409 conflict snapshot without treating it as success", async () => {
    const conflict_snapshot = snapshot({ revision: 2, generation: 2 });
    const client = new OperatorActivationClient(async () =>
      jsonResponse(
        {
          error: { code: "stale_generation", message: "Generation changed." },
          snapshot: conflict_snapshot
        },
        409
      )
    );

    await expect(
      client.setLatchedActivation("http://operator.test/latched", {
        desired_state: "running",
        observed_generation: 1
      })
    ).rejects.toMatchObject({
      status: 409,
      uncertain_mutation: false,
      response: { snapshot: conflict_snapshot }
    });
  });

  it("classifies malformed read payloads and provider failures without accepting them", async () => {
    const client = new OperatorActivationClient(
      async () => new Response("not json", { status: 503 })
    );

    await expect(
      client.getActivation("http://operator.test/read")
    ).rejects.toBeInstanceOf(OperatorActivationHttpError);
    await expect(
      client.getActivation("http://operator.test/read")
    ).rejects.toMatchObject({
      retryable_read: true,
      uncertain_mutation: false,
      status: 503
    });
  });
});
