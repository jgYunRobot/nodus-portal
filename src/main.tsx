import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PortalRouter } from "./app/router";
import { PortalProviders } from "./app/providers";
import { ThemeProvider } from "./app/theme_provider";
import {
  configurePortalConfig,
  loadPortalConfig
} from "./config/portal_config";
import "./styles/layers.css";

const root_element = document.getElementById("root");
if (root_element === null) {
  throw new Error("Portal root element is missing.");
}
const root = createRoot(root_element);

async function startPortal(): Promise<void> {
  configurePortalConfig(await loadPortalConfig());
  root.render(
    <StrictMode>
      <ThemeProvider>
        <PortalProviders>
          <PortalRouter />
        </PortalProviders>
      </ThemeProvider>
    </StrictMode>
  );
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
