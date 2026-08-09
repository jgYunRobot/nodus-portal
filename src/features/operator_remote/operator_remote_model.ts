import type { DeviceDirectoryEntry } from "../device_directory/device_directory";

export type OperatorRemoteAvailability =
  | "no_operator"
  | "selection_required"
  | "lifecycle_unavailable"
  | "activation_contract_unavailable";

export interface OperatorRemoteViewModel {
  availability: OperatorRemoteAvailability;
  candidates: DeviceDirectoryEntry[];
  selected_operator: DeviceDirectoryEntry | null;
}

export function getOperatorCandidates(
  entries: DeviceDirectoryEntry[]
): DeviceDirectoryEntry[] {
  return entries.filter((entry) => entry.component_type === "input_source");
}

export function resolveOperatorSelection(
  candidates: DeviceDirectoryEntry[],
  selected_component_id: string | null,
  is_initial_selection: boolean
): string | null {
  if (
    selected_component_id !== null &&
    candidates.some(
      (candidate) => candidate.component_id === selected_component_id
    )
  ) {
    return selected_component_id;
  }
  if (is_initial_selection && candidates.length === 1)
    return candidates[0].component_id;
  return null;
}

export function createOperatorRemoteViewModel(
  candidates: DeviceDirectoryEntry[],
  selected_component_id: string | null
): OperatorRemoteViewModel {
  if (candidates.length === 0) {
    return {
      availability: "no_operator",
      candidates,
      selected_operator: null
    };
  }
  const selected_operator =
    candidates.find(
      (candidate) => candidate.component_id === selected_component_id
    ) ?? null;
  if (selected_operator === null) {
    return {
      availability: "selection_required",
      candidates,
      selected_operator: null
    };
  }
  return {
    availability:
      selected_operator.lifecycle_state === "ready"
        ? "activation_contract_unavailable"
        : "lifecycle_unavailable",
    candidates,
    selected_operator
  };
}

export function getOperatorLifecycleLabel(
  state: DeviceDirectoryEntry["lifecycle_state"]
): string {
  if (state === "ready") return "Ready";
  if (state === "degraded") return "Degraded";
  if (state === "faulted") return "Faulted";
  if (state === "stopping") return "Stopping";
  return "Starting";
}

export function getOperatorAvailabilityMessage(
  availability: OperatorRemoteAvailability,
  selected_operator: DeviceDirectoryEntry | null
): string {
  if (availability === "no_operator") return "No Operator connected";
  if (availability === "selection_required")
    return "Choose an Operator to inspect its factual lifecycle details.";
  if (availability === "lifecycle_unavailable") {
    const lifecycle_label =
      selected_operator === null
        ? "Unavailable"
        : getOperatorLifecycleLabel(selected_operator.lifecycle_state);
    return `Operator lifecycle is ${lifecycle_label}.`;
  }
  return "Operator activation is not integrated.";
}

export function getOperatorOptionLabel(
  candidate: DeviceDirectoryEntry,
  candidates: DeviceDirectoryEntry[]
): string {
  const has_duplicate_name = candidates.some(
    (other_candidate) =>
      other_candidate.component_id !== candidate.component_id &&
      other_candidate.display_name === candidate.display_name
  );
  const identity = has_duplicate_name
    ? `${candidate.display_name} (${getShortComponentId(candidate.component_id)})`
    : candidate.display_name;
  return identity;
}

function getShortComponentId(component_id: string): string {
  if (component_id.length <= 20) return component_id;
  return `…${component_id.slice(-16)}`;
}
