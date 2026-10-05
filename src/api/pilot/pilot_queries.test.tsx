import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRobotStatusStreams } from "./pilot_queries";

const mocks = vi.hoisted(() => ({ get_streams: vi.fn() }));
vi.mock("./pilot_http_client", () => ({
  PilotHttpClient: class {
    getRobotStatusStreams = mocks.get_streams;
  }
}));

describe("RobotStatus directory recovery", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("replaces a cached empty directory without reload or a browser focus event", async () => {
    vi.useFakeTimers();
    const replacement = {
      server_instance_id: "pilot-b",
      streams: [
        {
          stream_id: "robot-status-a",
          owner: "pilot",
          control_id: "control-a",
          stream_kind: "robot_status",
          schema_id: "nodus.robot_status.v1",
          schema_version: 1,
          source_clock_domains: ["monotonic_same_host"],
          configured_production_hz: 60,
          retention_capacity: 64,
          recording_grade: true
        }
      ]
    };
    mocks.get_streams
      .mockResolvedValueOnce({ server_instance_id: "pilot-a", streams: [] })
      .mockResolvedValue(replacement);
    const query_client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={query_client}>
        {children}
      </QueryClientProvider>
    );
    const query = renderHook(useRobotStatusStreams, { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(query.result.current.data?.server_instance_id).toBe("pilot-a");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5001);
    });
    expect(query.result.current.data).toEqual(replacement);
    query.unmount();
    query_client.clear();
  });
});
