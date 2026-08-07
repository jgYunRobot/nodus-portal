import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HoldIntent } from "./hold_session";

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  reconnect: vi.fn(),
  resume: vi.fn(),
  schedule: vi.fn(),
  start: vi.fn(),
  current_intent: null as Readonly<HoldIntent> | null,
  operation_snapshot: {
    in_flight: false,
    has_pending: false,
    presentation: null as {
      state: string;
      message: string;
      terminal: boolean;
    } | null
  },
  session_snapshot: {
    phase: "ready" as "ready" | "recovering",
    server_instance_id: "pilot-a",
    last_error: null as string | null
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
      active: mocks.current_intent !== null,
      current_intent: mocks.current_intent,
      start: mocks.start
    }),
    getScheduler: () => ({
      subscribe: () => () => undefined,
      getSnapshot: () => mocks.operation_snapshot,
      resume: mocks.resume,
      schedule: mocks.schedule
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
    mocks.resume.mockReset();
    mocks.schedule.mockReset();
    mocks.start.mockReset();
    mocks.current_intent = null;
    mocks.operation_snapshot.presentation = null;
    mocks.session_snapshot.phase = "ready";
    mocks.session_snapshot.last_error = null;
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

  it("submits robot commands through the selected Control scheduler", () => {
    render(<HoldControls control_id="control-a" />);

    fireEvent.click(screen.getByRole("button", { name: "Servo Off" }));
    expect(mocks.schedule).toHaveBeenLastCalledWith({
      operation: "control.set_servo_state",
      control_id: "control-a",
      enabled: false
    });

    fireEvent.click(screen.getByRole("button", { name: "Fault Reset" }));
    expect(mocks.schedule).toHaveBeenLastCalledWith({
      operation: "control.reset_fault",
      control_id: "control-a"
    });

    fireEvent.click(screen.getByRole("button", { name: "Engage Brake" }));
    expect(mocks.schedule).toHaveBeenLastCalledWith({
      operation: "control.set_brake_state",
      control_id: "control-a",
      released: false
    });
    expect(mocks.cancel).toHaveBeenCalledTimes(3);
    expect(mocks.resume).toHaveBeenCalledTimes(3);
  });

  it("locks conflicting controls for the complete hold lifetime", () => {
    mocks.current_intent = {
      kind: "joint",
      joint_index: 0,
      direction: 1,
      speed_percent: 25
    };

    const view = render(<HoldControls control_id="control-a" />);

    expect(screen.getByRole("button", { name: "Joint 1 +" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Joint 1 −" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Joint 2 +" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Home" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ready" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Servo Off" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Task" })).toBeDisabled();
    expect(screen.getByLabelText("Jog speed")).toBeDisabled();

    mocks.current_intent = null;
    view.rerender(<HoldControls control_id="control-a" />);

    expect(screen.getByRole("button", { name: "Joint 1 −" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Home" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Servo Off" })).toBeEnabled();
    expect(screen.getByRole("tab", { name: "Task" })).toBeEnabled();
    expect(screen.getByLabelText("Jog speed")).toBeEnabled();
  });

  it("shows operation and recovery information in one stable status panel", () => {
    mocks.operation_snapshot.presentation = {
      state: "written_unconfirmed",
      message: "Control frame was written without execution acknowledgement.",
      terminal: false
    };
    mocks.session_snapshot.phase = "recovering";
    mocks.session_snapshot.last_error =
      "Pilot session recovery is in progress.";

    render(<HoldControls control_id="control-a" />);

    const status_panel = screen.getByRole("status");
    expect(status_panel.textContent).toContain("written_unconfirmed");
    expect(status_panel.textContent).toContain("recovery:");
    expect(status_panel.textContent).toContain(
      "Pilot session recovery is in progress."
    );
    expect(
      screen.getByRole("button", { name: "Retry session" })
    ).not.toBeNull();
  });
});
