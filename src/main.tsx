import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PortalRouter } from "./app/router";
import { ThemeProvider } from "./app/theme_provider";
import "./styles/layers.css";

const root_element = document.getElementById("root");
if (root_element === null) {
  throw new Error("Portal root element is missing.");
}

createRoot(root_element).render(
  <StrictMode>
    <ThemeProvider>
      <PortalRouter />
    </ThemeProvider>
  </StrictMode>
);
