import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseRobotDockState,
  readRobotDockState,
  setPreferredControlId,
  useRobotDockState
} from "./robot_dock_state";

describe("robot dock presentation state", () => {
  afterEach(() => vi.restoreAllMocks());

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

  it("falls back to empty state when browser storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage access denied", "SecurityError");
    });

    expect(readRobotDockState()).toEqual({
      preferred_control_id: null,
      dock_mode: null
    });
  });

  it("keeps in-memory selection when browser storage cannot be written", () => {
    const state = renderHook(() => useRobotDockState());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    });

    act(() => setPreferredControlId("control-memory"));

    expect(state.result.current.preferred_control_id).toBe("control-memory");
    act(() => setPreferredControlId(null));
    state.unmount();
  });
});
