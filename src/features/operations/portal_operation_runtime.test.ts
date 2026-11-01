import { describe, expect, it, vi } from "vitest";
import { PortalOperationRuntime } from "./portal_operation_runtime";
import type { OperationPresentation } from "./pilot_operation_client";

const mocks = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("./pilot_operation_client", () => ({
  PilotOperationClient: class {
    submit = mocks.submit;
  }
}));

describe("robot selection handoff", () => {
  it("locks across Controls while a request is in flight and cancels unsent targets without replay", async () => {
    let complete!: (result: OperationPresentation) => void;
    mocks.submit.mockReturnValue(
      new Promise<OperationPresentation>((resolve) => {
        complete = resolve;
      })
    );
    const runtime = new PortalOperationRuntime();
    const listener = vi.fn();
    const unsubscribe = runtime.subscribeSelection(listener);
    const scheduler = runtime.getScheduler("control.same");
    expect(runtime.isSelectionLocked()).toBe(false);
    scheduler.schedule({
      operation: "control.reset_fault",
      control_id: "control.same"
    });
    scheduler.schedule({
      operation: "control.set_servo_state",
      control_id: "control.same",
      enabled: true
    });
    expect(runtime.isSelectionLocked()).toBe(true);
    runtime.cancelAll();
    expect(scheduler.getSnapshot().has_pending).toBe(false);
    expect(runtime.isSelectionLocked()).toBe(true);
    complete({ state: "accepted", message: "mock result", terminal: false });
    await Promise.resolve();
    expect(runtime.isSelectionLocked()).toBe(false);
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});

describe("API request ownership", () => {
  it("excludes concurrent mutations and releases idempotently without releasing a later request", () => {
    const runtime = new PortalOperationRuntime();
    const cancel = vi.fn();
    const release = runtime.beginApiRequest(cancel)!;
    expect(runtime.isSelectionLocked()).toBe(true);
    expect(runtime.beginApiRequest(vi.fn())).toBeNull();
    runtime.cancelAll();
    expect(cancel).toHaveBeenCalledTimes(1);
    release();
    expect(runtime.isSelectionLocked()).toBe(false);
    const release_next = runtime.beginApiRequest(vi.fn())!;
    release();
    expect(runtime.isSelectionLocked()).toBe(true);
    release_next();
    expect(runtime.isSelectionLocked()).toBe(false);
  });
  it("does not allow API ownership while a Dock operation remains in flight", () => {
    mocks.submit.mockReturnValue(new Promise(() => undefined));
    const runtime = new PortalOperationRuntime();
    runtime
      .getScheduler("control-b")
      .schedule({ operation: "control.reset_fault", control_id: "control-b" });
    expect(runtime.beginApiRequest(vi.fn())).toBeNull();
  });
});
