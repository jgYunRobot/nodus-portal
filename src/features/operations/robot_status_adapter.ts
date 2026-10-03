import type { ControlStatusSnapshot } from "../../api/pilot/pilot_stream_hub";
import {
  createEulerRotationMatrix,
  type RotationMatrix3,
  type Vector3
} from "./jog_target_projector";

export interface MotionTaskFrame {
  id: number;
  translation: Vector3;
  rotation: RotationMatrix3;
}

export interface MotionRobotStatus {
  joint_positions: readonly number[];
  frames: ReadonlyMap<string, MotionTaskFrame>;
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
  const frames = new Map<string, MotionTaskFrame>();
  snapshot.status.sample.robot_state.frames.forEach((frame) => {
    const translation: Vector3 = [frame.x, frame.y, frame.z];
    const rotation = createEulerRotationMatrix(
      frame.r1,
      frame.r2,
      frame.r3,
      frame.euler_type
    );
    if (translation.every(Number.isFinite) && rotation !== null) {
      frames.set(frame.name, { id: frame.id, translation, rotation });
    }
  });
  return {
    joint_positions: joint_positions.slice(),
    frames,
    connection_generation: snapshot.status.connection_generation
  };
}
