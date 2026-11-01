import {
  createBodyExample,
  operation_schemas,
  isJsonObject
} from "./api_catalog";
import {
  createEulerRotationMatrix,
  type RotationMatrix3
} from "../operations/jog_target_projector";
import type { RobotFramePose } from "../robot_model/frame_axes";

export function getCommandLabel(name: string): string {
  const aliases: Record<string, string> = {
    "control.move_linear_request": "moveL",
    "control.move_joint_request": "moveJ",
    "control.move_circle_request": "moveC",
    "control.set_force": "setForce",
    "control.set_ik_mode": "setIkMode"
  };
  return (
    aliases[name] ??
    name
      .replace("control.", "")
      .replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
  );
}
export function createCommandExample(
  name: string,
  control_id: string | null
): string {
  const schema = operation_schemas.find((item) => item.name === name)!.schema;
  const body = JSON.parse(createBodyExample(schema, control_id, true));
  const payload = body.payload as Record<string, unknown>;
  if (Array.isArray(payload.pose) && payload.pose.length === 7)
    payload.pose = [0, 0, 0, 0, 0, 0, 1];
  if (name === "control.move_joint_request") {
    for (const key of ["start", "dest"]) payload[key] = Array(6).fill(0);
    payload.velocity_limit = Array(6).fill((5 * Math.PI) / 180);
    payload.acceleration_limit = Array(6).fill((10 * Math.PI) / 180);
    payload.jerk_limit = Array(6).fill((50 * Math.PI) / 180);
    payload.auto_play = true;
  }
  if (
    name === "control.move_linear_request" ||
    name === "control.move_circle_request"
  ) {
    payload.start = [0, 0, 0, 0, 0, 0, 1];
    payload.dest = [0, 0, 0, 0, 0, 0, 1];
    payload.linear_limit = [0.05, 0.1, 0.5];
    payload.angular_limit = [10, 20, 100].map(
      (value) => (value * Math.PI) / 180
    );
    payload.auto_play = true;
  }
  return JSON.stringify(body, null, 2);
}

export function poseToFields(pose: number[]): number[] {
  const [x, y, z, qx, qy, qz, qw] = pose;
  const roll = Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy));
  const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (qw * qy - qz * qx))));
  const yaw = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));
  return [
    x,
    y,
    z,
    (yaw * 180) / Math.PI,
    (pitch * 180) / Math.PI,
    (roll * 180) / Math.PI
  ];
}
export function fieldsToPose(fields: number[]): number[] {
  const [x, y, z] = fields;
  const [yaw, pitch, roll] = fields
    .slice(3)
    .map((value) => (value * Math.PI) / 360);
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    cr = Math.cos(roll),
    sr = Math.sin(roll);
  return [
    x,
    y,
    z,
    sr * cp * cy - cr * sp * sy,
    cr * sp * cy + sr * cp * sy,
    cr * cp * sy - sr * sp * cy,
    cr * cp * cy + sr * sp * sy
  ];
}
function matrixToQuaternion(r: RotationMatrix3): number[] {
  const trace = r[0][0] + r[1][1] + r[2][2];
  if (trace > 0) {
    const scale = Math.sqrt(trace + 1) * 2;
    return [
      (r[2][1] - r[1][2]) / scale,
      (r[0][2] - r[2][0]) / scale,
      (r[1][0] - r[0][1]) / scale,
      scale / 4
    ];
  }
  const axis =
    r[0][0] > r[1][1] && r[0][0] > r[2][2] ? 0 : r[1][1] > r[2][2] ? 1 : 2;
  const b = (axis + 1) % 3,
    c = (axis + 2) % 3;
  const scale = Math.sqrt(1 + r[axis][axis] - r[b][b] - r[c][c]) * 2;
  const q = [0, 0, 0, 0];
  q[axis] = scale / 4;
  q[b] = (r[b][axis] + r[axis][b]) / scale;
  q[c] = (r[c][axis] + r[axis][c]) / scale;
  q[3] = (r[c][b] - r[b][c]) / scale;
  return q;
}
export function frameToPose(frame: RobotFramePose): number[] | null {
  const rotation = createEulerRotationMatrix(
    frame.r1,
    frame.r2,
    frame.r3,
    frame.euler_type
  );
  return rotation === null
    ? null
    : [frame.x, frame.y, frame.z, ...matrixToQuaternion(rotation)];
}
export function setCommandPayload(body: string, payload: unknown): string {
  const value: unknown = JSON.parse(body);
  if (!isJsonObject(value))
    throw new Error("Request body must be a JSON object.");
  return JSON.stringify({ ...value, payload }, null, 2);
}
