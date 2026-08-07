import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/app";

const root_element = document.getElementById("root");
if (root_element === null) {
  throw new Error("Portal root element is missing.");
}

createRoot(root_element).render(
  <StrictMode>
    <App />
  </StrictMode>
);
