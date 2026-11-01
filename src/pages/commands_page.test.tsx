import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandsPage } from "./commands_page";
vi.mock("../api/pilot/pilot_queries", () => ({
  useRobotStatusStreams: () => ({
    data: {
      streams: [{ stream_kind: "robot_status", control_id: "control-test" }]
    }
  })
}));
vi.mock("../api/pilot/use_control_status", () => ({
  useControlStatus: () => ({
    state: "live",
    status: {
      fresh: true,
      stale: false,
      sample: {
        robot_state: {
          real: { pos: [0, 0, 0, 0, 0, 0] },
          frames: [
            {
              id: 7,
              name: "Tool",
              parent_link_id: 6,
              x: 0.1,
              y: 0.2,
              z: 0.3,
              r1: 0,
              r2: 0,
              r3: 0,
              euler_type: "XYZ"
            }
          ]
        }
      }
    }
  })
}));

const mocks = vi.hoisted(() => ({
  snapshot: {
    phase: "ready",
    server_instance_id: "pilot-test",
    last_error: null
  },
  reserve: vi.fn(),
  release: vi.fn(),
  begin: vi.fn()
}));
vi.mock("../features/operations/portal_operation_context", () => ({
  useRobotSelectionLocked: () => false,
  usePortalOperationRuntime: () => ({
    beginApiRequest: mocks.begin,
    session: {
      subscribe: () => () => undefined,
      getSnapshot: () => mocks.snapshot,
      reserveOperation: mocks.reserve
    }
  })
}));
vi.mock("../shell/robot_dock_state", () => ({
  useRobotDockState: () => ({ preferred_control_id: "control-test" })
}));
describe("Commands workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.begin.mockReturnValue(mocks.release);
    mocks.reserve.mockReturnValue({
      session_id: "current-session",
      generation: 2,
      sequence: 7,
      request_id: "current-request",
      source_timestamp_ns: 123
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"status":"ok"}', {
          headers: { "content-type": "application/json" }
        })
      )
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it("sends nothing on load, then renders a read-only response", async () => {
    render(<CommandsPage />);
    fireEvent.click(screen.getByRole("button", { name: "HTTP APIs" }));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await screen.findByLabelText("Response body");
    await waitFor(() =>
      expect(screen.getByLabelText("Response body").textContent).toContain(
        '"status": "ok"'
      )
    );
    expect(mocks.begin).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("uses the edited IK value and allocates shared session context only at Send", async () => {
    render(<CommandsPage />);
    fireEvent.click(screen.getByRole("button", { name: "HTTP APIs" }));
    fireEvent.click(
      screen.getByRole("button", { name: /POST \/api\/v1\/operations/ })
    );
    fireEvent.change(screen.getByLabelText("Control operation"), {
      target: { value: "control.set_ik_mode" }
    });
    fireEvent.change(screen.getByLabelText("payload.mode"), {
      target: { value: "pseudo" }
    });
    expect(mocks.reserve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(mocks.release).toHaveBeenCalledTimes(1));
    const init = vi.mocked(fetch).mock.calls[0][1]!;
    expect(JSON.parse(String(init.body))).toMatchObject({
      operation: "control.set_ik_mode",
      control_id: "control-test",
      session_id: "current-session",
      sequence: 7,
      payload: { mode: "pseudo" }
    });
    expect(mocks.reserve).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid JSON locally without sending or taking command ownership", async () => {
    render(<CommandsPage />);
    fireEvent.click(screen.getByRole("button", { name: "HTTP APIs" }));
    fireEvent.change(screen.getByLabelText(/Query parameters/), {
      target: { value: "[]" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Query must be a JSON object"
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.begin).not.toHaveBeenCalled();
  });
});

describe("direct command entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.begin.mockReturnValue(mocks.release);
    mocks.reserve.mockReturnValue({
      session_id: "current-session",
      generation: 2,
      sequence: 8,
      request_id: "current-request",
      source_timestamp_ns: 456
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response('{"simulated":true}'))
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it("runs moveJ from degree inputs and preserves the draft across command selection", async () => {
    render(<CommandsPage />);
    expect(screen.getByRole("button", { name: "Run moveJ" })).toBeTruthy();
    fireEvent.change(screen.getAllByLabelText("J1 (deg)")[1], {
      target: { value: "90" }
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "moveL — control.move_linear_request"
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "moveJ — control.move_joint_request"
      })
    );
    expect(
      (screen.getAllByLabelText("J1 (deg)")[1] as HTMLInputElement).value
    ).toBe("90");
    fireEvent.click(screen.getByRole("button", { name: "Run moveJ" }));
    await waitFor(() => expect(mocks.release).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body));
    expect(body.payload.dest[0]).toBeCloseTo(Math.PI / 2);
    expect(body.payload.auto_play).toBe(true);
    expect(body.control_id).toBe("control-test");
  });
  it("runs setForce using named wrench axes without JSON editing", async () => {
    render(<CommandsPage />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "setForce — control.set_force"
      })
    );
    fireEvent.change(screen.getByLabelText("Target frame"), {
      target: { value: "7" }
    });
    fireEvent.change(screen.getByLabelText("Fx (N)"), {
      target: { value: "12" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run setForce" }));
    await waitFor(() => expect(mocks.release).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body));
    expect(body.payload.force).toEqual([12, 0, 0, 0, 0, 0]);
    expect(body.payload.frame_id).toBe(7);
    expect(body.session_id).toBe("current-session");
  });
});
