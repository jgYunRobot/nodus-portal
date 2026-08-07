import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HoldIntent } from "./hold_session";

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  reconnect: vi.fn(),
  start: vi.fn(),
  current_intent: null as Readonly<HoldIntent> | null,
  operation_snapshot: {
    in_flight: false,
    has_pending: false,
    presentation: null
  },
  session_snapshot: {
    phase: "ready" as const,
    server_instance_id: "pilot-a",
    last_error: null
  }
}));

vi.mock("../../api/pilot/use_control_status", () => ({
  useControlStatus: () => ({
    control_id: "control-a",
    state: "live",
    last_error: null,
    status: {
      control_id: "control-a",
      available: true,
      fresh: true,
      stale: false,
      age_ms: 1,
      request_pending: false,
      connection_generation: 1,
      last_success_monotonic_ns: 1,
      last_failure_monotonic_ns: null,
      configured_polling_hz: 100,
      measured_polling_hz: 100,
      missed_poll_count: 0,
      timeout_count: 0,
      gateway_queue_high_watermark: 0,
      sample: {
        sample_sequence: 1,
        connection_generation: 1,
        source_timestamp_ns: 1,
        pilot_receive_monotonic_ns: 1,
        robot_state: {
          timestamp_ns: 1,
          real: {
            pos: [0.1, 0, 0, 0, 0, 0],
            vel: [0.2, 0, 0, 0, 0, 0],
            acc: [0.3, 0, 0, 0, 0, 0],
            torque: [0.4, 0, 0, 0, 0, 0]
          },
          desired: { pos: [0, 0, 0, 0, 0, 0], vel: [], acc: [], torque: [] },
          interface: {
            schema_version: 1,
            robot_type: "test",
            connected: true,
            dof: 6,
            servo_activated: true,
            brake_released: true,
            brake_state_source: "test",
            motion_gate_state: "test",
            motion_gate_reason: "",
            expected_wkc: 0,
            last_wkc: 0,
            last_error: ""
          },
          frames: [
            {
              id: 0,
              name: "Base",
              x: 0.11,
              y: 0,
              z: 0,
              r1: 0,
              r2: 0,
              r3: 0,
              euler_type: "XYZ"
            },
            {
              id: 1,
              name: "Tool",
              x: 0,
              y: 0,
              z: 0,
              r1: 0,
              r2: 0,
              r3: 0,
              euler_type: "XYZ"
            }
          ]
        }
      }
    }
  })
}));

vi.mock("./portal_operation_context", () => ({
  usePortalOperationRuntime: () => ({
    cancel: mocks.cancel,
    getHold: () => ({
      active: false,
      current_intent: mocks.current_intent,
      start: mocks.start
    }),
    getScheduler: () => ({
      subscribe: () => () => undefined,
      getSnapshot: () => mocks.operation_snapshot
    }),
    session: {
      subscribe: () => () => undefined,
      getSnapshot: () => mocks.session_snapshot,
      reconnect: mocks.reconnect
    }
  })
}));

import { HoldControls } from "./hold_controls";

describe("HoldControls", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.cancel.mockReset();
    mocks.reconnect.mockReset();
    mocks.start.mockReset();
    mocks.current_intent = null;
  });

  it("exposes joint, task, Home, and Ready holds", () => {
    render(<HoldControls control_id="control-a" />);

    expect(screen.getByRole("button", { name: "Joint 6 +" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Home" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Ready" })).not.toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Task" }));
    expect(screen.getByRole("button", { name: "Task Rz −" })).not.toBeNull();
    expect(
      (screen.getByLabelText("Task jog frame") as HTMLSelectElement).value
    ).toBe("Base");
  });

  it("uses the selected speed/frame and cancels on global keyboard release", () => {
    render(<HoldControls control_id="control-a" />);
    fireEvent.change(screen.getByLabelText("Jog speed"), {
      target: { value: "60" }
    });
    fireEvent.click(screen.getByRole("tab", { name: "Task" }));
    fireEvent.change(screen.getByLabelText("Task jog frame"), {
      target: { value: "Tool" }
    });
    fireEvent.keyDown(screen.getByRole("button", { name: "Task Ry +" }), {
      key: "Enter"
    });

    expect(mocks.start).toHaveBeenCalledWith({
      kind: "task",
      frame_name: "Tool",
      axis_index: 4,
      direction: 1,
      speed_percent: 60
    });
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter" }));
    expect(mocks.cancel).toHaveBeenCalledWith("control-a");
  });
});
