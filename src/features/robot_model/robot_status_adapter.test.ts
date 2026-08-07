import { describe, expect, it } from "vitest";
import type { ControlStatusSnapshot } from "../../api/pilot/pilot_stream_hub";
import { adaptRobotVisualizationState } from "./robot_status_adapter";

function snapshot(positions: number[], fresh = true): ControlStatusSnapshot {
  return {
    control_id: "control-alpha",
    state: "live",
    last_error: null,
    status: {
      control_id: "control-alpha",
      available: true,
      fresh,
      stale: !fresh,
      age_ms: fresh ? 2 : 2000,
      request_pending: false,
      connection_generation: 3,
      last_success_monotonic_ns: 1,
      last_failure_monotonic_ns: null,
      configured_polling_hz: 100,
      measured_polling_hz: 100,
      missed_poll_count: 0,
      timeout_count: 0,
      gateway_queue_high_watermark: 0,
      sample: {
        sample_sequence: 9,
        connection_generation: 3,
        source_timestamp_ns: 1,
        pilot_receive_monotonic_ns: 1,
        robot_state: {
          timestamp_ns: 1,
          real: { pos: positions, vel: [], acc: [], torque: [] },
          desired: { pos: positions, vel: [], acc: [], torque: [] },
          interface: {
            schema_version: 1,
            robot_type: "e_rob",
            connected: true,
            dof: 6,
            servo_activated: false,
            brake_released: false,
            brake_state_source: "unknown",
            motion_gate_state: "unknown",
            motion_gate_reason: "",
            expected_wkc: 0,
            last_wkc: 0,
            last_error: ""
          },
          frames: []
        }
      }
    }
  };
}

describe("adaptRobotVisualizationState", () => {
  it("uses only a fresh six-joint authoritative status", () => {
    expect(adaptRobotVisualizationState(snapshot([0, 1, 2, 3, 4, 5]))).toEqual({
      joint_positions: [0, 1, 2, 3, 4, 5],
      message: "Authoritative RobotStatus is visualized.",
      tone: "success"
    });
  });

  it("holds the model when status is stale or incomplete", () => {
    expect(
      adaptRobotVisualizationState(snapshot([0, 1, 2, 3, 4, 5], false))
    ).toMatchObject({
      joint_positions: null,
      tone: "warning"
    });
    expect(adaptRobotVisualizationState(snapshot([0, 1]))).toMatchObject({
      joint_positions: null,
      tone: "warning"
    });
  });
});
