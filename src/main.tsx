import { createRoot } from "react-dom/client";
import { startReactPerformanceTrackCleanup } from "./app/react_performance_tracks";
import {
  configurePortalConfig,
  loadPortalConfig
} from "./config/portal_config";
import {
  configurePilotNavigation,
  rememberPilotId,
  resolvePilotLaunch
} from "./config/pilot_launch";
import { withPilotScope } from "./features/pilot_directory/pilot_directory";
import "./styles/layers.css";

if (import.meta.env.DEV) {
  const stop_performance_track_cleanup = startReactPerformanceTrackCleanup();
  import.meta.hot?.dispose(stop_performance_track_cleanup);
}

const root_element = document.getElementById("root");
if (root_element === null) {
  throw new Error("Portal root element is missing.");
}
const root = createRoot(root_element);
let pilot_navigation_pending = false;
configurePilotNavigation((url) => {
  if (pilot_navigation_pending) return;
  pilot_navigation_pending = true;
  window.setTimeout(() => {
    root.unmount();
    window.location.assign(url);
  }, 0);
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) window.location.reload();
});

async function startPortal(): Promise<void> {
  const config = await resolvePilotLaunch(await loadPortalConfig());
  configurePortalConfig(config);
  if (config.pilot_id) {
    rememberPilotId(config.pilot_id);
    window.history.replaceState(
      window.history.state,
      "",
      withPilotScope(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
        config.pilot_id
      )
    );
  }
  // Singleton HTTP clients and streams must be imported after selecting their Pilot.
  const { PortalApp } = await import("./app/portal_app");
  root.render(<PortalApp />);
}

void startPortal().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Portal configuration failed.";
  root.render(
    <main role="alert">
      <h1>Portal configuration unavailable</h1>
      <p>{message}</p>
    </main>
  );
});
