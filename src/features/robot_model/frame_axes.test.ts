import { describe, expect, it } from "vitest";
import { createRobotFrameAxes } from "./frame_axes";

describe("createRobotFrameAxes", () => {
  it("preserves the public frame position and Euler rotation", () => {
    const [frame] = createRobotFrameAxes([
      {
        id: 7,
        name: "tool",
        x: 0.1,
        y: 0.2,
        z: 0.3,
        r1: 0,
        r2: 0,
        r3: Math.PI / 2,
        euler_type: "XYZ"
      }
    ]);

    expect(frame?.id).toBe(7);
    expect(frame?.name).toBe("tool");
    expect(frame?.position).toEqual([0.1, 0.2, 0.3]);
    expect(frame?.rotation[0][0]).toBeCloseTo(0, 12);
    expect(frame?.rotation[0][1]).toBeCloseTo(-1, 12);
    expect(frame?.rotation[1][0]).toBeCloseTo(1, 12);
    expect(frame?.rotation[1][1]).toBeCloseTo(0, 12);
  });

  it("omits frames with unsupported Euler axis sequences", () => {
    expect(
      createRobotFrameAxes([
        {
          id: 1,
          name: "invalid",
          x: 0,
          y: 0,
          z: 0,
          r1: 0,
          r2: 0,
          r3: 0,
          euler_type: "invalid"
        }
      ])
    ).toEqual([]);
  });

  it("omits frames with non-finite pose values", () => {
    expect(
      createRobotFrameAxes([
        {
          id: 2,
          name: "invalid",
          x: 0,
          y: 0,
          z: 0,
          r1: Number.NaN,
          r2: 0,
          r3: 0,
          euler_type: "XYZ"
        }
      ])
    ).toEqual([]);
  });
});
