import { useQuery } from "@tanstack/react-query";
import { getPortalConfig } from "../../config/portal_config";
import {
  parsePilotDirectory,
  PILOT_DIRECTORY_PATH,
  withPilotScope
} from "./pilot_directory";

export function usePilotDirectory() {
  const config = getPortalConfig();
  return useQuery({
    queryKey: ["portal", "pilot_directory", config.pilot_id ?? null],
    enabled: config.pilot_discovery_enabled === true,
    queryFn: async () => {
      const response = await fetch(
        withPilotScope(PILOT_DIRECTORY_PATH, config.pilot_id ?? null),
        {
          cache: "no-store",
          signal: AbortSignal.timeout(5000)
        }
      );
      if (!response.ok) throw new Error("Pilot directory is unavailable.");
      return parsePilotDirectory(await response.json());
    },
    refetchInterval: 3000,
    retry: false
  });
}
