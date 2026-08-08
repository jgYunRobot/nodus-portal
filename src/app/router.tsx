import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useParams
} from "react-router";
import { PortalShell } from "../shell/portal_shell";

const HomePage = lazy(() =>
  import("../pages/home_page").then((module) => ({ default: module.HomePage }))
);
const OperationPage = lazy(() =>
  import("../pages/operation_page").then((module) => ({
    default: module.OperationPage
  }))
);
const DevicePage = lazy(() =>
  import("../pages/device_page").then((module) => ({
    default: module.DevicePage
  }))
);
const NotFoundPage = lazy(() =>
  import("../pages/not_found_page").then((module) => ({
    default: module.NotFoundPage
  }))
);

function PageFallback() {
  return <main aria-busy="true">Loading page…</main>;
}

function lazyPage(Page: typeof HomePage) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Page />
    </Suspense>
  );
}

function LegacyRobotOperationRedirect() {
  const { control_id } = useParams();
  const target =
    control_id === undefined
      ? "/home"
      : `/robots/${encodeURIComponent(control_id)}/operation`;
  return <Navigate replace to={target} />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <PortalShell />,
    children: [
      { index: true, element: <Navigate replace to="/home" /> },
      { path: "home", element: lazyPage(HomePage) },
      { path: "devices", element: lazyPage(DevicePage) },
      {
        path: "robots/:control_id/device",
        element: <Navigate replace to="/devices" />
      },
      {
        path: "robots/:control_id/operation",
        element: lazyPage(OperationPage)
      },
      {
        path: "robots/:control_id/jogging",
        element: <LegacyRobotOperationRedirect />
      },
      {
        path: "robots/:control_id/operating",
        element: <LegacyRobotOperationRedirect />
      },
      { path: "*", element: lazyPage(NotFoundPage) }
    ]
  }
]);
export function PortalRouter() {
  return <RouterProvider router={router} />;
}
