export type JogDirection = -1 | 1;
export type RotationMatrix3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number]
];
export type Vector3 = [number, number, number];
export type TaskTargetPosition = [
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

export const MAX_HOLD_ELAPSED_MS = 100;
export const JOINT_RATE_RAD_PER_SECOND = (250 * Math.PI) / 180;
export const TASK_TRANSLATION_RATE_PER_SECOND = 1;
export const TASK_ROTATION_RATE_RAD_PER_SECOND = (250 * Math.PI) / 180;
export const RECONCILIATION_TOLERANCE = 1e-6;
const AXIS_ANGLE_EPSILON = 1e-9;
const IDENTITY_ROTATION: RotationMatrix3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1]
];
export const READY_JOINT_TARGET = [0, 0, Math.PI / 2, 0, -Math.PI / 2, 0];
export const HOME_JOINT_TARGET = [0, 0, 0, 0, 0, 0];

export function projectDirectionalTarget(
  projected: number,
  authoritative: number,
  direction: JogDirection,
  speed_percent: number,
  elapsed_ms: number,
  rate_per_second: number
): number {
  const elapsed_seconds = Math.min(elapsed_ms, MAX_HOLD_ELAPSED_MS) / 1000;
  const distance =
    rate_per_second * (clampSpeed(speed_percent) / 100) * elapsed_seconds;
  const reconciled =
    direction > 0
      ? Math.max(projected, authoritative - RECONCILIATION_TOLERANCE)
      : Math.min(projected, authoritative + RECONCILIATION_TOLERANCE);
  return reconciled + direction * distance;
}

export function projectGoalTarget(
  projected: readonly number[],
  authoritative: readonly number[],
  goal: readonly number[],
  speed_percent: number,
  elapsed_ms: number
): number[] {
  const elapsed_seconds = Math.min(elapsed_ms, MAX_HOLD_ELAPSED_MS) / 1000;
  const distance =
    JOINT_RATE_RAD_PER_SECOND *
    (clampSpeed(speed_percent) / 100) *
    elapsed_seconds;
  const projected_distance = Math.hypot(
    ...goal.map((goal_position, index) => goal_position - projected[index]!)
  );
  const authoritative_distance = Math.hypot(
    ...goal.map((goal_position, index) => goal_position - authoritative[index]!)
  );
  const baseline =
    authoritative_distance + RECONCILIATION_TOLERANCE < projected_distance
      ? authoritative
      : projected;
  const delta = goal.map(
    (goal_position, index) => goal_position - baseline[index]!
  );
  const distance_to_goal = Math.hypot(...delta);
  if (distance_to_goal <= distance) return [...goal];
  if (distance_to_goal <= RECONCILIATION_TOLERANCE) return [...goal];
  return goal.map(
    (_, index) =>
      baseline[index]! + (delta[index]! / distance_to_goal) * distance
  );
}

export function createEulerRotationMatrix(
  r1: number,
  r2: number,
  r3: number,
  euler_type: string
): RotationMatrix3 | null {
  const axes = euler_type.toUpperCase();
  const angles = [r1, r2, r3];
  let rotation = cloneRotationMatrix(IDENTITY_ROTATION);
  for (let index = 0; index < angles.length; index += 1) {
    const axis = axes[index];
    const angle = angles[index];
    if (!isRotationAxis(axis) || angle === undefined) return null;
    rotation = multiplyRotationMatrices(
      rotation,
      createAxisRotationMatrix(axis, angle)
    );
  }
  return rotation;
}

export function projectTaskRotation(
  projected: RotationMatrix3,
  authoritative: RotationMatrix3,
  axis_index: number,
  direction: JogDirection,
  speed_percent: number,
  elapsed_ms: number
): RotationMatrix3 | null {
  const axis = ["X", "Y", "Z"][axis_index - 3];
  if (!isRotationAxis(axis)) return null;
  const relative = multiplyRotationMatrices(
    authoritative,
    transposeRotationMatrix(projected)
  );
  const authoritative_progress = getAxisRotation(relative, axis);
  const baseline =
    direction * authoritative_progress > RECONCILIATION_TOLERANCE
      ? authoritative
      : projected;
  const elapsed_seconds = Math.min(elapsed_ms, MAX_HOLD_ELAPSED_MS) / 1000;
  const delta_angle =
    direction *
    TASK_ROTATION_RATE_RAD_PER_SECOND *
    (clampSpeed(speed_percent) / 100) *
    elapsed_seconds;
  return multiplyRotationMatrices(
    createAxisRotationMatrix(axis, delta_angle),
    baseline
  );
}

export function createTaskTargetPosition(
  translation: readonly number[],
  rotation: RotationMatrix3
): TaskTargetPosition | null {
  if (
    translation.length !== 3 ||
    translation.some((value) => !Number.isFinite(value))
  ) {
    return null;
  }
  const axis_angle = convertRotationMatrixToAxisAngle(rotation);
  return [
    translation[0]!,
    translation[1]!,
    translation[2]!,
    axis_angle.axis[0],
    axis_angle.axis[1],
    axis_angle.axis[2],
    axis_angle.angle
  ];
}

function cloneRotationMatrix(rotation: RotationMatrix3): RotationMatrix3 {
  return rotation.map((row) => [...row]) as RotationMatrix3;
}

function isRotationAxis(axis: string | undefined): axis is "X" | "Y" | "Z" {
  return axis === "X" || axis === "Y" || axis === "Z";
}

function createAxisRotationMatrix(
  axis: "X" | "Y" | "Z",
  angle_rad: number
): RotationMatrix3 {
  const cos_angle = Math.cos(angle_rad);
  const sin_angle = Math.sin(angle_rad);
  if (axis === "X") {
    return [
      [1, 0, 0],
      [0, cos_angle, -sin_angle],
      [0, sin_angle, cos_angle]
    ];
  }
  if (axis === "Y") {
    return [
      [cos_angle, 0, sin_angle],
      [0, 1, 0],
      [-sin_angle, 0, cos_angle]
    ];
  }
  return [
    [cos_angle, -sin_angle, 0],
    [sin_angle, cos_angle, 0],
    [0, 0, 1]
  ];
}

function multiplyRotationMatrices(
  left: RotationMatrix3,
  right: RotationMatrix3
): RotationMatrix3 {
  return [0, 1, 2].map((row) =>
    [0, 1, 2].map(
      (column) =>
        left[row]![0] * right[0][column]! +
        left[row]![1] * right[1][column]! +
        left[row]![2] * right[2][column]!
    )
  ) as RotationMatrix3;
}

function transposeRotationMatrix(rotation: RotationMatrix3): RotationMatrix3 {
  return [
    [rotation[0][0], rotation[1][0], rotation[2][0]],
    [rotation[0][1], rotation[1][1], rotation[2][1]],
    [rotation[0][2], rotation[1][2], rotation[2][2]]
  ];
}

function getAxisRotation(
  rotation: RotationMatrix3,
  axis: "X" | "Y" | "Z"
): number {
  if (axis === "X") return Math.atan2(rotation[2][1], rotation[1][1]);
  if (axis === "Y") return Math.atan2(rotation[0][2], rotation[0][0]);
  return Math.atan2(rotation[1][0], rotation[0][0]);
}

function convertRotationMatrixToAxisAngle(rotation: RotationMatrix3): {
  axis: Vector3;
  angle: number;
} {
  const trace = rotation[0][0] + rotation[1][1] + rotation[2][2];
  const angle = Math.acos(Math.min(Math.max((trace - 1) / 2, -1), 1));
  if (Math.abs(angle) <= AXIS_ANGLE_EPSILON) {
    return { axis: [1, 0, 0], angle: 0 };
  }
  if (Math.abs(Math.PI - angle) <= AXIS_ANGLE_EPSILON) {
    return { axis: convertPiRotationMatrixToAxis(rotation), angle };
  }
  const denominator = 2 * Math.sin(angle);
  return {
    axis: normalizeVector3([
      (rotation[2][1] - rotation[1][2]) / denominator,
      (rotation[0][2] - rotation[2][0]) / denominator,
      (rotation[1][0] - rotation[0][1]) / denominator
    ]),
    angle
  };
}

function convertPiRotationMatrixToAxis(rotation: RotationMatrix3): Vector3 {
  const diagonal = [rotation[0][0], rotation[1][1], rotation[2][2]];
  const dominant_index = diagonal.indexOf(Math.max(...diagonal));
  const axis = [0, 0, 0] as Vector3;
  const dominant =
    Math.sqrt(
      Math.max(1 + 2 * diagonal[dominant_index]! - traceRotation(rotation), 0)
    ) / 2;
  if (dominant <= AXIS_ANGLE_EPSILON) return [1, 0, 0];
  axis[dominant_index] = dominant;
  const first_other = (dominant_index + 1) % 3;
  const second_other = (dominant_index + 2) % 3;
  axis[first_other] =
    (rotation[dominant_index]![first_other]! +
      rotation[first_other]![dominant_index]!) /
    (4 * dominant);
  axis[second_other] =
    (rotation[dominant_index]![second_other]! +
      rotation[second_other]![dominant_index]!) /
    (4 * dominant);
  return normalizeVector3(axis);
}

function traceRotation(rotation: RotationMatrix3): number {
  return rotation[0][0] + rotation[1][1] + rotation[2][2];
}

function normalizeVector3(vector: Vector3): Vector3 {
  const norm = Math.hypot(vector[0], vector[1], vector[2]);
  if (norm <= AXIS_ANGLE_EPSILON) return [1, 0, 0];
  return [vector[0] / norm, vector[1] / norm, vector[2] / norm];
}

function clampSpeed(speed_percent: number): number {
  return Math.min(100, Math.max(1, speed_percent));
}
