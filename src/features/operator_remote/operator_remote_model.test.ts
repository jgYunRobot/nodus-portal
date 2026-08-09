import { describe, expect, it } from "vitest";
import type { DeviceDirectoryEntry } from "../device_directory/device_directory";
import {
  createOperatorRemoteViewModel,
  getOperatorAvailabilityMessage,
  getOperatorCandidates,
  resolveOperatorSelection
} from "./operator_remote_model";

function createOperator(
  overrides: Partial<DeviceDirectoryEntry> = {}
): DeviceDirectoryEntry {
  return {
    component_id: "operator.leader",
    display_name: "Leader Operator",
    component_type: "input_source",
    card_kind: "operator",
    lifecycle_state: "ready",
    lifecycle_reason: null,
    instance_id: "operator-instance-a",
    session_generation: 1,
    catalog_generation: null,
    capabilities: ["control.operation.v1"],
    endpoints: [],
    endpoint_count: 0,
    malformed_endpoint_count: 0,
    runtime_key: "pilot-a:operator.leader:operator-instance-a:1:no-catalog",
    ...overrides
  };
}

describe("Operator Remote model", () => {
  it("filters only input-source candidates", () => {
    const operator = createOperator();
    const camera = createOperator({
      component_id: "camera.top",
      component_type: "camera",
      card_kind: "camera"
    });

    expect(getOperatorCandidates([camera, operator])).toEqual([operator]);
  });

  it("selects the sole initial candidate but requires a choice for multiple candidates", () => {
    const first_operator = createOperator();
    const second_operator = createOperator({
      component_id: "operator.policy",
      display_name: "Policy Operator"
    });

    expect(resolveOperatorSelection([first_operator], null, true)).toBe(
      "operator.leader"
    );
    expect(
      resolveOperatorSelection([first_operator, second_operator], null, true)
    ).toBeNull();
  });

  it("retains a same-component replacement and clears a removed selection", () => {
    const replacement = createOperator({
      instance_id: "operator-instance-b",
      runtime_key: "pilot-a:operator.leader:operator-instance-b:2:no-catalog",
      session_generation: 2
    });
    const other_operator = createOperator({
      component_id: "operator.policy",
      display_name: "Policy Operator"
    });

    expect(
      resolveOperatorSelection(
        [replacement, other_operator],
        "operator.leader",
        false
      )
    ).toBe("operator.leader");
    expect(
      resolveOperatorSelection([other_operator], "operator.leader", false)
    ).toBeNull();
  });

  it("reports only factual lifecycle and activation-contract availability", () => {
    const ready_operator = createOperator();
    const degraded_operator = createOperator({ lifecycle_state: "degraded" });

    const ready_view = createOperatorRemoteViewModel(
      [ready_operator],
      ready_operator.component_id
    );
    expect(ready_view.availability).toBe("activation_contract_unavailable");
    expect(
      getOperatorAvailabilityMessage(
        ready_view.availability,
        ready_view.selected_operator
      )
    ).toBe("Operator activation is not integrated.");

    const degraded_view = createOperatorRemoteViewModel(
      [degraded_operator],
      degraded_operator.component_id
    );
    expect(degraded_view.availability).toBe("lifecycle_unavailable");
    expect(
      getOperatorAvailabilityMessage(
        degraded_view.availability,
        degraded_view.selected_operator
      )
    ).toBe("Operator lifecycle is Degraded.");
  });
});
