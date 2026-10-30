import { StrictMode } from "react";
import { PortalRouter } from "./router";
import { PortalProviders } from "./providers";
import { ThemeProvider } from "./theme_provider";

export function PortalApp() {
  return (
    <StrictMode>
      <ThemeProvider>
        <PortalProviders>
          <PortalRouter />
        </PortalProviders>
      </ThemeProvider>
    </StrictMode>
  );
}
