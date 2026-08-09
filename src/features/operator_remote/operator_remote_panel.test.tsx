import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeviceDirectoryEntry } from "../device_directory/device_directory";
import { OperatorRemotePanel } from "./operator_remote_panel";

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

describe("OperatorRemotePanel", () => {
  afterEach(cleanup);

  function renderPanel(
    props: Omit<
      Parameters<typeof OperatorRemotePanel>[0],
      "control_id" | "directory_event" | "refresh_directory"
    >
  ) {
    const query_client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    return render(
      <QueryClientProvider client={query_client}>
        <OperatorRemotePanel
          control_id="control-a"
          directory_event={null}
          refresh_directory={async () => undefined}
          {...props}
        />
      </QueryClientProvider>
    );
  }

  it("explains when no Operator is connected and disables all controls", () => {
    renderPanel({
      candidates: [],
      directory_state: "ready",
      on_select_operator: vi.fn(),
      selected_component_id: null
    });

    expect(screen.getAllByText("No Operator connected")).toHaveLength(2);
    expect(screen.getByLabelText("Operator").hasAttribute("disabled")).toBe(
      true
    );
    expect(
      screen
        .getByRole("button", { name: "Run / Pause" })
        .hasAttribute("disabled")
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Hold to Run" })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  it("shows selected factual identity while activation remains unavailable", () => {
    const operator = createOperator();
    renderPanel({
      candidates: [operator],
      directory_state: "ready",
      on_select_operator: vi.fn(),
      selected_component_id: operator.component_id
    });

    expect(
      screen.getByText("Operator activation contract is unavailable.")
    ).not.toBeNull();
    expect(screen.getByText("operator-instance-a")).not.toBeNull();
    expect(screen.getByText("control.operation.v1")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Run / Pause" })).toHaveProperty(
      "disabled",
      true
    );
    expect(
      screen.queryByText("Select an Operator for this Operation workspace")
    ).toBeNull();
    const panel = screen.getByRole("region", { name: "Device Remote" });
    expect(panel.innerHTML.indexOf("Run / Pause")).toBeLessThan(
      panel.innerHTML.indexOf('aria-label="Operator"')
    );
  });

  it("requires an explicit selection for multiple Operators", () => {
    const select_operator = vi.fn();
    const leader = createOperator();
    const policy = createOperator({
      component_id: "operator.policy",
      display_name: "Policy Operator"
    });
    renderPanel({
      candidates: [leader, policy],
      directory_state: "ready",
      on_select_operator: select_operator,
      selected_component_id: null
    });

    expect(
      screen.getByText(
        "Choose an Operator to inspect its factual lifecycle details."
      )
    ).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Operator"), {
      target: { value: "operator.policy" }
    });
    expect(select_operator).toHaveBeenCalledWith("operator.policy");
  });

  it("keeps degraded lifecycle wording distinct from activation state", () => {
    const operator = createOperator({ lifecycle_state: "degraded" });
    renderPanel({
      candidates: [operator],
      directory_state: "ready",
      on_select_operator: vi.fn(),
      selected_component_id: operator.component_id
    });

    expect(screen.getByText("Operator lifecycle is Degraded.")).not.toBeNull();
    expect(screen.queryByText(/paused|running|holding/i)).toBeNull();
  });
});
