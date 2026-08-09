import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type {
  DeviceDirectoryEntry,
  DeviceEndpoint
} from "../device_directory/device_directory";
import type { DeviceDirectoryEvent } from "../device_directory/device_directory_events";
import {
  OperatorActivationClient,
  OperatorActivationHttpError
} from "./operator_activation_client";
import {
  resolveOperatorActivationEndpoints,
  type OperatorActivationSnapshot
} from "./operator_activation_contract";
import {
  getOperatorActivationQueryState,
  getOperatorActivationQueryKey,
  matchesActivationInvalidation,
  selectNewestActivationSnapshot,
  useOperatorActivationQuery
} from "./operator_activation_query";

function endpoint(
  descriptor_id: string,
  capability: string,
  method: DeviceEndpoint["service_method"],
  request_schema_id: string | null,
  response_schema_id: string
): DeviceEndpoint {
  return {
    descriptor_id,
    kind: "service",
    capability,
    contract_version: 1,
    protocol: "http",
    endpoint: `http://192.168.219.106:8770/${descriptor_id}`,
    media_type: "application/json",
    schema_id: response_schema_id,
    service_method: method,
    request_schema_id,
    response_schema_id
  };
}

function entry(): DeviceDirectoryEntry {
  const snapshot_schema = "operator.activation.v1.ActivationSnapshot";
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
    endpoints: [
      endpoint(
        "operator.activation.read",
        "operator.activation.read.v1",
        "GET",
        null,
        snapshot_schema
      ),
      endpoint(
        "operator.activation.latched",
        "operator.activation.latched.v1",
        "PUT",
        "operator.activation.v1.LatchedActivationRequest",
        snapshot_schema
      ),
      endpoint(
        "operator.activation.hold-start",
        "operator.activation.hold.start.v1",
        "POST",
        "operator.activation.v1.HoldStartRequest",
        "operator.activation.v1.HoldStartResponse"
      ),
      endpoint(
        "operator.activation.hold-heartbeat",
        "operator.activation.hold.heartbeat.v1",
        "POST",
        "operator.activation.v1.HoldLeaseRequest",
        snapshot_schema
      ),
      endpoint(
        "operator.activation.hold-stop",
        "operator.activation.hold.stop.v1",
        "POST",
        "operator.activation.v1.HoldLeaseRequest",
        snapshot_schema
      )
    ],
    endpoint_count: 5,
    malformed_endpoint_count: 0,
    runtime_key: "pilot-a:operator.leader:operator-instance-a:1:1"
  };
}

function snapshot(revision = 1): OperatorActivationSnapshot {
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
    revision,
    ready: true,
    hold_lease: null,
    fault: null
  };
}

function createWrapper(query_client: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={query_client}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe("Operator activation query", () => {
  it("uses one selected-runtime query and invalidates only on matching directory evidence", async () => {
    const fetch_operator = vi.fn(
      async () =>
        new Response(JSON.stringify(snapshot()), {
          headers: { "content-type": "application/json" }
        })
    );
    const refresh_directory = vi.fn(async () => undefined);
    const query_client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const selected_entry = entry();
    const result = renderHook(
      ({ directory_event }) =>
        useOperatorActivationQuery({
          control_id: "control-a",
          selected_entry,
          directory_event,
          refresh_directory,
          client: new OperatorActivationClient(fetch_operator)
        }),
      {
        initialProps: { directory_event: null as DeviceDirectoryEvent | null },
        wrapper: createWrapper(query_client)
      }
    );

    await waitFor(() =>
      expect(result.result.current.query_state).toBe("ready")
    );
    expect(result.result.current.query_key).toEqual(
      getOperatorActivationQueryKey(selected_entry.runtime_key)
    );
    expect(fetch_operator).toHaveBeenCalledTimes(1);

    result.rerender({
      directory_event: {
        event_type: "component_state_updated",
        component_id: "operator.leader",
        instance_id: "operator-instance-a",
        session_generation: 1
      }
    });
    await waitFor(() => expect(fetch_operator).toHaveBeenCalledTimes(2));
    expect(refresh_directory).not.toHaveBeenCalled();
  });

  it("keeps lower revisions from replacing the current runtime snapshot", () => {
    expect(
      selectNewestActivationSnapshot(snapshot(4), snapshot(3))
    ).toMatchObject({
      revision: 4
    });
    expect(
      selectNewestActivationSnapshot(snapshot(3), snapshot(4))
    ).toMatchObject({
      revision: 4
    });
    expect(
      matchesActivationInvalidation(
        {
          event_type: "component_state_updated",
          component_id: "operator.leader",
          instance_id: "operator-instance-a",
          session_generation: 1
        },
        entry()
      )
    ).toBe(true);
    expect(
      matchesActivationInvalidation(
        {
          event_type: "component_state_updated",
          component_id: "operator.leader",
          instance_id: "operator-instance-b",
          session_generation: 1
        },
        entry()
      )
    ).toBe(false);
  });

  it("distinguishes transport recovery from an authoritative Operator fault", () => {
    const selected_entry = entry();
    const endpoints = resolveOperatorActivationEndpoints(selected_entry);
    expect(endpoints).not.toBeNull();
    expect(
      getOperatorActivationQueryState(
        selected_entry,
        endpoints,
        undefined,
        false,
        false,
        new OperatorActivationHttpError("temporary failure", {
          retryable_read: true
        })
      )
    ).toBe("recovering");
    expect(
      getOperatorActivationQueryState(
        selected_entry,
        endpoints,
        undefined,
        false,
        false,
        new Error("incompatible response")
      )
    ).toBe("offline");
  });
});
