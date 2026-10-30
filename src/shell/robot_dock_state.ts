import { useSyncExternalStore } from "react";
import { getPortalConfig } from "../config/portal_config";

export type RobotDockMode = "expanded" | "collapsed";

export interface RobotDockPresentationState {
  preferred_control_id: string | null;
  dock_mode: RobotDockMode | null;
}

export const ROBOT_DOCK_STORAGE_KEY = "nodus_portal.robot_dock.v1";

function getStorageKey(): string {
  const config = getPortalConfig();
  return config.pilot_discovery_enabled
    ? `${ROBOT_DOCK_STORAGE_KEY}.${config.pilot_id ?? "unselected"}`
    : ROBOT_DOCK_STORAGE_KEY;
}

const EMPTY_STATE: RobotDockPresentationState = {
  preferred_control_id: null,
  dock_mode: null
};

const listeners = new Set<() => void>();
let state = readRobotDockState();

export function useRobotDockState(): RobotDockPresentationState {
  return useSyncExternalStore(
    subscribeRobotDock,
    getRobotDockState,
    getRobotDockState
  );
}

export function setPreferredControlId(control_id: string | null): void {
  updateRobotDockState({ ...state, preferred_control_id: control_id });
}

export function setPilotPreferredControlId(
  pilot_id: string,
  control_id: string
): void {
  try {
    const key = `${ROBOT_DOCK_STORAGE_KEY}.${pilot_id}`;
    const target = parseRobotDockState(window.localStorage.getItem(key));
    window.localStorage.setItem(
      key,
      JSON.stringify({ ...target, preferred_control_id: control_id })
    );
  } catch {
    // The robot-scoped URL still identifies the destination without storage.
  }
}

export function setRobotDockMode(mode: RobotDockMode): void {
  updateRobotDockState({ ...state, dock_mode: mode });
}

export function parseRobotDockState(
  value: string | null
): RobotDockPresentationState {
  if (value === null) return EMPTY_STATE;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return EMPTY_STATE;
    const record = parsed as Record<string, unknown>;
    const preferred_control_id =
      typeof record.preferred_control_id === "string"
        ? record.preferred_control_id
        : null;
    const dock_mode =
      record.dock_mode === "expanded" || record.dock_mode === "collapsed"
        ? record.dock_mode
        : null;
    return { preferred_control_id, dock_mode };
  } catch {
    return EMPTY_STATE;
  }
}

function subscribeRobotDock(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getRobotDockState(): RobotDockPresentationState {
  return state;
}

export function readRobotDockState(): RobotDockPresentationState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    return parseRobotDockState(window.localStorage.getItem(getStorageKey()));
  } catch {
    return EMPTY_STATE;
  }
}

function updateRobotDockState(next_state: RobotDockPresentationState): void {
  state = next_state;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(getStorageKey(), JSON.stringify(state));
    } catch {
      // 브라우저 저장소를 사용할 수 없어도 현재 Portal 세션의 선택 상태는 유지한다.
    }
  }
  for (const listener of listeners) listener();
}
