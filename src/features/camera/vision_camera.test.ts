import { describe, expect, it } from "vitest";
import { selectVisionCameraEndpoints } from "./vision_camera";
import type {
  DeviceDirectoryEntry,
  DeviceEndpoint
} from "../device_directory/device_directory";

function endpoint(
  capability: string,
  schema_id: string,
  kind: DeviceEndpoint["kind"] = "stream"
): DeviceEndpoint {
  const descriptor_ids: Record<string, string> = {
    "camera.health.get": "health",
    "camera.metadata.get": "metadata",
    "camera.stream.color.preview": "color-preview",
    "camera.stream.depth.preview": "depth-preview"
  };
  return {
    descriptor_id: descriptor_ids[capability] ?? capability,
    kind,
    capability,
    contract_version: 1,
    protocol: "http",
    endpoint: `http://vision.test/${capability}`,
    media_type:
      kind === "stream" ? "multipart/x-mixed-replace" : "application/json",
    schema_id,
    service_method: kind === "service" ? "GET" : null
  };
}

function camera(endpoints: DeviceEndpoint[]): DeviceDirectoryEntry {
  return {
    component_id: "camera.top",
    display_name: "Top camera",
    component_type: "camera",
    card_kind: "camera",
    lifecycle_state: "ready",
    lifecycle_reason: null,
    instance_id: "camera.top.instance",
    session_generation: 1,
    catalog_generation: 1,
    capabilities: [],
    endpoints,
    endpoint_count: endpoints.length,
    malformed_endpoint_count: 0,
    runtime_key: "camera.top"
  };
}

describe("selectVisionCameraEndpoints", () => {
  it("accepts exact pinned Color and optional Depth descriptors", () => {
    const result = selectVisionCameraEndpoints(
      camera([
        endpoint(
          "camera.health.get",
          "nodus.vision.health.response.v1",
          "service"
        ),
        endpoint(
          "camera.metadata.get",
          "nodus.vision.metadata.response.v1",
          "service"
        ),
        endpoint(
          "camera.stream.color.preview",
          "nodus.vision.mjpeg.color_part.v1"
        ),
        endpoint(
          "camera.stream.depth.preview",
          "nodus.vision.mjpeg.depth_part.v1"
        )
      ])
    );

    expect(result?.color.capability).toBe("camera.stream.color.preview");
    expect(result?.depth?.capability).toBe("camera.stream.depth.preview");
  });

  it("rejects a Color descriptor with a mismatched schema", () => {
    expect(
      selectVisionCameraEndpoints(
        camera([
          endpoint(
            "camera.health.get",
            "nodus.vision.health.response.v1",
            "service"
          ),
          endpoint(
            "camera.metadata.get",
            "nodus.vision.metadata.response.v1",
            "service"
          ),
          endpoint("camera.stream.color.preview", "not-vision")
        ])
      )
    ).toBeNull();
  });

  it("rejects duplicate or protocol-mismatched pinned descriptors", () => {
    const health = endpoint(
      "camera.health.get",
      "nodus.vision.health.response.v1",
      "service"
    );
    const metadata = endpoint(
      "camera.metadata.get",
      "nodus.vision.metadata.response.v1",
      "service"
    );
    const color = endpoint(
      "camera.stream.color.preview",
      "nodus.vision.mjpeg.color_part.v1"
    );
    expect(
      selectVisionCameraEndpoints(
        camera([health, metadata, color, { ...color }])
      )
    ).toBeNull();
    expect(
      selectVisionCameraEndpoints(
        camera([
          health,
          metadata,
          { ...color, protocol: "https", endpoint: "http://vision.test/color" }
        ])
      )
    ).toBeNull();
  });
});
