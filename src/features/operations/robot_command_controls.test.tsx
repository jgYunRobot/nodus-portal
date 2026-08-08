import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  resume: vi.fn(),
  schedule: vi.fn(),
  operation_snapshot: {
    in_flight: false,
    has_pending: false,
    presentation: null as {
      state: string;
      message: string;
      terminal: boolean;
    } | null
  },
  session_snapshot: { phase: "ready" }
}));

vi.mock("../../api/pilot/use_control_status", () => ({
  useControlStatus: () => ({
    state: "live",
    status: {
      available: true,
      fresh: true,
      stale: false,
      sample: {
        robot_state: {
          interface: { servo_activated: true, brake_released: true }
        }
      }
    }
  })
}));

vi.mock("./portal_operation_context", () => ({
  usePortalOperationRuntime: () => ({
    cancel: mocks.cancel,
    getHold: () => ({ active: false }),
    getScheduler: () => ({
      subscribe: () => () => undefined,
      getSnapshot: () => mocks.operation_snapshot,
      resume: mocks.resume,
      schedule: mocks.schedule
    }),
    session: {
      subscribe: () => () => undefined,
      getSnapshot: () => mocks.session_snapshot
    }
  })
}));

import { RobotCommandControls } from "./robot_command_controls";

describe("RobotCommandControls", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.cancel.mockReset();
    mocks.resume.mockReset();
    mocks.schedule.mockReset();
    mocks.operation_snapshot.presentation = null;
  });

  it("submits each shared command through the selected Control scheduler", () => {
    render(<RobotCommandControls control_id="control-b" />);

    fireEvent.click(screen.getByRole("button", { name: "Servo Off" }));
    expect(mocks.schedule).toHaveBeenLastCalledWith({
      operation: "control.set_servo_state",
      control_id: "control-b",
      enabled: false
    });

    fireEvent.click(screen.getByRole("button", { name: "Fault Reset" }));
    expect(mocks.schedule).toHaveBeenLastCalledWith({
      operation: "control.reset_fault",
      control_id: "control-b"
    });

    fireEvent.click(screen.getByRole("button", { name: "Engage Brake" }));
    expect(mocks.schedule).toHaveBeenLastCalledWith({
      operation: "control.set_brake_state",
      control_id: "control-b",
      released: false
    });
    expect(mocks.cancel).toHaveBeenCalledTimes(3);
    expect(mocks.resume).toHaveBeenCalledTimes(3);
  });

  it("keeps operation feedback out of the shared command controls", () => {
    mocks.operation_snapshot.presentation = {
      state: "written_unconfirmed",
      message: "Control frame was written without execution acknowledgement.",
      terminal: false
    };

    render(<RobotCommandControls control_id="control-b" />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Servo Off" })).not.toBeNull();
  });
});
