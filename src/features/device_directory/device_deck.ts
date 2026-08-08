import type { DeviceDeckSlot } from "./device_directory";

export interface DeviceDeckSelection {
  active_index: number;
  removed_component_id: string | null;
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
    if (active_index !== -1)
      return { active_index, removed_component_id: null };
    const first_empty_index = slots.findIndex((slot) => slot.kind === "empty");
    return {
      active_index: clampDeckIndex(
        first_empty_index === -1 ? 0 : first_empty_index,
        slots.length
      ),
      removed_component_id: requested_component_id
    };
  }
  return {
    active_index: clampDeckIndex(selected_empty_index ?? 0, slots.length),
    removed_component_id: null
  };
}

export function clampDeckIndex(index: number, slot_count: number): number {
  if (slot_count === 0) return 0;
  return Math.max(0, Math.min(index, slot_count - 1));
}
