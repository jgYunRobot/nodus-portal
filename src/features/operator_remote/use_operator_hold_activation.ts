import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DeviceDirectoryEntry } from "../device_directory/device_directory";
import type { OperatorActivationClient } from "./operator_activation_client";
import {
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
  data_updated_at: number;
  endpoints: OperatorActivationEndpoints | null;
  query_key: readonly string[];
  query_state: OperatorActivationQueryState;
  selected_entry: DeviceDirectoryEntry | null;
  snapshot: OperatorActivationSnapshot | null;
}

export function useOperatorHoldActivation({
  client,
  control_id,
  data_updated_at,
  endpoints,
  query_key,
  query_state,
  selected_entry,
  snapshot
}: OperatorHoldActivationInput) {
  const query_client = useQueryClient();
  const [session_state, setSessionState] = useState<{
    reconciliation_started_at: number | null;
    runtime_key: string | null;
    state: OperatorHoldSessionState;
  }>({ reconciliation_started_at: null, runtime_key: null, state: "idle" });
  const session_ref = useRef<OperatorHoldSession | null>(null);
  const component_id = selected_entry?.component_id ?? null;
  const instance_id = selected_entry?.instance_id ?? null;
  const runtime_key = selected_entry?.runtime_key ?? null;
  const read_endpoint = endpoints?.read ?? null;
  const latched_endpoint = endpoints?.latched ?? null;
  const hold_start_endpoint = endpoints?.hold_start ?? null;
  const hold_heartbeat_endpoint = endpoints?.hold_heartbeat ?? null;
  const hold_stop_endpoint = endpoints?.hold_stop ?? null;
  const session_endpoints = useMemo<OperatorActivationEndpoints | null>(() => {
    if (
      read_endpoint === null ||
      latched_endpoint === null ||
      hold_start_endpoint === null ||
      hold_heartbeat_endpoint === null ||
      hold_stop_endpoint === null
    )
      return null;
    return {
      read: read_endpoint,
      latched: latched_endpoint,
      hold_start: hold_start_endpoint,
      hold_heartbeat: hold_heartbeat_endpoint,
      hold_stop: hold_stop_endpoint
    };
  }, [
    hold_heartbeat_endpoint,
    hold_start_endpoint,
    hold_stop_endpoint,
    latched_endpoint,
    read_endpoint
  ]);
  const state =
    runtime_key === null ||
    session_endpoints === null ||
    session_state.runtime_key !== runtime_key
      ? "idle"
      : session_state.state;
  const can_start =
    runtime_key !== null &&
    session_endpoints !== null &&
    state === "idle" &&
    query_state === "ready" &&
    snapshot?.ready === true &&
    snapshot?.run_state === "paused" &&
    snapshot.activation_kind === "none";

  useEffect(() => {
    if (
      component_id === null ||
      instance_id === null ||
      runtime_key === null ||
      session_endpoints === null
    ) {
      session_ref.current = null;
      return;
    }
    const session = new OperatorHoldSession({
      client,
      endpoints: session_endpoints,
      is_current_snapshot: (next_snapshot) =>
        next_snapshot.component_id === component_id &&
        next_snapshot.instance_id === instance_id &&
        next_snapshot.target_control_id === control_id,
      on_snapshot: (next_snapshot) => {
        query_client.setQueryData<OperatorActivationSnapshot>(
          query_key,
          (current) => selectNewestActivationSnapshot(current, next_snapshot)
        );
      },
      on_change: (next_state) =>
        setSessionState({
          reconciliation_started_at:
            next_state === "recovering" ? Date.now() : null,
          runtime_key,
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
  }, [
    client,
    component_id,
    control_id,
    instance_id,
    query_client,
    query_key,
    runtime_key,
    session_endpoints
  ]);

  useEffect(() => {
    if (session_state.state !== "recovering") return;
    void query_client.invalidateQueries({ exact: true, queryKey: query_key });
  }, [query_client, query_key, session_state]);

  useEffect(() => {
    if (
      state !== "recovering" ||
      session_state.reconciliation_started_at === null ||
      query_state !== "ready" ||
      data_updated_at < session_state.reconciliation_started_at ||
      snapshot?.ready !== true ||
      snapshot.run_state !== "paused" ||
      snapshot.activation_kind !== "none"
    )
      return;
    session_ref.current?.reconcile();
  }, [
    data_updated_at,
    query_state,
    session_state.reconciliation_started_at,
    snapshot,
    state
  ]);

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
