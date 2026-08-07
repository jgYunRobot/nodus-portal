import { describe, expect, it } from "vitest";
import { OperationScheduler } from "./operation_scheduler";

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

const accepted = {
  state: "accepted",
  message: "forwarded",
  terminal: false
} as const;

describe("OperationScheduler", () => {
  it("keeps one in-flight operation and only the newest pending target", async () => {
    const first = deferred<typeof accepted>();
    const second = deferred<typeof accepted>();
    const submitted: number[] = [];
    const scheduler = new OperationScheduler<number>((target) => {
      submitted.push(target);
      return submitted.length === 1 ? first.promise : second.promise;
    });

    scheduler.schedule(1);
    scheduler.schedule(2);
    scheduler.schedule(3);
    expect(submitted).toEqual([1]);
    expect(scheduler.getSnapshot()).toMatchObject({
      in_flight: true,
      has_pending: true
    });
    first.resolve(accepted);
    await Promise.resolve();
    expect(submitted).toEqual([1, 3]);
    second.resolve(accepted);
    await Promise.resolve();
    expect(scheduler.getSnapshot()).toMatchObject({
      in_flight: false,
      has_pending: false
    });
  });

  it("does not emit after cancellation while an acknowledgement is slow", async () => {
    const response = deferred<typeof accepted>();
    const submitted: number[] = [];
    const scheduler = new OperationScheduler<number>((target) => {
      submitted.push(target);
      return response.promise;
    });
    scheduler.schedule(1);
    scheduler.schedule(2);
    scheduler.cancel();
    response.resolve(accepted);
    await Promise.resolve();
    expect(submitted).toEqual([1]);
    expect(scheduler.getSnapshot().has_pending).toBe(false);
  });
});
