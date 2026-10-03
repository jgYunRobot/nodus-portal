import { useEffect, useState } from "react";
import {
  fetchVisionCameraRuntime,
  type VisionCameraEndpoints,
  type VisionCameraRuntime
} from "./vision_camera";

const CAMERA_REQUEST_TIMEOUT_MS = 5000;
const CAMERA_REFRESH_INTERVAL_MS = 5000;
const CAMERA_RETRY_INITIAL_MS = 500;
const CAMERA_RETRY_MAX_MS = 5000;

export function useVisionCamera(
  runtime_key: string,
  endpoints: VisionCameraEndpoints | null,
  on_provider_failure: () => Promise<void>
) {
  const [runtime, setRuntime] = useState<VisionCameraRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);

  const health_endpoint = endpoints?.health.endpoint ?? null;
  const metadata_endpoint = endpoints?.metadata.endpoint ?? null;

  useEffect(() => {
    if (health_endpoint === null || metadata_endpoint === null) return;
    const selected_health_endpoint = health_endpoint;
    const selected_metadata_endpoint = metadata_endpoint;
    let is_active = true;
    let controller: AbortController | null = null;
    let request_timeout: number | null = null;
    let retry_timeout: number | null = null;
    let retry_delay_ms = CAMERA_RETRY_INITIAL_MS;
    let failure_notified = false;

    function scheduleLoad(delay_ms: number): void {
      retry_timeout = window.setTimeout(() => {
        retry_timeout = null;
        void loadRuntime();
      }, delay_ms);
    }

    async function loadRuntime(): Promise<void> {
      const next_controller = new AbortController();
      controller = next_controller;
      let request_timed_out = false;
      request_timeout = window.setTimeout(() => {
        request_timed_out = true;
        next_controller.abort();
      }, CAMERA_REQUEST_TIMEOUT_MS);
      try {
        const next_runtime = await fetchVisionCameraRuntime(
          selected_health_endpoint,
          selected_metadata_endpoint,
          next_controller.signal
        );
        if (!is_active) return;
        setRuntime(next_runtime);
        setError(null);
        retry_delay_ms = CAMERA_RETRY_INITIAL_MS;
        failure_notified = false;
        scheduleLoad(CAMERA_REFRESH_INTERVAL_MS);
      } catch (next_error: unknown) {
        if (!is_active) return;
        setRuntime(null);
        setError(
          request_timed_out
            ? "Vision provider request timed out."
            : next_error instanceof Error
              ? next_error.message
              : "Vision provider request failed."
        );
        if (!failure_notified) {
          failure_notified = true;
          void on_provider_failure();
        }
        scheduleLoad(retry_delay_ms);
        retry_delay_ms = Math.min(retry_delay_ms * 2, CAMERA_RETRY_MAX_MS);
      } finally {
        if (request_timeout !== null) window.clearTimeout(request_timeout);
        request_timeout = null;
        if (controller === next_controller) controller = null;
      }
    }

    void loadRuntime();
    return () => {
      is_active = false;
      controller?.abort();
      if (request_timeout !== null) window.clearTimeout(request_timeout);
      if (retry_timeout !== null) window.clearTimeout(retry_timeout);
    };
  }, [health_endpoint, metadata_endpoint, on_provider_failure, runtime_key]);

  return {
    runtime,
    error,
    is_loading: endpoints !== null && runtime === null && error === null
  };
}
