import { useSyncExternalStore } from "react";
import { PilotStreamHub } from "./pilot_stream_hub";

export const pilot_stream_hub = new PilotStreamHub();

export function useControlStatus(control_id: string) {
  return useSyncExternalStore(
    (listener) => {
      pilot_stream_hub.connect(control_id);
      return pilot_stream_hub.subscribe(control_id, listener);
    },
    () => pilot_stream_hub.getSnapshot(control_id),
    () => pilot_stream_hub.getSnapshot(control_id)
  );
}
