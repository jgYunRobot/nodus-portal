import { describe, expect, it } from "vitest";
import type {
  DeviceDirectoryEntry,
  DeviceEndpoint
} from "../device_directory/device_directory";
import { resolveOperatorActivationEndpoints } from "./operator_activation_contract";

function endpoint(
  descriptor_id: string,
  capability: string,
  service_method: DeviceEndpoint["service_method"],
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
    service_method,
    request_schema_id,
    response_schema_id
  };
}

function operator(endpoints: DeviceEndpoint[]): DeviceDirectoryEntry {
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
    endpoints,
    endpoint_count: endpoints.length,
    malformed_endpoint_count: 0,
    runtime_key: "pilot-a:operator.leader:operator-instance-a:1:1"
  };
}

function activationEndpoints(): DeviceEndpoint[] {
  return [
    endpoint(
      "operator.activation.read",
      "operator.activation.read.v1",
      "GET",
      null,
      "operator.activation.v1.ActivationSnapshot"
    ),
    endpoint(
      "operator.activation.latched",
      "operator.activation.latched.v1",
      "PUT",
      "operator.activation.v1.LatchedActivationRequest",
      "operator.activation.v1.ActivationSnapshot"
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
      "operator.activation.v1.ActivationSnapshot"
    ),
    endpoint(
      "operator.activation.hold-stop",
      "operator.activation.hold.stop.v1",
      "POST",
      "operator.activation.v1.HoldLeaseRequest",
      "operator.activation.v1.ActivationSnapshot"
    )
  ];
}

describe("Operator activation descriptor selection", () => {
  it("accepts only the complete exact Operator descriptor set", () => {
    expect(
      resolveOperatorActivationEndpoints(operator(activationEndpoints()))
    ).toEqual({
      read: "http://192.168.219.106:8770/operator.activation.read",
      latched: "http://192.168.219.106:8770/operator.activation.latched",
      hold_start: "http://192.168.219.106:8770/operator.activation.hold-start",
      hold_heartbeat:
        "http://192.168.219.106:8770/operator.activation.hold-heartbeat",
      hold_stop: "http://192.168.219.106:8770/operator.activation.hold-stop"
    });
  });

  it("rejects a missing, duplicate, or schema-mismatched descriptor", () => {
    const endpoints = activationEndpoints();
    expect(
      resolveOperatorActivationEndpoints(operator(endpoints.slice(1)))
    ).toBeNull();
    expect(
      resolveOperatorActivationEndpoints(operator([...endpoints, endpoints[0]]))
    ).toBeNull();
    expect(
      resolveOperatorActivationEndpoints(
        operator([
          ...endpoints.slice(0, 1),
          { ...endpoints[1], request_schema_id: "not-operator" },
          ...endpoints.slice(2)
        ])
      )
    ).toBeNull();
  });
});
