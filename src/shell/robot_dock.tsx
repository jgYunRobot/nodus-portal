import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useNavigate, useLocation, useParams } from "react-router";
import { useRobotStatusStreams } from "../api/pilot/pilot_queries";
import { useControlStatus } from "../api/pilot/use_control_status";
import { createRobotDirectory } from "../features/robot_directory/robot_directory";
import { RobotCommandControls } from "../features/operations/robot_command_controls";
import { usePortalOperationRuntime } from "../features/operations/portal_operation_context";
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
      {effective_control_id === null ? (
        <RobotDockSelector
          control_id={null}
          directory={directory}
          on_select={selectControl}
        />
      ) : (
        <SelectedRobotDock
          control_id={effective_control_id}
          directory={directory}
          is_expanded={is_expanded}
          on_select={selectControl}
        />
      )}
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

function SelectedRobotDock({
  control_id,
  directory,
  is_expanded,
  on_select
}: {
  control_id: string;
  directory: ReturnType<typeof createRobotDirectory> | null;
  is_expanded: boolean;
  on_select: (control_id: string) => void;
}) {
  const runtime = usePortalOperationRuntime();
  const hold = runtime.getHold(control_id);
  const scheduler = runtime.getScheduler(control_id);
  const operation = useSyncExternalStore(
    (listener) => scheduler.subscribe(listener),
    () => scheduler.getSnapshot(),
    () => scheduler.getSnapshot()
  );
  const selection_locked =
    hold.active || operation.in_flight || operation.has_pending;

  function selectDestinationControl(destination_control_id: string): void {
    if (destination_control_id === control_id || selection_locked) return;
    runtime.cancel(control_id);
    on_select(destination_control_id);
  }

  return (
    <>
      {is_expanded ? (
        <>
          <RobotDockStatus control_id={control_id} />
          <RobotCommandControls control_id={control_id} />
        </>
      ) : null}
      <RobotDockSelector
        control_id={control_id}
        directory={directory}
        disabled={selection_locked}
        on_select={selectDestinationControl}
      />
    </>
  );
}

function RobotDockSelector({
  control_id,
  directory,
  disabled = false,
  on_select
}: {
  control_id: string | null;
  directory: ReturnType<typeof createRobotDirectory> | null;
  disabled?: boolean;
  on_select: (control_id: string) => void;
}) {
  return (
    <label className={styles.selector}>
      <span>Robot</span>
      <select
        aria-label="Selected robot"
        disabled={disabled}
        onChange={(event) => on_select(event.target.value)}
        value={control_id ?? ""}
      >
        {control_id === null ? <option value="">Select robot</option> : null}
        {control_id !== null &&
        !directory?.entries.some((entry) => entry.control_id === control_id) ? (
          <option value={control_id}>{control_id} (unavailable)</option>
        ) : null}
        {directory?.entries.map((entry) => (
          <option key={entry.control_id} value={entry.control_id}>
            {entry.control_id}
          </option>
        ))}
      </select>
    </label>
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
