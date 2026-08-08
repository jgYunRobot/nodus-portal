import { describe, expect, it } from "vitest";
import type { ControlStatusSnapshot } from "../../api/pilot/pilot_stream_hub";
import { HoldSession } from "./hold_session";
import { OperationScheduler } from "./operation_scheduler";
import type { OperationTarget } from "./pilot_operation_client";

function getMotionTarget(
  target: OperationTarget | undefined
): readonly number[] | undefined {
  if (
    target?.operation !== "control.move_joint_online" &&
    target?.operation !== "control.move_task_online"
  )
    return undefined;
  return target.target_position;
}

function status(generation = 1, fresh = true): ControlStatusSnapshot {
  return {
    control_id: "control-a",
    state: "live",
    last_error: null,
    status: {
      control_id: "control-a",
      available: true,
      fresh,
      stale: !fresh,
      age_ms: 1,
      request_pending: false,
      connection_generation: generation,
      last_success_monotonic_ns: 1,
      last_failure_monotonic_ns: null,
      configured_polling_hz: 100,
      measured_polling_hz: 100,
      missed_poll_count: 0,
      timeout_count: 0,
      gateway_queue_high_watermark: 0,
      sample: {
        sample_sequence: 1,
        connection_generation: generation,
        source_timestamp_ns: 1,
        pilot_receive_monotonic_ns: 1,
        robot_state: {
          timestamp_ns: 1,
          real: { pos: [0, 0, 0, 0, 0, 0], vel: [], acc: [], torque: [] },
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
              parent_link_id: 6,
              name: "Base",
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
  };
}

describe("HoldSession", () => {
  it("continues joint and task projection from the direct latest status read", async () => {
    let now = 0;
    let tick: (() => void) | undefined;
    const sent: OperationTarget[] = [];
    const scheduler = new OperationScheduler<OperationTarget>(
      async (target) => {
        sent.push(target);
        return { state: "accepted", message: "ok", terminal: false };
      }
    );
    const hold = new HoldSession({
      control_id: "control-a",
      read_snapshot: () => status(),
      scheduler,
      now: () => now,
      set_interval: ((callback: () => void) => {
        tick = callback;
        return 1;
      }) as typeof window.setInterval,
      clear_interval: (() => undefined) as typeof window.clearInterval
    });
    hold.start({
      kind: "joint",
      joint_index: 0,
      direction: 1,
      speed_percent: 100
    });
    await Promise.resolve();
    now = 50;
    tick?.();
    await Promise.resolve();
    expect(getMotionTarget(sent.at(-1))?.[0]).toBeGreaterThan(0);

    hold.start({
      kind: "task",
      frame_name: "Base",
      axis_index: 0,
      direction: 1,
      speed_percent: 100
    });
    await Promise.resolve();
    now = 100;
    tick?.();
    await Promise.resolve();
    expect(sent.at(-1)).toMatchObject({
      operation: "control.move_task_online"
    });
    expect(getMotionTarget(sent.at(-1))?.[0]).toBeGreaterThan(0);
    expect(getMotionTarget(sent.at(-1))).toHaveLength(7);

    hold.start({
      kind: "task",
      frame_name: "Base",
      axis_index: 3,
      direction: 1,
      speed_percent: 100
    });
    await Promise.resolve();
    now = 150;
    tick?.();
    await Promise.resolve();
    expect(getMotionTarget(sent.at(-1))).toHaveLength(7);
    expect(getMotionTarget(sent.at(-1))?.slice(3, 6)).toEqual([1, 0, 0]);
    expect(getMotionTarget(sent.at(-1))?.[6]).toBeGreaterThan(0);
  });

  it("keeps Home and Ready as progressive holds and stops on generation change", async () => {
    let now = 0;
    let generation = 1;
    let tick: (() => void) | undefined;
    const sent: OperationTarget[] = [];
    const scheduler = new OperationScheduler<OperationTarget>(
      async (target) => {
        sent.push(target);
        return { state: "accepted", message: "ok", terminal: false };
      }
    );
    const hold = new HoldSession({
      control_id: "control-a",
      read_snapshot: () => status(generation),
      scheduler,
      now: () => now,
      set_interval: ((callback: () => void) => {
        tick = callback;
        return 1;
      }) as typeof window.setInterval,
      clear_interval: (() => undefined) as typeof window.clearInterval
    });
    hold.start({ kind: "ready", speed_percent: 100 });
    await Promise.resolve();
    now = 50;
    tick?.();
    await Promise.resolve();
    const first_ready = getMotionTarget(sent.at(-1))?.[2] ?? 0;
    now = 100;
    tick?.();
    await Promise.resolve();
    expect(getMotionTarget(sent.at(-1))?.[2]).toBeGreaterThan(first_ready);

    hold.start({ kind: "home", speed_percent: 100 });
    await Promise.resolve();
    generation = 2;
    now = 150;
    tick?.();
    await Promise.resolve();
    expect(hold.active).toBe(false);
  });

  it("stops local emission after release or malformed/stale status", async () => {
    let now = 0;
    let fresh = true;
    let tick: (() => void) | undefined;
    const sent: OperationTarget[] = [];
    const scheduler = new OperationScheduler<OperationTarget>(
      async (target) => {
        sent.push(target);
        return { state: "accepted", message: "ok", terminal: false };
      }
    );
    const hold = new HoldSession({
      control_id: "control-a",
      read_snapshot: () => status(1, fresh),
      scheduler,
      now: () => now,
      set_interval: ((callback: () => void) => {
        tick = callback;
        return 1;
      }) as typeof window.setInterval,
      clear_interval: (() => undefined) as typeof window.clearInterval
    });
    hold.start({
      kind: "joint",
      joint_index: 0,
      direction: 1,
      speed_percent: 100
    });
    await Promise.resolve();
    hold.stop();
    now = 50;
    tick?.();
    await Promise.resolve();
    expect(sent).toHaveLength(1);

    hold.start({
      kind: "joint",
      joint_index: 0,
      direction: 1,
      speed_percent: 100
    });
    await Promise.resolve();
    fresh = false;
    now = 100;
    tick?.();
    expect(hold.active).toBe(false);
  });

  it("ends an active hold after a terminal operation result", async () => {
    let resolve:
      | ((value: { state: "failed"; message: string; terminal: true }) => void)
      | undefined;
    const scheduler = new OperationScheduler<OperationTarget>(
      () =>
        new Promise((next) => {
          resolve = next;
        })
    );
    const hold = new HoldSession({
      control_id: "control-a",
      read_snapshot: () => status(),
      scheduler,
      set_interval: (() => 1) as unknown as typeof window.setInterval,
      clear_interval: (() => undefined) as typeof window.clearInterval
    });
    hold.start({
      kind: "joint",
      joint_index: 0,
      direction: 1,
      speed_percent: 100
    });
    resolve?.({ state: "failed", message: "terminal", terminal: true });
    await Promise.resolve();
    expect(hold.active).toBe(false);
  });
});
