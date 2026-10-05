import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";
import { pilot_query_keys } from "../../api/pilot/pilot_query_keys";
import { pilot_stream_hub } from "../../api/pilot/use_control_status";
import { PortalOperationRuntime } from "./portal_operation_runtime";

const PortalOperationContext = createContext<PortalOperationRuntime | null>(
  null
);

export function PortalOperationProvider({ children }: { children: ReactNode }) {
  const [runtime] = useState(() => new PortalOperationRuntime());
  const query_client = useQueryClient();
  useEffect(() => {
    const unsubscribe_recovery = pilot_stream_hub.subscribeRecovery(
      (control_id) => runtime.cancel(control_id)
    );
    const unsubscribe = runtime.session.subscribe(() => {
      const snapshot = runtime.session.getSnapshot();
      if (snapshot.phase !== "ready" || snapshot.server_instance_id === null)
        return;
      pilot_stream_hub.observeServerInstance(snapshot.server_instance_id);
      void query_client.invalidateQueries({ queryKey: pilot_query_keys.all });
    });
    runtime.session.start();
    const on_visibility = () =>
      runtime.session.notifyVisibilityChange(document.hidden);
    const on_online = () => runtime.session.reconnect();
    document.addEventListener("visibilitychange", on_visibility);
    window.addEventListener("online", on_online);
    return () => {
      unsubscribe();
      unsubscribe_recovery();
      document.removeEventListener("visibilitychange", on_visibility);
      window.removeEventListener("online", on_online);
      runtime.cancelAll();
      runtime.session.stop();
    };
  }, [query_client, runtime]);
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
