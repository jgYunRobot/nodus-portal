import type { DeviceDeckSlot } from "./device_directory";

export interface DeviceDeckSelection {
  active_index: number | null;
  unavailable_component_id: string | null;
}

export function resolveDeviceDeckSelection(
  slots: DeviceDeckSlot[],
  requested_component_id: string | null,
  selected_empty_index: number | null
): DeviceDeckSelection {
  if (requested_component_id !== null) {
    const active_index = slots.findIndex(
      (slot) =>
        slot.kind === "connected" &&
        slot.entry.component_id === requested_component_id
    );
    return {
      active_index: active_index === -1 ? null : active_index,
      unavailable_component_id:
        active_index === -1 ? requested_component_id : null
    };
  }
  return {
    active_index: clampDeckIndex(selected_empty_index ?? 0, slots.length),
    unavailable_component_id: null
  };
}

export function clampDeckIndex(index: number, slot_count: number): number {
  if (slot_count === 0) return 0;
  return Math.max(0, Math.min(index, slot_count - 1));
}
