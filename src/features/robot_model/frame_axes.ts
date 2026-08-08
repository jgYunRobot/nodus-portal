import type { RotationMatrix3 } from "../operations/jog_target_projector";
import { createEulerRotationMatrix } from "../operations/jog_target_projector";

export interface RobotFramePose {
  id: number;
  name: string;
  x: number;
  y: number;
  z: number;
  r1: number;
  r2: number;
  r3: number;
  euler_type: string;
}

export interface RobotFrameAxesPose {
  id: number;
  name: string;
  position: [number, number, number];
  rotation: RotationMatrix3;
}

export function createRobotFrameAxes(
  frames: readonly RobotFramePose[]
): RobotFrameAxesPose[] {
  return frames.flatMap((frame) => {
    const position: [number, number, number] = [frame.x, frame.y, frame.z];
    const euler_angles = [frame.r1, frame.r2, frame.r3];
    const rotation = createEulerRotationMatrix(
      frame.r1,
      frame.r2,
      frame.r3,
      frame.euler_type
    );
    if (
      !position.every(Number.isFinite) ||
      !euler_angles.every(Number.isFinite) ||
      rotation === null
    ) {
      return [];
    }
    return [{ id: frame.id, name: frame.name, position, rotation }];
  });
}
