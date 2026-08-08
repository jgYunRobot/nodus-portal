import { describe, expect, it } from "vitest";
import { parseRobotDockState } from "./robot_dock_state";

describe("robot dock presentation state", () => {
  it("accepts only versioned presentation fields", () => {
    expect(
      parseRobotDockState(
        JSON.stringify({
          preferred_control_id: "control-a",
          dock_mode: "collapsed"
        })
      )
    ).toEqual({ preferred_control_id: "control-a", dock_mode: "collapsed" });
  });

  it("drops malformed state and never creates a selection", () => {
    expect(parseRobotDockState("not-json")).toEqual({
      preferred_control_id: null,
      dock_mode: null
    });
    expect(
      parseRobotDockState(JSON.stringify({ preferred_control_id: 1 }))
    ).toEqual({
      preferred_control_id: null,
      dock_mode: null
    });
  });
});
