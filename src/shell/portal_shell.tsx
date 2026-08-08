import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useParams } from "react-router";
import { Button } from "../components/actions/button";
import { Drawer } from "../components/layout/drawer";
import { ThemeMenu } from "../components/actions/theme_menu";
import { getPortalConfig } from "../config/portal_config";
import styles from "./portal_shell.module.css";

export function PortalShell() {
  const portal_label = getPortalConfig().portal_label;
  const [is_collapsed, setIsCollapsed] = useState(false);
  const [is_drawer_open, setIsDrawerOpen] = useState(false);
  const { control_id } = useParams();
  const location = useLocation();
  const jogging_target =
    control_id === undefined ? "/home" : `/robots/${control_id}/jogging`;
  const device_target =
    control_id === undefined ? "/home" : `/robots/${control_id}/device`;
  const operating_target =
    control_id === undefined ? "/home" : `/robots/${control_id}/operating`;

  return (
    <div
      className={
        is_collapsed ? `${styles.shell} ${styles.collapsed}` : styles.shell
      }
    >
      <aside className={styles.sidebar}>
        <Navigation
          control_id={control_id}
          device_target={device_target}
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
          device_target={device_target}
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
            {control_id === undefined
              ? "Fleet overview"
              : `Control ${control_id}`}
          </p>
        </div>
        <ThemeMenu />
      </header>
      <div className={styles.content} key={location.pathname}>
        <Outlet />
      </div>
    </div>
  );
}

function Navigation({
  control_id,
  device_target,
  jogging_target,
  operating_target,
  on_navigate
}: {
  control_id: string | undefined;
  device_target: string;
  jogging_target: string;
  operating_target: string;
  on_navigate: () => void;
}) {
  return (
    <nav aria-label="Portal navigation" className={styles.navigation}>
      <NavLink end onClick={on_navigate} to="/home">
        Home
      </NavLink>
      <p>Robot</p>
      <NavLink
        aria-disabled={control_id === undefined}
        onClick={on_navigate}
        to={device_target}
      >
        Device
      </NavLink>
      <NavLink
        aria-disabled={control_id === undefined}
        onClick={on_navigate}
        to={jogging_target}
      >
        Jogging
      </NavLink>
      <NavLink
        aria-disabled={control_id === undefined}
        onClick={on_navigate}
        to={operating_target}
      >
        Operating
      </NavLink>
    </nav>
  );
}
