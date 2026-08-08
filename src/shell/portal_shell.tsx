import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState, type MouseEvent } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useParams
} from "react-router";
import { useRobotStatusStreams } from "../api/pilot/pilot_queries";
import { Button } from "../components/actions/button";
import { Drawer } from "../components/layout/drawer";
import { ThemeMenu } from "../components/actions/theme_menu";
import { getPortalConfig } from "../config/portal_config";
import { createRobotDirectory } from "../features/robot_directory/robot_directory";
import { getEffectiveControlId } from "./robot_route_selection";
import { useRobotDockState } from "./robot_dock_state";
import { RobotDock } from "./robot_dock";
import styles from "./portal_shell.module.css";

export function PortalShell() {
  const portal_label = getPortalConfig().portal_label;
  const [is_collapsed, setIsCollapsed] = useState(false);
  const [is_drawer_open, setIsDrawerOpen] = useState(false);
  const { control_id: route_control_id } = useParams();
  const location = useLocation();
  const robot_dock = useRobotDockState();
  const streams = useRobotStatusStreams();
  const directory =
    streams.data === undefined ? null : createRobotDirectory(streams.data);
  const has_no_discovered_robots =
    streams.isSuccess && directory?.entries.length === 0;
  const control_id = has_no_discovered_robots
    ? null
    : getEffectiveControlId(route_control_id, robot_dock.preferred_control_id);
  const jogging_target = createRobotPageTarget(control_id, "jogging");
  const operating_target = createRobotPageTarget(control_id, "operating");

  if (has_no_discovered_robots && route_control_id !== undefined)
    return <Navigate replace to="/home" />;

  return (
    <div
      className={
        is_collapsed ? `${styles.shell} ${styles.collapsed}` : styles.shell
      }
    >
      <aside className={styles.sidebar}>
        <Navigation
          control_id={control_id}
          jogging_target={jogging_target}
          operating_target={operating_target}
          on_navigate={() => undefined}
        />
        <Button
          aria-label="Collapse navigation"
          onClick={() => setIsCollapsed(!is_collapsed)}
          tone="secondary"
        >
          {is_collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </aside>
      <Drawer
        description="Portal navigation"
        on_open_change={setIsDrawerOpen}
        open={is_drawer_open}
        title={portal_label}
      >
        <Navigation
          control_id={control_id}
          jogging_target={jogging_target}
          operating_target={operating_target}
          on_navigate={() => setIsDrawerOpen(false)}
        />
      </Drawer>
      <header className={styles.header}>
        <Button
          aria-label="Open navigation"
          className={styles.mobile_menu}
          onClick={() => setIsDrawerOpen(true)}
          tone="secondary"
        >
          <Menu aria-hidden="true" />
          Menu
        </Button>
        <div>
          <p className={styles.connection}>
            Pilot connection will be shown here
          </p>
          <p className={styles.context}>
            {location.pathname === "/devices"
              ? "Device directory"
              : route_control_id === undefined
                ? "Fleet overview"
                : `Control ${route_control_id}`}
          </p>
        </div>
        <ThemeMenu />
      </header>
      <div
        className={styles.content}
        data-testid="portal-main-content"
        key={location.pathname}
      >
        <Outlet />
      </div>
      <RobotDock />
    </div>
  );
}

function createRobotPageTarget(
  control_id: string | null,
  page_kind: "jogging" | "operating"
): string {
  if (control_id === null) return "/home";
  return `/robots/${encodeURIComponent(control_id)}/${page_kind}`;
}

function Navigation({
  control_id,
  jogging_target,
  operating_target,
  on_navigate
}: {
  control_id: string | null;
  jogging_target: string;
  operating_target: string;
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
      <NavLink end onClick={on_navigate} to="/home">
        Home
      </NavLink>
      <NavLink onClick={on_navigate} to="/devices">
        Devices
      </NavLink>
      <p>Robot</p>
      <NavLink
        aria-disabled={control_id === null}
        onClick={handleRobotNavigation}
        to={jogging_target}
      >
        Jogging
      </NavLink>
      <NavLink
        aria-disabled={control_id === null}
        onClick={handleRobotNavigation}
        to={operating_target}
      >
        Operating
      </NavLink>
    </nav>
  );
}
