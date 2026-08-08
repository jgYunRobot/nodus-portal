import { describe, expect, it } from "vitest";
import {
  createDeviceDeckSlots,
  createDeviceDirectory
} from "./device_directory";

function component(
  component_id: string,
  component_type: "camera" | "input_source" | "policy" | "ui",
  display_name = component_id
) {
  return {
    component_id,
    instance_id: `${component_id}.instance`,
    component_type,
    session_generation: 1,
    capabilities:
      component_type === "input_source" ? ["control.operation.v1"] : [],
    service_endpoints: {},
    state: { health: "ready" as const, reason: null, details: {} },
    metadata: { display_name },
    registered_at_ns: 1,
    last_heartbeat_ns: 1,
    expires_at_ns: 2,
    last_sequence: 1,
    clock_domain: "monotonic_same_host" as const,
    available: true as const
  };
}

function endpoint(component_id: string) {
  return {
    component_id,
    instance_id: `${component_id}.instance`,
    component_type: "camera",
    session_generation: 1,
    catalog_generation: 2,
    descriptor: {
      descriptor_id: `${component_id}.color`,
      kind: "stream",
      capability: "camera.stream.color.preview",
      contract_version: 1,
      protocol: "http",
      endpoint: "http://vision.test/stream/color.mjpg",
      media_type: "multipart/x-mixed-replace",
      schema_id: null,
      metadata: {},
      service: null,
      stream: { clock_domain: "provider_defined", stream_group_id: null }
    }
  };
}

describe("createDeviceDirectory", () => {
  it("creates stable Camera, Operator, and generic cards with five slots", () => {
    const directory = createDeviceDirectory(
      {
        snapshot_revision: 4,
        components: [
          component("portal-ui", "ui", "Portal"),
          component("operator.leader", "input_source", "Operator"),
          component("camera.top", "camera", "Camera"),
          component("policy.demo", "policy", "Policy")
        ]
      },
      {
        server_instance_id: "pilot-a",
        catalog_revision: 7,
        endpoints: [endpoint("camera.top")]
      }
    );

    expect(directory.entries.map((entry) => entry.component_id)).toEqual([
      "camera.top",
      "operator.leader",
      "policy.demo"
    ]);
    expect(directory.entries.map((entry) => entry.card_kind)).toEqual([
      "camera",
      "operator",
      "generic"
    ]);
    expect(directory.entries[0]).toMatchObject({
      endpoint_count: 1,
      malformed_endpoint_count: 0,
      runtime_key: "pilot-a:camera.top:camera.top.instance:1:2"
    });
    expect(directory.slots).toHaveLength(5);
    expect(directory.slots.slice(3)).toEqual([
      { kind: "empty", slot_number: 1 },
      { kind: "empty", slot_number: 2 }
    ]);
  });

  it("isolates malformed endpoint records to their known device", () => {
    const directory = createDeviceDirectory(
      {
        snapshot_revision: 1,
        components: [component("camera.bad", "camera")]
      },
      {
        server_instance_id: "pilot-a",
        catalog_revision: 1,
        endpoints: [
          {
            component_id: "camera.bad",
            instance_id: "camera.bad.instance",
            session_generation: 1,
            catalog_generation: 1,
            descriptor: { endpoint: "not a URL" }
          }
        ]
      }
    );

    expect(directory.entries[0]).toMatchObject({
      component_id: "camera.bad",
      endpoint_count: 0,
      malformed_endpoint_count: 1
    });
  });

  it("rejects an endpoint whose declared protocol differs from its URL", () => {
    const mismatched_endpoint = endpoint("camera.bad");
    mismatched_endpoint.descriptor.protocol = "https";
    const directory = createDeviceDirectory(
      {
        snapshot_revision: 1,
        components: [component("camera.bad", "camera")]
      },
      {
        server_instance_id: "pilot-a",
        catalog_revision: 1,
        endpoints: [mismatched_endpoint]
      }
    );

    expect(directory.entries[0]).toMatchObject({
      endpoint_count: 0,
      malformed_endpoint_count: 1
    });
  });

  it("appends every connected device and returns to five slots after removal", () => {
    const entries = Array.from({ length: 6 }, (_, index) => ({
      component_id: `camera.${index}`,
      display_name: `Camera ${index}`,
      component_type: "camera" as const,
      card_kind: "camera" as const,
      lifecycle_state: "ready" as const,
      lifecycle_reason: null,
      instance_id: `camera.${index}.instance`,
      session_generation: 1,
      catalog_generation: null,
      capabilities: [],
      endpoints: [],
      endpoint_count: 0,
      malformed_endpoint_count: 0,
      runtime_key: `camera.${index}`
    }));

    expect(createDeviceDeckSlots(entries)).toHaveLength(6);
    expect(createDeviceDeckSlots(entries.slice(0, 2))).toEqual([
      { kind: "connected", entry: entries[0] },
      { kind: "connected", entry: entries[1] },
      { kind: "empty", slot_number: 1 },
      { kind: "empty", slot_number: 2 },
      { kind: "empty", slot_number: 3 }
    ]);
  });
});
