import type { ControlStatusSnapshot } from "../../api/pilot/pilot_stream_hub";
import type { RobotDirectoryEntry } from "./robot_directory";

export interface RobotCardViewModel {
  control_id: string;
  stream_id: string;
  status_label: string;
  tone: "success" | "warning" | "danger" | "neutral";
  robot_type: string;
  dof: string;
  servo: string;
  brake: string;
  update_age: string;
}

export function createRobotCardViewModel(
  entry: RobotDirectoryEntry,
  snapshot: ControlStatusSnapshot
): RobotCardViewModel {
  const robot_state = snapshot.status?.sample?.robot_state;
  const robot_interface = robot_state?.interface;
  const status = classifyStatus(snapshot);
  return {
    control_id: entry.control_id,
    stream_id: entry.stream_id,
    status_label: status.label,
    tone: status.tone,
    robot_type: robot_interface?.robot_type || "Unknown",
    dof:
      robot_interface === undefined ? "Unknown" : String(robot_interface.dof),
    servo:
      robot_interface === undefined
        ? "Unknown"
        : robot_interface.servo_activated
          ? "Activated"
          : "Not activated",
    brake:
      robot_interface === undefined
        ? "Unknown"
        : robot_interface.brake_released
          ? "Released"
          : "Applied",
    update_age: formatAge(snapshot.status?.age_ms ?? null)
  };
}

function classifyStatus(snapshot: ControlStatusSnapshot) {
  if (snapshot.state === "malformed" || snapshot.state === "error")
    return { label: "Unavailable", tone: "danger" as const };
  if (snapshot.state === "recovering")
    return { label: "Recovering", tone: "warning" as const };
  if (snapshot.status === null)
    return { label: "Awaiting status", tone: "neutral" as const };
  if (!snapshot.status.available)
    return { label: "Offline", tone: "danger" as const };
  if (snapshot.status.stale || !snapshot.status.fresh)
    return { label: "Stale", tone: "warning" as const };
  return { label: "Online", tone: "success" as const };
}

function formatAge(age_ms: number | null) {
  if (age_ms === null || !Number.isFinite(age_ms)) return "Unknown";
  if (age_ms < 1000) return `${Math.round(age_ms)} ms`;
  return `${(age_ms / 1000).toFixed(1)} s`;
}
