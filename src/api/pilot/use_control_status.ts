import { useCallback, useSyncExternalStore } from "react";
import { PilotStreamHub } from "./pilot_stream_hub";

export const pilot_stream_hub = new PilotStreamHub();

export function useControlStatus(control_id: string) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubscribe = pilot_stream_hub.subscribe(control_id, listener);
      pilot_stream_hub.connect(control_id);
      return unsubscribe;
    },
    [control_id]
  );
  const get_snapshot = useCallback(
    () => pilot_stream_hub.getSnapshot(control_id),
    [control_id]
  );
  return useSyncExternalStore(subscribe, get_snapshot, get_snapshot);
}
