import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortalOperationProvider } from "./portal_operation_context";

const mocks = vi.hoisted(() => ({
  session_listener: null as (() => void) | null,
  recovery_listener: null as ((control_id: string) => void) | null,
  get_snapshot: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
  cancel_all: vi.fn(),
  unsubscribe_session: vi.fn(),
  unsubscribe_recovery: vi.fn(),
  observe_server: vi.fn(),
  invalidate_queries: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate_queries })
}));
vi.mock("../../api/pilot/use_control_status", () => ({
  pilot_stream_hub: {
    observeServerInstance: mocks.observe_server,
    subscribeRecovery: (listener: (control_id: string) => void) => {
      mocks.recovery_listener = listener;
      return mocks.unsubscribe_recovery;
    }
  }
}));
vi.mock("./portal_operation_runtime", () => ({
  PortalOperationRuntime: class {
    session = {
      start: mocks.start,
      stop: mocks.stop,
      getSnapshot: mocks.get_snapshot,
      subscribe: (listener: () => void) => {
        mocks.session_listener = listener;
        return mocks.unsubscribe_session;
      }
    };
    cancel = mocks.cancel;
    cancelAll = mocks.cancel_all;
  }
}));

describe("PortalOperationProvider recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session_listener = null;
    mocks.recovery_listener = null;
  });
  afterEach(cleanup);

  it("refreshes Pilot queries and server identity only after session recovery", () => {
    render(<PortalOperationProvider>Portal</PortalOperationProvider>);
    mocks.get_snapshot.mockReturnValue({
      phase: "error",
      server_instance_id: null
    });
    mocks.session_listener?.();
    expect(mocks.invalidate_queries).not.toHaveBeenCalled();
    mocks.get_snapshot.mockReturnValue({
      phase: "ready",
      server_instance_id: "pilot-b"
    });
    mocks.session_listener?.();
    expect(mocks.observe_server).toHaveBeenCalledWith("pilot-b");
    expect(mocks.invalidate_queries).toHaveBeenCalledWith({
      queryKey: ["pilot"]
    });
  });

  it("cancels the affected hold on stream recovery and releases global listeners", () => {
    const view = render(
      <PortalOperationProvider>Portal</PortalOperationProvider>
    );
    mocks.recovery_listener?.("control-a");
    expect(mocks.cancel).toHaveBeenCalledWith("control-a");
    view.unmount();
    expect(mocks.unsubscribe_session).toHaveBeenCalledTimes(1);
    expect(mocks.unsubscribe_recovery).toHaveBeenCalledTimes(1);
    expect(mocks.stop).toHaveBeenCalledTimes(1);
    expect(mocks.cancel_all).toHaveBeenCalledTimes(1);
  });
});
