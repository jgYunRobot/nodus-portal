import type { PortalConfig } from "./portal_config";
import {
  choosePilotId,
  parsePilotDirectory,
  PILOT_DIRECTORY_PATH,
  PILOT_SELECTION_STORAGE_KEY,
  withPilotScope
} from "../features/pilot_directory/pilot_directory";

let navigate_pilot = (url: string) => window.location.assign(url);

export function configurePilotNavigation(
  navigate: (url: string) => void
): void {
  navigate_pilot = navigate;
}

export function readSavedPilotId(): string | null {
  try {
    return window.localStorage.getItem(PILOT_SELECTION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function rememberPilotId(pilot_id: string): void {
  try {
    window.localStorage.setItem(PILOT_SELECTION_STORAGE_KEY, pilot_id);
  } catch {
    // The URL still identifies the selected Pilot when storage is unavailable.
  }
}

export function navigateToPilot(pilot_id: string, path: string): void {
  rememberPilotId(pilot_id);
  navigate_pilot(withPilotScope(path, pilot_id));
}

export async function resolvePilotLaunch(
  config: PortalConfig,
  location: Pick<Location, "origin" | "search"> = window.location,
  fetch_directory: typeof fetch = fetch,
  saved_id = readSavedPilotId()
): Promise<PortalConfig> {
  const requested_id = new URLSearchParams(location.search).get("pilot");
  let selected_id = requested_id ?? saved_id;
  let managed = selected_id !== null;
  try {
    const response = await fetch_directory(PILOT_DIRECTORY_PATH, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      const data: unknown = await response.json();
      managed = true;
      const directory = parsePilotDirectory(data);
      selected_id = choosePilotId(directory, requested_id, saved_id);
    } else if (response.status !== 404) {
      managed = true;
    }
  } catch {
    // Older static hosts keep explicit configuration; selected IDs never fall back.
  }
  if (!managed) return config;
  return {
    ...config,
    pilot_discovery_enabled: true,
    pilot_id: selected_id,
    pilot_base_url: new URL(
      `${PILOT_DIRECTORY_PATH}/${selected_id ?? "unselected"}/`,
      location.origin
    ).toString()
  };
}
