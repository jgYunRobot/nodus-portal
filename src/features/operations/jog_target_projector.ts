export type JogDirection = -1 | 1;

export const MAX_HOLD_ELAPSED_MS = 100;
export const JOINT_RATE_RAD_PER_SECOND = (250 * Math.PI) / 180;
export const TASK_TRANSLATION_RATE_PER_SECOND = 1;
export const TASK_ROTATION_RATE_RAD_PER_SECOND = (250 * Math.PI) / 180;
export const RECONCILIATION_TOLERANCE = 1e-6;
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
  return goal.map((goal_position, index) => {
    const direction: JogDirection = goal_position >= projected[index] ? 1 : -1;
    const reconciled =
      direction > 0
        ? Math.max(
            projected[index],
            authoritative[index] - RECONCILIATION_TOLERANCE
          )
        : Math.min(
            projected[index],
            authoritative[index] + RECONCILIATION_TOLERANCE
          );
    const candidate = reconciled + direction * distance;
    return direction > 0
      ? Math.min(candidate, goal_position)
      : Math.max(candidate, goal_position);
  });
}

function clampSpeed(speed_percent: number): number {
  return Math.min(100, Math.max(1, speed_percent));
}
