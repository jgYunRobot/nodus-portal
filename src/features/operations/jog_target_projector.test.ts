import { describe, expect, it } from "vitest";
import {
  projectDirectionalTarget,
  projectGoalTarget
} from "./jog_target_projector";

describe("JogTargetProjector", () => {
  it("continues advancing against delayed authoritative status", () => {
    const first = projectDirectionalTarget(1, 0, 1, 100, 50, 1);
    const delayed = projectDirectionalTarget(first, 0, 1, 100, 50, 1);
    expect(first).toBe(1.05);
    expect(delayed).toBe(1.1);
  });

  it("clamps Home and Ready projection at the fixed goal", () => {
    expect(projectGoalTarget([0.9], [0.5], [1], 100, 1_000)).toEqual([1]);
  });

  it("advances every Home and Ready axis by the same path progress", () => {
    const target = projectGoalTarget([0, 0], [0, 0], [1, 2], 100, 50);

    expect(target[0]).toBeGreaterThan(0);
    expect(target[1]).toBeGreaterThan(0);
    expect(target[0]! / 1).toBeCloseTo(target[1]! / 2);
  });
});
