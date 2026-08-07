import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";
import { PortalOperationRuntime } from "./portal_operation_runtime";

const PortalOperationContext = createContext<PortalOperationRuntime | null>(
  null
);

export function PortalOperationProvider({ children }: { children: ReactNode }) {
  const [runtime] = useState(() => new PortalOperationRuntime());
  useEffect(() => {
    runtime.session.start();
    const on_visibility = () =>
      runtime.session.notifyVisibilityChange(document.hidden);
    const on_online = () => runtime.session.reconnect();
    document.addEventListener("visibilitychange", on_visibility);
    window.addEventListener("online", on_online);
    return () => {
      document.removeEventListener("visibilitychange", on_visibility);
      window.removeEventListener("online", on_online);
      runtime.cancelAll();
      runtime.session.stop();
    };
  }, [runtime]);
  return (
    <PortalOperationContext.Provider value={runtime}>
      {children}
    </PortalOperationContext.Provider>
  );
}

export function usePortalOperationRuntime(): PortalOperationRuntime {
  const runtime = useContext(PortalOperationContext);
  if (runtime === null)
    throw new Error("Portal operation runtime is unavailable.");
  return runtime;
}
