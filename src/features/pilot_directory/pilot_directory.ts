export const PILOT_DIRECTORY_PATH = "/__portal/pilots";
export const PILOT_SELECTION_STORAGE_KEY = "nodus_portal.pilot.v1";

export interface DiscoveredPilot {
  pilot_id: string;
  endpoint: string;
  server_instance_id: string;
  control_ids: string[];
}

export interface PilotDirectory {
  schema_version: 1;
  pilots: DiscoveredPilot[];
  partial: boolean;
  discovery_error: string | null;
}

export function parsePilotDirectory(value: unknown): PilotDirectory {
  const data = value as PilotDirectory;
  if (
    data?.schema_version !== 1 ||
    !Array.isArray(data.pilots) ||
    typeof data.partial !== "boolean" ||
    !(
      data.discovery_error === null || typeof data.discovery_error === "string"
    ) ||
    !data.pilots.every(
      (pilot) =>
        /^[a-f0-9]{24}$/.test(pilot.pilot_id) &&
        typeof pilot.endpoint === "string" &&
        typeof pilot.server_instance_id === "string" &&
        Array.isArray(pilot.control_ids) &&
        pilot.control_ids.every((id) => typeof id === "string")
    )
  )
    throw new Error("Portal host returned an invalid Pilot directory.");
  return data;
}

export function choosePilotId(
  directory: PilotDirectory,
  requested_id: string | null,
  saved_id: string | null
): string | null {
  return (
    requested_id ??
    saved_id ??
    (!directory.partial &&
    directory.discovery_error === null &&
    directory.pilots.length === 1
      ? directory.pilots[0].pilot_id
      : null)
  );
}

export function getPilotRobotKey(pilot_id: string, control_id: string): string {
  return JSON.stringify([pilot_id, control_id]);
}

export function withPilotScope(path: string, pilot_id: string | null): string {
  if (pilot_id === null) return path;
  const url = new URL(path, "http://portal.local");
  url.searchParams.set("pilot", pilot_id);
  return `${url.pathname}${url.search}${url.hash}`;
}
