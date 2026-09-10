import type { ControlStatusSnapshot } from "../../api/pilot/pilot_stream_hub";
import { E_ROB_3KG_PROFILE, type RobotProfile } from "./robot_profile";

export interface RobotVisualizationState {
  joint_positions: readonly number[] | null;
  message: string;
  tone: "success" | "warning" | "danger" | "neutral";
}

export function adaptRobotVisualizationState(
  snapshot: ControlStatusSnapshot,
  profile: RobotProfile = E_ROB_3KG_PROFILE
): RobotVisualizationState {
  if (snapshot.state === "malformed" || snapshot.state === "error") {
    return {
      joint_positions: null,
      message: snapshot.last_error ?? "Robot status is unavailable.",
      tone: "danger"
    };
  }
  if (snapshot.state === "recovering") {
    return {
      joint_positions: null,
      message: "Recovering authoritative RobotStatus.",
      tone: "warning"
    };
  }
  if (snapshot.status === null || !snapshot.status.available) {
    return {
      joint_positions: null,
      message: "No authoritative RobotStatus is available.",
      tone: "neutral"
    };
  }
  if (snapshot.status.stale || !snapshot.status.fresh) {
    return {
      joint_positions: null,
      message: "RobotStatus is stale; visualization is held.",
      tone: "warning"
    };
  }

  const positions = snapshot.status.sample?.robot_state.real.pos;
  if (
    positions === undefined ||
    positions.length !== profile.joint_names.length ||
    positions.some((position) => !Number.isFinite(position))
  ) {
    return {
      joint_positions: null,
      message: `RobotStatus requires ${profile.joint_names.length} finite joint positions for ${profile.label}.`,
      tone: "warning"
    };
  }
  return {
    joint_positions: positions,
    message: "Authoritative RobotStatus is visualized.",
    tone: "success"
  };
}
