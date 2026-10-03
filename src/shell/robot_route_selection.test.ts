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
    expect(getRobotPageKind("/robots/control-a/device")).toBeNull();
    expect(
      getRoutePreservingRobotPath("/robots/control-a/operation", "control b")
    ).toBe("/robots/control%20b/operation");
    expect(getRobotPageKind("/robots/control-a/jogging")).toBeNull();
    expect(getRobotPageKind("/robots/control-a/operating")).toBeNull();
  });

  it("does not turn global or unsupported paths into robot-scoped routes", () => {
    expect(getRobotPageKind("/home")).toBeNull();
    expect(getRoutePreservingRobotPath("/home", "control-b")).toBeNull();
    expect(
      getRoutePreservingRobotPath("/robots/control-a/cameras", "control-b")
    ).toBeNull();
  });
});
