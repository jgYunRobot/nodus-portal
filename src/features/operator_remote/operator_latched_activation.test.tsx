import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { DeviceDirectoryEntry } from "../device_directory/device_directory";
import { OperatorActivationClient } from "./operator_activation_client";
import type {
  OperatorActivationEndpoints,
  OperatorActivationSnapshot
} from "./operator_activation_contract";
import { getOperatorActivationQueryKey } from "./operator_activation_query";
import {
  getLatchedDesiredState,
  useOperatorLatchedActivation
} from "./operator_latched_activation";

const selected_entry: DeviceDirectoryEntry = {
  component_id: "operator.leader",
  display_name: "Leader Operator",
  component_type: "input_source",
  card_kind: "operator",
  lifecycle_state: "ready",
  lifecycle_reason: null,
  instance_id: "operator-instance-a",
  session_generation: 1,
  catalog_generation: 1,
  capabilities: [],
  endpoints: [],
  endpoint_count: 0,
  malformed_endpoint_count: 0,
  runtime_key: "pilot-a:operator.leader:operator-instance-a:1:1"
};

const endpoints: OperatorActivationEndpoints = {
  read: "http://operator.test/read",
  latched: "http://operator.test/latched",
  hold_start: "http://operator.test/hold/start",
  hold_heartbeat: "http://operator.test/hold/heartbeat",
  hold_stop: "http://operator.test/hold/stop"
};

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

function wrapper(query_client: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={query_client}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe("Operator latched activation", () => {
  it("maps only authoritative paused and latched-running snapshots to desired states", () => {
    expect(getLatchedDesiredState(snapshot())).toBe("running");
    expect(
      getLatchedDesiredState(
        snapshot({ run_state: "running", activation_kind: "latched" })
      )
    ).toBe("paused");
    expect(
      getLatchedDesiredState(
        snapshot({ run_state: "running", activation_kind: "remote_hold" })
      )
    ).toBeNull();
    expect(getLatchedDesiredState(snapshot({ ready: false }))).toBeNull();
  });

  it("submits a desired-state request once and reconciles the returned snapshot", async () => {
    const requests: [RequestInfo | URL, RequestInit | undefined][] = [];
    const fetch_operator = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      requests.push([input, init]);
      return new Response(
        JSON.stringify(
          snapshot({
            run_state: "running",
            activation_kind: "latched",
            generation: 2,
            revision: 2
          })
        ),
        { headers: { "content-type": "application/json" } }
      );
    };
    const query_client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const result = renderHook(
      () =>
        useOperatorLatchedActivation({
          control_id: "control-a",
          selected_entry,
          endpoints,
          snapshot: snapshot(),
          data_updated_at: Date.now(),
          query_state: "ready",
          client: new OperatorActivationClient(fetch_operator)
        }),
      { wrapper: wrapper(query_client) }
    );

    expect(result.result.current.label).toBe("Run");
    act(() => expect(result.result.current.request_latched()).toBe(true));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0][0]).toBe(endpoints.latched);
    expect(requests[0][1]?.body).toBe(
      JSON.stringify({ desired_state: "running", observed_generation: 1 })
    );
    await waitFor(() =>
      expect(
        query_client.getQueryData<OperatorActivationSnapshot>(
          getOperatorActivationQueryKey(selected_entry.runtime_key)
        )?.revision
      ).toBe(2)
    );
  });
});
