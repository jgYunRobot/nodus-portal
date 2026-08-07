import type { ControlStatusSnapshot } from "../../api/pilot/pilot_stream_hub";

export interface RobotVisualizationState {
  joint_positions: readonly number[] | null;
  message: string;
  tone: "success" | "warning" | "danger" | "neutral";
}

export function adaptRobotVisualizationState(
  snapshot: ControlStatusSnapshot
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
    positions.length < 6 ||
    positions.slice(0, 6).some((position) => !Number.isFinite(position))
  ) {
    return {
      joint_positions: null,
      message: "RobotStatus has no usable six-joint position vector.",
      tone: "warning"
    };
  }
  return {
    joint_positions: positions.slice(0, 6),
    message: "Authoritative RobotStatus is visualized.",
    tone: "success"
  };
}
