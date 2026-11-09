import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startReactPerformanceTrackCleanup } from "./react_performance_tracks";

const observers: Array<{
  callback: PerformanceObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  takeRecords: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}> = [];
const clear_measures = vi.fn();

beforeEach(() => {
  observers.length = 0;
  clear_measures.mockClear();
  vi.stubGlobal("performance", { clearMeasures: clear_measures });
  vi.stubGlobal(
    "PerformanceObserver",
    vi.fn(function (callback: PerformanceObserverCallback) {
      const observer = {
        callback,
        observe: vi.fn(),
        takeRecords: vi.fn(() => [] as PerformanceEntry[]),
        disconnect: vi.fn()
      };
      observers.push(observer);
      return observer;
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

function deliverMeasures(entries: Array<{ name: string; detail?: unknown }>) {
  const observer = observers[0];
  observer.callback(
    { getEntries: () => entries } as PerformanceObserverEntryList,
    observer as unknown as PerformanceObserver
  );
}

describe("React development performance track cleanup", () => {
  it("observes existing and future measures without clearing unrelated records", () => {
    startReactPerformanceTrackCleanup();
    expect(observers[0].observe).toHaveBeenCalledWith({
      type: "measure",
      buffered: true
    });
    deliverMeasures([
      { name: "portal.request" },
      { name: "portal.render", detail: null },
      { name: "portal.scalar", detail: 42 },
      { name: "portal.custom", detail: { devtools: { track: "Portal" } } }
    ]);
    expect(clear_measures).not.toHaveBeenCalled();
  });

  it("clears React component and scheduler names once per delivered batch", () => {
    startReactPerformanceTrackCleanup();
    deliverMeasures([
      {
        name: "\u200bRobotScene",
        detail: { devtools: { track: "Components ⚛" } }
      },
      {
        name: "\u200bRobotScene",
        detail: { devtools: { track: "Components ⚛" } }
      },
      { name: "Commit", detail: { devtools: { trackGroup: "Scheduler ⚛" } } },
      { name: "portal.request", detail: { request_id: 1 } }
    ]);
    expect(clear_measures.mock.calls).toEqual([
      ["\u200bRobotScene"],
      ["Commit"]
    ]);
  });

  it("drains queued React records and disconnects before a replacement starts", () => {
    const stop = startReactPerformanceTrackCleanup();
    const previous = observers[0];
    previous.takeRecords.mockReturnValue([
      { name: "\u200bButton", detail: { devtools: { track: "Components ⚛" } } },
      { name: "portal.keep" }
    ]);
    stop();
    expect(clear_measures.mock.calls).toEqual([["\u200bButton"]]);
    expect(previous.disconnect).toHaveBeenCalledOnce();

    const stop_replacement = startReactPerformanceTrackCleanup();
    expect(observers).toHaveLength(2);
    expect(observers[1].observe).toHaveBeenCalledOnce();
    stop_replacement();
    expect(observers[1].disconnect).toHaveBeenCalledOnce();
  });
});
