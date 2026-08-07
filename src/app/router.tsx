import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { PortalShell } from "../shell/portal_shell";

const HomePage = lazy(() =>
  import("../pages/home_page").then((module) => ({ default: module.HomePage }))
);
const JoggingPage = lazy(() =>
  import("../pages/jogging_page").then((module) => ({
    default: module.JoggingPage
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

const router = createBrowserRouter([
  {
    path: "/",
    element: <PortalShell />,
    children: [
      { index: true, element: <Navigate replace to="/home" /> },
      { path: "home", element: lazyPage(HomePage) },
      { path: "robots/:control_id/jogging", element: lazyPage(JoggingPage) },
      { path: "*", element: lazyPage(NotFoundPage) }
    ]
  }
]);
export function PortalRouter() {
  return <RouterProvider router={router} />;
}
