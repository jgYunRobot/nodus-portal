import { describe, expect, it } from "vitest";
import { createRobotDirectory } from "./robot_directory";

function descriptor(
  control_id: string,
  stream_id: string,
  stream_kind = "robot_status"
) {
  return {
    stream_id,
    owner: "pilot" as const,
    control_id,
    stream_kind: stream_kind as "robot_status" | "control_operation",
    schema_id: "nodus.robot_status.v1",
    schema_version: 1 as const,
    source_clock_domains: ["monotonic_same_host"],
    configured_production_hz: 60,
    retention_capacity: 64,
    recording_grade: true as const
  };
}

describe("createRobotDirectory", () => {
  it("keeps one stable RobotStatus stream entry per Control", () => {
    const directory = createRobotDirectory({
      server_instance_id: "pilot-a",
      streams: [
        descriptor("control-bravo", "z"),
        descriptor("control-alpha", "b"),
        descriptor("control-alpha", "a"),
        descriptor("control-operation", "operation", "control_operation")
      ]
    });

    expect(directory).toEqual({
      entries: [
        {
          control_id: "control-alpha",
          stream_id: "a",
          schema_id: "nodus.robot_status.v1",
          server_instance_id: "pilot-a"
        },
        {
          control_id: "control-bravo",
          stream_id: "z",
          schema_id: "nodus.robot_status.v1",
          server_instance_id: "pilot-a"
        }
      ],
      omitted_count: 0
    });
  });
});
