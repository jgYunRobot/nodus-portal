import { useQuery } from "@tanstack/react-query";
import { getPortalConfig } from "../../config/portal_config";
import { parsePilotDirectory, PILOT_DIRECTORY_PATH } from "./pilot_directory";

export function usePilotDirectory() {
  return useQuery({
    queryKey: ["portal", "pilot_directory"],
    enabled: getPortalConfig().pilot_discovery_enabled === true,
    queryFn: async () => {
      const response = await fetch(PILOT_DIRECTORY_PATH, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) throw new Error("Pilot directory is unavailable.");
      return parsePilotDirectory(await response.json());
    },
    refetchInterval: 3000,
    retry: false
  });
}
