import {
  Boxes,
  CircuitBoard,
  House,
  Menu,
  Move3D,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams
} from "react-router";
import { useRobotStatusStreams } from "../api/pilot/pilot_queries";
import { Button } from "../components/actions/button";
import { Drawer } from "../components/layout/drawer";
import { ThemeMenu } from "../components/actions/theme_menu";
import { getPortalConfig } from "../config/portal_config";
import { navigateToPilot } from "../config/pilot_launch";
import {
  choosePilotId,
  withPilotScope
} from "../features/pilot_directory/pilot_directory";
import { usePilotDirectory } from "../features/pilot_directory/use_pilot_directory";
import { createRobotDirectory } from "../features/robot_directory/robot_directory";
import { getEffectiveControlId } from "./robot_route_selection";
import { useRobotDockState } from "./robot_dock_state";
import { RobotDock } from "./robot_dock";
import styles from "./portal_shell.module.css";

export function PortalShell() {
  const portal_label = getPortalConfig().portal_label;
  const [is_collapsed, setIsCollapsed] = useState(false);
  const [is_drawer_open, setIsDrawerOpen] = useState(false);
  const navigation_trigger = useRef<HTMLButtonElement>(null);
  const { control_id: route_control_id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const pilots = usePilotDirectory();
  const config = getPortalConfig();
  useEffect(() => {
    if (
      config.pilot_discovery_enabled &&
      config.pilot_id === null &&
      pilots.data
    ) {
      const pilot_id = choosePilotId(pilots.data, null, null);
      if (pilot_id !== null)
        navigateToPilot(
          pilot_id,
          `${location.pathname}${location.search}${location.hash}`
        );
    }
  }, [
    config.pilot_discovery_enabled,
    config.pilot_id,
    pilots.data,
    location.pathname,
    location.search,
    location.hash
  ]);
  useEffect(() => {
    if (
      config.pilot_id &&
      new URLSearchParams(location.search).get("pilot") !== config.pilot_id
    )
      void navigate(
        withPilotScope(
          `${location.pathname}${location.search}${location.hash}`,
          config.pilot_id
        ),
        { replace: true }
      );
  }, [
    config.pilot_id,
    location.pathname,
    location.search,
    location.hash,
    navigate
  ]);
  const robot_dock = useRobotDockState();
  const streams = useRobotStatusStreams();
  const directory =
    streams.data === undefined ? null : createRobotDirectory(streams.data);
  const has_no_discovered_robots =
    streams.isSuccess && directory?.entries.length === 0;
  const control_id = has_no_discovered_robots
    ? null
    : getEffectiveControlId(route_control_id, robot_dock.preferred_control_id);
  const operation_target = createRobotPageTarget(control_id);

  if (has_no_discovered_robots && route_control_id !== undefined)
    return (
      <Navigate replace to={withPilotScope("/home", config.pilot_id ?? null)} />
    );

  return (
    <div
      className={
        is_collapsed ? `${styles.shell} ${styles.collapsed}` : styles.shell
      }
    >
      <a className={styles.skip_link} href="#portal-workspace">
        Skip to workspace
      </a>
      <aside className={styles.sidebar}>
        <div className={styles.sidebar_top}>
          <div className={styles.brand} title={portal_label}>
            <CircuitBoard aria-hidden="true" className={styles.brand_mark} />
            <div className={styles.brand_text}>
              <strong>{portal_label}</strong>
              <span>Robotics workspace</span>
            </div>
          </div>
          <Navigation
            control_id={control_id}
            operation_target={operation_target}
            on_navigate={() => undefined}
          />
        </div>
        <div className={styles.sidebar_bottom}>
          <p>Robot controls in the dock</p>
          <Button
            aria-label={
              is_collapsed ? "Expand navigation" : "Collapse navigation"
            }
            onClick={() => setIsCollapsed(!is_collapsed)}
            tone="secondary"
          >
            {is_collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
            <span>{is_collapsed ? "Expand" : "Collapse"}</span>
          </Button>
        </div>
      </aside>
      <Drawer
        description="Portal navigation"
        on_close_auto_focus={(event) => {
          event.preventDefault();
          navigation_trigger.current?.focus();
        }}
        on_open_change={setIsDrawerOpen}
        open={is_drawer_open}
        title={portal_label}
      >
        <Navigation
          control_id={control_id}
          operation_target={operation_target}
          on_navigate={() => setIsDrawerOpen(false)}
        />
      </Drawer>
      <header className={styles.header}>
        <Button
          aria-label="Open navigation"
          className={styles.mobile_menu}
          onClick={() => setIsDrawerOpen(true)}
          ref={navigation_trigger}
          tone="secondary"
        >
          <Menu aria-hidden="true" />
          <span>Menu</span>
        </Button>
        <div className={styles.header_context}>
          <p className={styles.context}>
            {location.pathname === "/devices"
              ? "Device directory"
              : route_control_id === undefined
                ? "Fleet overview"
                : `Control ${route_control_id}`}
          </p>
          <p className={styles.connection}>
            {config.pilot_discovery_enabled && config.pilot_id === null
              ? "Select a robot to connect"
              : streams.isError
                ? "Pilot discovery unavailable"
                : streams.isPending
                  ? "Checking Pilot discovery…"
                  : "Pilot directory loaded"}
            {config.pilot_discovery_enabled
              ? ` · ${pilots.data?.pilots.length ?? 0} Pilots`
              : ""}
            {pilots.data?.partial ? " · Partial discovery" : ""}
            {pilots.data?.discovery_error
              ? " · Local discovery unavailable"
              : ""}
          </p>
        </div>
        <ThemeMenu />
      </header>
      <div
        className={styles.content}
        data-testid="portal-main-content"
        id="portal-workspace"
        key={location.pathname}
        tabIndex={-1}
      >
        <Outlet />
      </div>
      <RobotDock />
    </div>
  );
}

function createRobotPageTarget(control_id: string | null): string {
  const path =
    control_id === null
      ? "/home"
      : `/robots/${encodeURIComponent(control_id)}/operation`;
  return withPilotScope(path, getPortalConfig().pilot_id ?? null);
}

function Navigation({
  control_id,
  operation_target,
  on_navigate
}: {
  control_id: string | null;
  operation_target: string;
  on_navigate: () => void;
}) {
  function handleRobotNavigation(event: MouseEvent<HTMLAnchorElement>): void {
    if (control_id === null) {
      event.preventDefault();
      return;
    }
    on_navigate();
  }

  return (
    <nav aria-label="Portal navigation" className={styles.navigation}>
      <p>Workspace</p>
      <NavLink
        end
        onClick={on_navigate}
        title="Home"
        to={withPilotScope("/home", getPortalConfig().pilot_id ?? null)}
      >
        <House aria-hidden="true" />
        <span>Home</span>
      </NavLink>
      <NavLink
        onClick={on_navigate}
        title="Devices"
        to={withPilotScope("/devices", getPortalConfig().pilot_id ?? null)}
      >
        <Boxes aria-hidden="true" />
        <span>Devices</span>
      </NavLink>
      <p>Robot</p>
      <NavLink
        aria-disabled={control_id === null}
        onClick={handleRobotNavigation}
        title={control_id === null ? "Select a robot on Home" : "Operation"}
        to={operation_target}
      >
        <Move3D aria-hidden="true" />
        <span>Operation</span>
      </NavLink>
    </nav>
  );
}
