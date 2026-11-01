import { describe, expect, it } from "vitest";
import {
  createCommandExample,
  fieldsToPose,
  poseToFields,
  frameToPose
} from "./command_values";

describe("command value entry", () => {
  it("creates directly runnable motion requests with visible positive limits and valid poses", () => {
    const joint = JSON.parse(
      createCommandExample("control.move_joint_request", "control-test")
    );
    expect(joint.schema_version).toBe(2);
    expect(joint.payload.dest).toHaveLength(6);
    expect(joint.payload.velocity_limit[0]).toBeCloseTo((5 * Math.PI) / 180);
    expect(joint.payload.auto_play).toBe(true);
    const linear = JSON.parse(
      createCommandExample("control.move_linear_request", "control-test")
    );
    expect(linear.payload.dest).toEqual([0, 0, 0, 0, 0, 0, 1]);
    expect(linear.payload.auto_play).toBe(true);
  });
  it("converts displayed Z-Y-X degrees to native xyzw quaternion without changing translation", () => {
    const pose = fieldsToPose([0.1, 0.2, 0.3, 90, 20, -15]);
    const display = poseToFields(pose);
    [0.1, 0.2, 0.3, 90, 20, -15].forEach((value, index) =>
      expect(display[index]).toBeCloseTo(value, 8)
    );
    expect(
      pose.slice(3).reduce((sum, value) => sum + value * value, 0)
    ).toBeCloseTo(1, 12);
  });
  it("copies observed Euler frames with the published xyz+xyzw layout, including half turns", () => {
    const pose = frameToPose({
      id: 1,
      name: "Tool",
      x: 0.1,
      y: 0.2,
      z: 0.3,
      r1: Math.PI,
      r2: 0,
      r3: 0,
      euler_type: "XYZ"
    })!;
    expect(pose.slice(0, 3)).toEqual([0.1, 0.2, 0.3]);
    expect(Math.abs(pose[3])).toBeCloseTo(1);
    expect(Math.abs(pose[6])).toBeCloseTo(0);
  });
});
