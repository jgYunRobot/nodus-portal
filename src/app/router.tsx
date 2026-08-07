import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { HomePage } from "../pages/home_page";
import { JoggingPage } from "../pages/jogging_page";
import { NotFoundPage } from "../pages/not_found_page";
import { PortalShell } from "../shell/portal_shell";

const router = createBrowserRouter([
  {
    path: "/",
    element: <PortalShell />,
    children: [
      { index: true, element: <Navigate replace to="/home" /> },
      { path: "home", element: <HomePage /> },
      { path: "robots/:control_id/jogging", element: <JoggingPage /> },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);
export function PortalRouter() {
  return <RouterProvider router={router} />;
}
