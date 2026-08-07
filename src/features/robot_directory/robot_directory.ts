import type { components } from "../../api/pilot/generated/pilot_v1";

export const MAX_HOME_STATUS_SUBSCRIPTIONS = 24;

export interface RobotDirectoryEntry {
  control_id: string;
  stream_id: string;
  schema_id: string;
  server_instance_id: string;
}

export interface RobotDirectory {
  entries: RobotDirectoryEntry[];
  omitted_count: number;
}

export function createRobotDirectory(
  response: components["schemas"]["SampleStreamsResponse"]
): RobotDirectory {
  const descriptors = response.streams
    .filter((descriptor) => descriptor.stream_kind === "robot_status")
    .sort(
      (left, right) =>
        left.control_id.localeCompare(right.control_id) ||
        left.stream_id.localeCompare(right.stream_id)
    );
  const seen_controls = new Set<string>();
  const entries = descriptors.flatMap((descriptor) => {
    if (seen_controls.has(descriptor.control_id)) return [];
    seen_controls.add(descriptor.control_id);
    return [
      {
        control_id: descriptor.control_id,
        stream_id: descriptor.stream_id,
        schema_id: descriptor.schema_id,
        server_instance_id: response.server_instance_id
      }
    ];
  });

  return {
    entries: entries.slice(0, MAX_HOME_STATUS_SUBSCRIPTIONS),
    omitted_count: Math.max(0, entries.length - MAX_HOME_STATUS_SUBSCRIPTIONS)
  };
}
