import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  usePilotComponents,
  usePilotEndpoints
} from "../../api/pilot/pilot_queries";
import { pilot_query_keys } from "../../api/pilot/pilot_query_keys";
import { createDeviceDirectory } from "./device_directory";
import {
  subscribeDeviceDirectoryEvents,
  type DeviceDirectoryEvent
} from "./device_directory_events";

const DIRECTORY_EVENT_COALESCE_MS = 50;

export function useDeviceDirectory() {
  const [last_event, setLastEvent] = useState<DeviceDirectoryEvent | null>(
    null
  );
  const query_client = useQueryClient();
  const components_query = usePilotComponents();
  const endpoints_query = usePilotEndpoints();
  const refreshDirectory = useCallback(async () => {
    await Promise.all([
      query_client.invalidateQueries({
        exact: true,
        queryKey: pilot_query_keys.components
      }),
      query_client.invalidateQueries({
        exact: true,
        queryKey: pilot_query_keys.endpoints
      })
    ]);
  }, [query_client]);

  useEffect(() => {
    let refresh_timeout: number | null = null;
    const scheduleRefresh = () => {
      if (refresh_timeout !== null) return;
      refresh_timeout = window.setTimeout(() => {
        refresh_timeout = null;
        void refreshDirectory();
      }, DIRECTORY_EVENT_COALESCE_MS);
    };
    const unsubscribe = subscribeDeviceDirectoryEvents(
      scheduleRefresh,
      undefined,
      setLastEvent
    );
    return () => {
      unsubscribe();
      if (refresh_timeout !== null) window.clearTimeout(refresh_timeout);
    };
  }, [refreshDirectory]);

  const directory = useMemo(() => {
    if (
      components_query.data === undefined ||
      endpoints_query.data === undefined
    ) {
      return undefined;
    }
    return createDeviceDirectory(components_query.data, endpoints_query.data);
  }, [components_query.data, endpoints_query.data]);

  return {
    directory,
    is_loading: components_query.isLoading || endpoints_query.isLoading,
    error: components_query.error ?? endpoints_query.error,
    refresh_directory: refreshDirectory,
    last_event
  };
}
