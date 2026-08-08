export type RobotPageKind = "device" | "jogging" | "operating";

const ROBOT_PAGE_KINDS = new Set<RobotPageKind>([
  "device",
  "jogging",
  "operating"
]);

export function getEffectiveControlId(
  route_control_id: string | undefined,
  preferred_control_id: string | null
): string | null {
  return route_control_id ?? preferred_control_id;
}

export function getRobotPageKind(pathname: string): RobotPageKind | null {
  const match = /^\/robots\/[^/]+\/(device|jogging|operating)$/.exec(pathname);
  if (match === null || !ROBOT_PAGE_KINDS.has(match[1] as RobotPageKind))
    return null;
  return match[1] as RobotPageKind;
}

export function getRoutePreservingRobotPath(
  pathname: string,
  control_id: string
): string | null {
  const page_kind = getRobotPageKind(pathname);
  if (page_kind === null) return null;
  return `/robots/${encodeURIComponent(control_id)}/${page_kind}`;
}
