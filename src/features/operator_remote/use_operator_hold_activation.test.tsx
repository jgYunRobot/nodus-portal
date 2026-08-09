import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeviceDirectoryEntry } from "../device_directory/device_directory";
import type { OperatorActivationClient } from "./operator_activation_client";
import type {
  OperatorActivationEndpoints,
  OperatorActivationSnapshot
} from "./operator_activation_contract";
import { getOperatorActivationQueryKey } from "./operator_activation_query";
import { useOperatorHoldActivation } from "./use_operator_hold_activation";

const endpoints: OperatorActivationEndpoints = {
  read: "http://operator.test/read",
  latched: "http://operator.test/latched",
  hold_start: "http://operator.test/hold/start",
  hold_heartbeat: "http://operator.test/hold/heartbeat",
  hold_stop: "http://operator.test/hold/stop"
};

function entry(): DeviceDirectoryEntry {
  return {
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
    endpoint_count: 5,
    malformed_endpoint_count: 0,
    runtime_key: "pilot-a:operator.leader:operator-instance-a:1:1"
  };
}

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

describe("Operator hold activation hook", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the owned lease when directory refresh replaces same-runtime objects", async () => {
    let heartbeat_callback: (() => void) | null = null;
    vi.spyOn(window, "setInterval").mockImplementation((callback) => {
      heartbeat_callback = callback as () => void;
      return 17;
    });
    const client = {
      startHold: vi.fn(async () => ({
        lease: { lease_id: "lease-a", generation: 2, expires_in_ms: 300 },
        snapshot: snapshot({
          activation_kind: "remote_hold",
          generation: 2,
          hold_lease: {
            lease_id: "lease-a",
            generation: 2,
            expires_in_ms: 300
          },
          ready: false,
          revision: 2,
          run_state: "running"
        })
      })),
      heartbeatHold: vi.fn(async () =>
        snapshot({
          activation_kind: "remote_hold",
          generation: 2,
          hold_lease: {
            lease_id: "lease-a",
            generation: 2,
            expires_in_ms: 300
          },
          ready: false,
          revision: 2,
          run_state: "running"
        })
      ),
      stopHold: vi.fn(async () => snapshot({ revision: 3 }))
    } as unknown as OperatorActivationClient;
    const query_client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const selected_entry = entry();
    const query_key = getOperatorActivationQueryKey(selected_entry.runtime_key);
    const result = renderHook(
      ({ selected_entry, endpoints }) =>
        useOperatorHoldActivation({
          client,
          control_id: "control-a",
          data_updated_at: 1,
          endpoints,
          query_key,
          query_state: "ready",
          selected_entry,
          snapshot: snapshot()
        }),
      {
        initialProps: { endpoints, selected_entry },
        wrapper: wrapper(query_client)
      }
    );

    act(() => expect(result.result.current.start()).toBe(true));
    await waitFor(() => expect(result.result.current.state).toBe("holding"));

    result.rerender({
      endpoints: { ...endpoints },
      selected_entry: { ...selected_entry }
    });
    expect(client.stopHold).not.toHaveBeenCalled();

    await act(async () => {
      heartbeat_callback?.();
      await Promise.resolve();
    });
    expect(client.heartbeatHold).toHaveBeenCalledTimes(1);
    expect(client.stopHold).not.toHaveBeenCalled();
  });
});
