import { useMemo } from "react";
import {
  usePilotComponents,
  usePilotEndpoints
} from "../../api/pilot/pilot_queries";
import { createDeviceDirectory } from "./device_directory";

export function useDeviceDirectory() {
  const components_query = usePilotComponents();
  const endpoints_query = usePilotEndpoints();
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
    error: components_query.error ?? endpoints_query.error
  };
}
