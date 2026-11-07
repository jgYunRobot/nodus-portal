import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortalOperationRuntime } from "./portal_operation_runtime";
import type {
  OperationPresentation,
  OperationTarget
} from "./pilot_operation_client";
import * as robot_status_adapter from "./robot_status_adapter";

const mocks = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("./pilot_operation_client", () => ({
  PilotOperationClient: class {
    submit = mocks.submit;
  }
}));

beforeEach(() => {
  mocks.submit.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("jog dispatch guard", () => {
  it.each<OperationTarget>([
    {
      operation: "control.move_joint_online",
      control_id: "control-a",
      target_position: [0, 0, 0, 0, 0, 0]
    },
    {
      operation: "control.move_task_online",
      control_id: "control-a",
      target_position: [0, 0, 0, 1, 0, 0, 0],
      target_id: 1,
      reference_id: 0
    }
  ])(
    "rechecks Servo status before dispatching pending $operation",
    async (target) => {
      const read_motion_status = vi.spyOn(
        robot_status_adapter,
        "adaptMotionRobotStatus"
      );
      read_motion_status.mockReturnValue({
        joint_positions: [0, 0, 0, 0, 0, 0],
        frames: new Map(),
        connection_generation: 1
      });
      let complete!: (result: OperationPresentation) => void;
      mocks.submit.mockReturnValue(
        new Promise<OperationPresentation>((resolve) => {
          complete = resolve;
        })
      );
      const runtime = new PortalOperationRuntime();
      const scheduler = runtime.getScheduler("control-a");
      scheduler.schedule(target);
      scheduler.schedule(target);
      expect(scheduler.getSnapshot().has_pending).toBe(true);

      // Servo OFF can arrive before the hold tick or React cancellation runs.
      read_motion_status.mockReturnValue(null);
      complete({ state: "accepted", message: "ok", terminal: false });
      await Promise.resolve();
      await Promise.resolve();
      expect(mocks.submit).toHaveBeenCalledTimes(1);
      expect(scheduler.getSnapshot().has_pending).toBe(false);
      expect(scheduler.getSnapshot().in_flight).toBe(false);

      // The shared scheduler must still permit a new Servo ON request.
      mocks.submit.mockResolvedValue({
        state: "accepted",
        message: "ok",
        terminal: false
      });
      scheduler.resume();
      scheduler.schedule({
        operation: "control.set_servo_state",
        control_id: "control-a",
        enabled: true
      });
      await Promise.resolve();
      expect(mocks.submit).toHaveBeenCalledTimes(2);
      expect(mocks.submit).toHaveBeenLastCalledWith(
        expect.objectContaining({
          operation: "control.set_servo_state"
        })
      );
    }
  );
});

describe("robot selection handoff", () => {
  it("locks across Controls while a request is in flight and cancels unsent targets without replay", async () => {
    let complete!: (result: OperationPresentation) => void;
    mocks.submit.mockReturnValue(
      new Promise<OperationPresentation>((resolve) => {
        complete = resolve;
      })
    );
    const runtime = new PortalOperationRuntime();
    const listener = vi.fn();
    const unsubscribe = runtime.subscribeSelection(listener);
    const scheduler = runtime.getScheduler("control.same");
    expect(runtime.isSelectionLocked()).toBe(false);
    scheduler.schedule({
      operation: "control.reset_fault",
      control_id: "control.same"
    });
    scheduler.schedule({
      operation: "control.set_servo_state",
      control_id: "control.same",
      enabled: true
    });
    expect(runtime.isSelectionLocked()).toBe(true);
    runtime.cancelAll();
    expect(scheduler.getSnapshot().has_pending).toBe(false);
    expect(runtime.isSelectionLocked()).toBe(true);
    complete({ state: "accepted", message: "mock result", terminal: false });
    await Promise.resolve();
    expect(runtime.isSelectionLocked()).toBe(false);
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});

describe("API request ownership", () => {
  it("excludes concurrent mutations and releases idempotently without releasing a later request", () => {
    const runtime = new PortalOperationRuntime();
    const cancel = vi.fn();
    const release = runtime.beginApiRequest(cancel)!;
    expect(runtime.isSelectionLocked()).toBe(true);
    expect(runtime.beginApiRequest(vi.fn())).toBeNull();
    runtime.cancelAll();
    expect(cancel).toHaveBeenCalledTimes(1);
    release();
    expect(runtime.isSelectionLocked()).toBe(false);
    const release_next = runtime.beginApiRequest(vi.fn())!;
    release();
    expect(runtime.isSelectionLocked()).toBe(true);
    release_next();
    expect(runtime.isSelectionLocked()).toBe(false);
  });
  it("does not allow API ownership while a Dock operation remains in flight", () => {
    mocks.submit.mockReturnValue(new Promise(() => undefined));
    const runtime = new PortalOperationRuntime();
    runtime
      .getScheduler("control-b")
      .schedule({ operation: "control.reset_fault", control_id: "control-b" });
    expect(runtime.beginApiRequest(vi.fn())).toBeNull();
  });
});
