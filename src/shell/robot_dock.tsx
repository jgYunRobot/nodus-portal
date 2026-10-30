import { ChevronLeft, ChevronRight } from "lucide-react";
import { type TransitionEvent, useState, useSyncExternalStore } from "react";
import { useNavigate, useLocation, useParams } from "react-router";
import { useRobotStatusStreams } from "../api/pilot/pilot_queries";
import { useControlStatus } from "../api/pilot/use_control_status";
import { getPortalConfig } from "../config/portal_config";
import { navigateToPilot } from "../config/pilot_launch";
import {
  getPilotRobotKey,
  type DiscoveredPilot
} from "../features/pilot_directory/pilot_directory";
import { usePilotDirectory } from "../features/pilot_directory/use_pilot_directory";
import { createRobotDirectory } from "../features/robot_directory/robot_directory";
import { RobotCommandControls } from "../features/operations/robot_command_controls";
import {
  usePortalOperationRuntime,
  useRobotSelectionLocked
} from "../features/operations/portal_operation_context";
import {
  getEffectiveControlId,
  getRoutePreservingRobotPath
} from "./robot_route_selection";
import {
  setPreferredControlId,
  setPilotPreferredControlId,
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
  const [show_expanded_content, setShowExpandedContent] = useState(is_expanded);

  function toggleDock(): void {
    if (is_expanded) {
      setShowExpandedContent(false);
      setRobotDockMode("collapsed");
      return;
    }
    setShowExpandedContent(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    setRobotDockMode("expanded");
  }

  function revealExpandedContent(event: TransitionEvent<HTMLElement>): void {
    if (
      is_expanded &&
      event.currentTarget === event.target &&
      event.propertyName === "width"
    ) {
      setShowExpandedContent(true);
    }
  }

  function selectControl(control_id: string, pilot?: DiscoveredPilot): void {
    if (pilot !== undefined && pilot.pilot_id !== getPortalConfig().pilot_id) {
      setPilotPreferredControlId(pilot.pilot_id, control_id);
      const path =
        getRoutePreservingRobotPath(location.pathname, control_id) ??
        location.pathname;
      navigateToPilot(
        pilot.pilot_id,
        `${path}${location.search}${location.hash}`
      );
      return;
    }
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
      onTransitionEnd={revealExpandedContent}
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
          is_expanded={is_expanded && show_expanded_content}
          on_select={selectControl}
        />
      )}
      <button
        aria-expanded={is_expanded}
        aria-label={
          is_expanded ? "Collapse robot controls" : "Expand robot controls"
        }
        className={styles.toggle}
        onClick={toggleDock}
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
  on_select: (control_id: string, pilot?: DiscoveredPilot) => void;
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

  function selectDestinationControl(
    destination_control_id: string,
    pilot?: DiscoveredPilot
  ): void {
    const same_pilot =
      pilot === undefined || pilot.pilot_id === getPortalConfig().pilot_id;
    if (
      (destination_control_id === control_id && same_pilot) ||
      selection_locked
    )
      return;
    runtime.cancelAll();
    if (!same_pilot) runtime.session.stop();
    on_select(destination_control_id, pilot);
  }

  return (
    <>
      {is_expanded ? <RobotDockStatus control_id={control_id} /> : null}
      <RobotDockSelector
        control_id={control_id}
        directory={directory}
        disabled={selection_locked}
        on_select={selectDestinationControl}
      />
      {is_expanded ? (
        <div className={styles.shared_commands}>
          <RobotCommandControls control_id={control_id} />
        </div>
      ) : null}
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
  on_select: (control_id: string, pilot?: DiscoveredPilot) => void;
}) {
  const pilots = usePilotDirectory();
  const config = getPortalConfig();
  const discovered = config.pilot_discovery_enabled === true;
  const selected_key =
    control_id === null
      ? ""
      : getPilotRobotKey(config.pilot_id ?? "", control_id);
  const available = pilots.data?.pilots ?? [];
  const selection_locked = useRobotSelectionLocked();
  const selection_available = available.some(
    (pilot) =>
      pilot.pilot_id === config.pilot_id &&
      pilot.control_ids.includes(control_id ?? "")
  );
  return (
    <label className={styles.selector}>
      <select
        aria-label="Selected robot"
        disabled={disabled || selection_locked}
        title={
          available.find((pilot) => pilot.pilot_id === config.pilot_id)
            ?.endpoint
        }
        onChange={(event) => {
          if (!discovered) {
            on_select(event.target.value);
            return;
          }
          for (const pilot of available) {
            const target = pilot.control_ids.find(
              (id) =>
                getPilotRobotKey(pilot.pilot_id, id) === event.target.value
            );
            if (target !== undefined) {
              on_select(target, pilot);
              return;
            }
          }
        }}
        value={discovered ? selected_key : (control_id ?? "")}
      >
        {control_id === null ? <option value="">Select robot</option> : null}
        {discovered && control_id !== null && !selection_available ? (
          <option value={selected_key}>{control_id} (Pilot unavailable)</option>
        ) : null}
        {discovered
          ? available.map((pilot) => (
              <optgroup key={pilot.pilot_id} label={pilot.endpoint}>
                {pilot.control_ids.map((id) => (
                  <option key={id} value={getPilotRobotKey(pilot.pilot_id, id)}>
                    {pilot.endpoint.replace(/^https?:\/\//, "")} · {id}
                  </option>
                ))}
              </optgroup>
            ))
          : null}
        {!discovered &&
        control_id !== null &&
        !directory?.entries.some((entry) => entry.control_id === control_id) ? (
          <option value={control_id}>{control_id} (unavailable)</option>
        ) : null}
        {!discovered &&
          directory?.entries.map((entry) => (
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
