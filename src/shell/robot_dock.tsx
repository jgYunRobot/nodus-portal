import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate, useLocation, useParams } from "react-router";
import { useRobotStatusStreams } from "../api/pilot/pilot_queries";
import { useControlStatus } from "../api/pilot/use_control_status";
import { createRobotDirectory } from "../features/robot_directory/robot_directory";
import {
  getEffectiveControlId,
  getRoutePreservingRobotPath
} from "./robot_route_selection";
import {
  setPreferredControlId,
  setRobotDockMode,
  useRobotDockState,
  type RobotDockMode
} from "./robot_dock_state";
import styles from "./robot_dock.module.css";

function getDefaultRobotDockMode(): RobotDockMode {
  return window.matchMedia("(max-width: 720px)").matches
    ? "collapsed"
    : "expanded";
}

export function RobotDock() {
  const { control_id: route_control_id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const robot_dock = useRobotDockState();
  const streams = useRobotStatusStreams();
  const directory =
    streams.data === undefined ? null : createRobotDirectory(streams.data);
  const effective_control_id = getEffectiveControlId(
    route_control_id,
    robot_dock.preferred_control_id
  );
  const mode = robot_dock.dock_mode ?? getDefaultRobotDockMode();
  const is_expanded = mode === "expanded";

  function selectControl(control_id: string): void {
    setPreferredControlId(control_id);
    const target_path = getRoutePreservingRobotPath(
      location.pathname,
      control_id
    );
    if (target_path === null) return;
    navigate(`${target_path}${location.search}${location.hash}`);
  }

  return (
    <aside
      aria-label="Selected robot controls"
      className={
        is_expanded ? `${styles.dock} ${styles.expanded}` : styles.dock
      }
      data-mode={mode}
    >
      {is_expanded && effective_control_id !== null ? (
        <RobotDockStatus control_id={effective_control_id} />
      ) : null}
      <label className={styles.selector}>
        <span>Robot</span>
        <select
          aria-label="Selected robot"
          onChange={(event) => selectControl(event.target.value)}
          value={effective_control_id ?? ""}
        >
          {effective_control_id === null ? (
            <option value="">Select robot</option>
          ) : null}
          {effective_control_id !== null &&
          !directory?.entries.some(
            (entry) => entry.control_id === effective_control_id
          ) ? (
            <option value={effective_control_id}>
              {effective_control_id} (unavailable)
            </option>
          ) : null}
          {directory?.entries.map((entry) => (
            <option key={entry.control_id} value={entry.control_id}>
              {entry.control_id}
            </option>
          ))}
        </select>
      </label>
      <button
        aria-expanded={is_expanded}
        aria-label={
          is_expanded ? "Collapse robot controls" : "Expand robot controls"
        }
        className={styles.toggle}
        onClick={() => setRobotDockMode(is_expanded ? "collapsed" : "expanded")}
        type="button"
      >
        {is_expanded ? (
          <ChevronRight aria-hidden="true" />
        ) : (
          <ChevronLeft aria-hidden="true" />
        )}
      </button>
    </aside>
  );
}

function RobotDockStatus({ control_id }: { control_id: string }) {
  const snapshot = useControlStatus(control_id);
  const status = getRobotDockStatus(snapshot);
  return <p className={styles.status}>{status}</p>;
}

function getRobotDockStatus(
  snapshot: ReturnType<typeof useControlStatus>
): string {
  if (snapshot.state === "error" || snapshot.state === "malformed")
    return "Status unavailable";
  if (snapshot.state === "recovering") return "Status recovering";
  if (snapshot.status === null) return "Awaiting status";
  if (!snapshot.status.available) return "Offline";
  if (snapshot.status.stale || !snapshot.status.fresh) return "Status stale";
  return "Online";
}
