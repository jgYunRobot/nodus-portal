import { useEffect, useState } from "react";
import {
  fetchVisionCameraRuntime,
  type VisionCameraEndpoints,
  type VisionCameraRuntime
} from "./vision_camera";

export function useVisionCamera(
  runtime_key: string,
  endpoints: VisionCameraEndpoints | null
) {
  const [runtime, setRuntime] = useState<VisionCameraRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRuntime(null);
    setError(null);
    if (endpoints === null) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    void fetchVisionCameraRuntime(endpoints, controller.signal)
      .then((next_runtime) => setRuntime(next_runtime))
      .catch((next_error: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          next_error instanceof Error
            ? next_error.message
            : "Vision provider request failed."
        );
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [endpoints, runtime_key]);

  return {
    runtime,
    error,
    is_loading: endpoints !== null && runtime === null && error === null
  };
}
