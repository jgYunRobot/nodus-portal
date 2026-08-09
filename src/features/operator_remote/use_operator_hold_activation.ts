import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DeviceDirectoryEntry } from "../device_directory/device_directory";
import type { OperatorActivationClient } from "./operator_activation_client";
import {
  matchesOperatorActivationRuntime,
  type OperatorActivationEndpoints,
  type OperatorActivationSnapshot
} from "./operator_activation_contract";
import {
  selectNewestActivationSnapshot,
  type OperatorActivationQueryState
} from "./operator_activation_query";
import {
  OperatorHoldSession,
  type OperatorHoldSessionState
} from "./operator_hold_session";

interface OperatorHoldActivationInput {
  client: OperatorActivationClient;
  control_id: string;
  endpoints: OperatorActivationEndpoints | null;
  query_key: readonly string[];
  query_state: OperatorActivationQueryState;
  selected_entry: DeviceDirectoryEntry | null;
  snapshot: OperatorActivationSnapshot | null;
}

export function useOperatorHoldActivation({
  client,
  control_id,
  endpoints,
  query_key,
  query_state,
  selected_entry,
  snapshot
}: OperatorHoldActivationInput) {
  const query_client = useQueryClient();
  const [session_state, setSessionState] = useState<{
    runtime_key: string | null;
    state: OperatorHoldSessionState;
  }>({ runtime_key: null, state: "idle" });
  const session_ref = useRef<OperatorHoldSession | null>(null);
  const can_start =
    selected_entry !== null &&
    endpoints !== null &&
    query_state === "ready" &&
    snapshot?.run_state === "paused" &&
    snapshot.activation_kind === "none";

  useEffect(() => {
    if (selected_entry === null || endpoints === null) {
      session_ref.current = null;
      return;
    }
    const session = new OperatorHoldSession({
      client,
      endpoints,
      is_current_snapshot: (next_snapshot) =>
        matchesOperatorActivationRuntime(
          next_snapshot,
          selected_entry,
          control_id
        ),
      on_snapshot: (next_snapshot) => {
        query_client.setQueryData<OperatorActivationSnapshot>(
          query_key,
          (current) => selectNewestActivationSnapshot(current, next_snapshot)
        );
      },
      on_change: (next_state) =>
        setSessionState({
          runtime_key: selected_entry.runtime_key,
          state: next_state
        })
    });
    session_ref.current = session;
    const release = () => session.release();
    const release_when_hidden = () => {
      if (document.hidden) release();
    };
    window.addEventListener("blur", release);
    window.addEventListener("offline", release);
    document.addEventListener("visibilitychange", release_when_hidden);
    return () => {
      window.removeEventListener("blur", release);
      window.removeEventListener("offline", release);
      document.removeEventListener("visibilitychange", release_when_hidden);
      session.dispose();
      if (session_ref.current === session) session_ref.current = null;
    };
  }, [client, control_id, endpoints, query_client, query_key, selected_entry]);

  useEffect(() => {
    if (session_state.state !== "recovering") return;
    void query_client.invalidateQueries({ exact: true, queryKey: query_key });
  }, [query_client, query_key, session_state]);

  const state =
    selected_entry === null ||
    endpoints === null ||
    session_state.runtime_key !== selected_entry.runtime_key
      ? "idle"
      : session_state.state;

  function start(): boolean {
    if (!can_start) return false;
    return session_ref.current?.start() ?? false;
  }

  function release(): void {
    session_ref.current?.release();
  }

  return {
    can_start,
    is_active:
      state === "starting" || state === "holding" || state === "stopping",
    release,
    start,
    state
  };
}
