import { describe, expect, it } from "vitest";
import { clampDeckIndex, resolveDeviceDeckSelection } from "./device_deck";
import type { DeviceDeckSlot } from "./device_directory";

const slots: DeviceDeckSlot[] = [
  {
    kind: "connected",
    entry: {
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
      endpoint_count: 1,
      malformed_endpoint_count: 0,
      runtime_key: "camera.top"
    }
  },
  { kind: "empty", slot_number: 1 },
  { kind: "empty", slot_number: 2 }
];

describe("device deck selection", () => {
  it("uses an exact requested component without relying on slot order", () => {
    expect(resolveDeviceDeckSelection(slots, "camera.top", 2)).toEqual({
      active_index: 0,
      unavailable_component_id: null
    });
  });

  it("preserves an unknown URL component as unavailable", () => {
    expect(resolveDeviceDeckSelection(slots, "camera.removed", 0)).toEqual({
      active_index: null,
      unavailable_component_id: "camera.removed"
    });
  });

  it("keeps empty selection local and clamps it after directory removal", () => {
    expect(resolveDeviceDeckSelection(slots, null, 2)).toEqual({
      active_index: 2,
      unavailable_component_id: null
    });
    expect(clampDeckIndex(4, 2)).toBe(1);
  });
});
