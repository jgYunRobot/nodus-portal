import { describe, expect, it } from "vitest";
import {
  getEffectiveControlId,
  getRobotPageKind,
  getRoutePreservingRobotPath
} from "./robot_route_selection";

describe("robot route selection", () => {
  it("keeps a direct route authoritative over the presentation preference", () => {
    expect(getEffectiveControlId("control-route", "control-preferred")).toBe(
      "control-route"
    );
    expect(getEffectiveControlId(undefined, "control-preferred")).toBe(
      "control-preferred"
    );
    expect(getEffectiveControlId(undefined, null)).toBeNull();
  });

  it("preserves supported robot page kinds while replacing only the Control ID", () => {
    expect(getRobotPageKind("/robots/control-a/device")).toBe("device");
    expect(
      getRoutePreservingRobotPath("/robots/control-a/jogging", "control b")
    ).toBe("/robots/control%20b/jogging");
    expect(
      getRoutePreservingRobotPath("/robots/control-a/operating", "control-b")
    ).toBe("/robots/control-b/operating");
  });

  it("does not turn global or unsupported paths into robot-scoped routes", () => {
    expect(getRobotPageKind("/home")).toBeNull();
    expect(getRoutePreservingRobotPath("/home", "control-b")).toBeNull();
    expect(
      getRoutePreservingRobotPath("/robots/control-a/cameras", "control-b")
    ).toBeNull();
  });
});
