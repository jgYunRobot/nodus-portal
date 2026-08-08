import { useSyncExternalStore } from "react";

export type RobotDockMode = "expanded" | "collapsed";

export interface RobotDockPresentationState {
  preferred_control_id: string | null;
  dock_mode: RobotDockMode | null;
}

export const ROBOT_DOCK_STORAGE_KEY = "nodus_portal.robot_dock.v1";

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

function readRobotDockState(): RobotDockPresentationState {
  if (typeof window === "undefined") return EMPTY_STATE;
  return parseRobotDockState(
    window.localStorage.getItem(ROBOT_DOCK_STORAGE_KEY)
  );
}

function updateRobotDockState(next_state: RobotDockPresentationState): void {
  state = next_state;
  window.localStorage.setItem(ROBOT_DOCK_STORAGE_KEY, JSON.stringify(state));
  for (const listener of listeners) listener();
}
