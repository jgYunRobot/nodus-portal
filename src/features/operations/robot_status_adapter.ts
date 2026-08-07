import type { ControlStatusSnapshot } from "../../api/pilot/pilot_stream_hub";

export interface MotionRobotStatus {
  joint_positions: readonly number[];
  frames: ReadonlyMap<string, readonly number[]>;
  connection_generation: number;
}

export function adaptMotionRobotStatus(
  snapshot: ControlStatusSnapshot
): MotionRobotStatus | null {
  if (
    snapshot.state !== "live" ||
    snapshot.status === null ||
    !snapshot.status.available ||
    !snapshot.status.fresh ||
    snapshot.status.stale ||
    snapshot.status.sample === null
  ) {
    return null;
  }
  const joint_positions = snapshot.status.sample.robot_state.real.pos;
  if (
    joint_positions.length < 6 ||
    joint_positions.slice(0, 6).some((position) => !Number.isFinite(position))
  ) {
    return null;
  }
  const frames = new Map<string, readonly number[]>();
  snapshot.status.sample.robot_state.frames.forEach((frame) => {
    const pose = [frame.x, frame.y, frame.z, frame.r1, frame.r2, frame.r3];
    if (pose.every(Number.isFinite)) frames.set(frame.name, pose);
  });
  return {
    joint_positions: joint_positions.slice(),
    frames,
    connection_generation: snapshot.status.connection_generation
  };
}
