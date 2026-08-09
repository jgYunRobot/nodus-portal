import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { DeviceDirectoryEntry } from "../device_directory/device_directory";
import type { DeviceDirectoryEvent } from "../device_directory/device_directory_events";
import {
  OperatorActivationClient,
  OperatorActivationHttpError
} from "./operator_activation_client";
import {
  matchesOperatorActivationRuntime,
  resolveOperatorActivationEndpoints,
  type OperatorActivationEndpoints,
  type OperatorActivationSnapshot
} from "./operator_activation_contract";

const OPERATOR_FALLBACK_REVALIDATION_MS = 5000;

export type OperatorActivationQueryState =
  | "unselected"
  | "discovering"
  | "incompatible"
  | "loading"
  | "ready"
  | "recovering"
  | "offline"
  | "faulted";

export interface OperatorActivationQueryInput {
  control_id: string;
  selected_entry: DeviceDirectoryEntry | null;
  directory_event: DeviceDirectoryEvent | null;
  refresh_directory: () => Promise<void>;
  client?: OperatorActivationClient;
}

export function getOperatorActivationQueryKey(runtime_key: string) {
  return ["operator", "activation", runtime_key] as const;
}

export function selectNewestActivationSnapshot(
  current: OperatorActivationSnapshot | undefined,
  next: OperatorActivationSnapshot
): OperatorActivationSnapshot {
  if (current !== undefined && current.revision > next.revision) return current;
  return next;
}

export function matchesActivationInvalidation(
  event: DeviceDirectoryEvent | null,
  entry: DeviceDirectoryEntry | null
): boolean {
  return (
    event !== null &&
    entry !== null &&
    event.event_type === "component_state_updated" &&
    event.component_id === entry.component_id &&
    event.instance_id === entry.instance_id &&
    event.session_generation === entry.session_generation
  );
}

export function useOperatorActivationQuery({
  control_id,
  selected_entry,
  directory_event,
  refresh_directory,
  client: supplied_client
}: OperatorActivationQueryInput) {
  const query_client = useQueryClient();
  const [default_client] = useState(() => new OperatorActivationClient());
  const client = supplied_client ?? default_client;
  const endpoints = useMemo(
    () =>
      selected_entry === null
        ? null
        : resolveOperatorActivationEndpoints(selected_entry),
    [selected_entry]
  );
  const runtime_key = selected_entry?.runtime_key ?? null;
  const query_key = useMemo(
    () => getOperatorActivationQueryKey(runtime_key ?? "unselected"),
    [runtime_key]
  );
  const is_compatible =
    selected_entry !== null &&
    selected_entry.lifecycle_state === "ready" &&
    endpoints !== null;
  const query = useQuery({
    queryKey: query_key,
    enabled: is_compatible,
    queryFn: async ({ signal }) => {
      if (selected_entry === null || endpoints === null) {
        throw new Error("Operator activation query is not compatible.");
      }
      const next = await client.getActivation(endpoints.read, signal);
      if (!matchesOperatorActivationRuntime(next, selected_entry, control_id)) {
        throw new Error(
          "Operator activation snapshot does not match this runtime."
        );
      }
      const current =
        query_client.getQueryData<OperatorActivationSnapshot>(query_key);
      return selectNewestActivationSnapshot(current, next);
    },
    retry: (failure_count, error) =>
      error instanceof OperatorActivationHttpError &&
      error.retryable_read &&
      failure_count < 2,
    refetchInterval: () =>
      document.visibilityState === "visible"
        ? OPERATOR_FALLBACK_REVALIDATION_MS
        : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (!matchesActivationInvalidation(directory_event, selected_entry)) return;
    void query_client.invalidateQueries({ exact: true, queryKey: query_key });
  }, [directory_event, query_client, query_key, selected_entry]);

  useEffect(() => {
    function revalidateCurrentRuntime(): void {
      if (!is_compatible) return;
      void query_client.invalidateQueries({ exact: true, queryKey: query_key });
    }
    function revalidateVisibleRuntime(): void {
      if (document.visibilityState === "visible") revalidateCurrentRuntime();
    }
    window.addEventListener("online", revalidateCurrentRuntime);
    document.addEventListener("visibilitychange", revalidateVisibleRuntime);
    return () => {
      window.removeEventListener("online", revalidateCurrentRuntime);
      document.removeEventListener(
        "visibilitychange",
        revalidateVisibleRuntime
      );
    };
  }, [is_compatible, query_client, query_key]);

  useEffect(() => {
    if (query.error === null) return;
    void refresh_directory();
  }, [query.error, query.errorUpdatedAt, refresh_directory]);

  const query_state = getOperatorActivationQueryState(
    selected_entry,
    endpoints,
    query.data,
    query.isPending,
    query.isFetching,
    query.error
  );
  return {
    client,
    endpoints,
    query_key,
    query_state,
    snapshot: query.data ?? null,
    data_updated_at: query.dataUpdatedAt,
    can_mutate: query_state === "ready" && !query.isFetching,
    refetch: query.refetch
  };
}

export function getOperatorActivationQueryState(
  selected_entry: DeviceDirectoryEntry | null,
  endpoints: OperatorActivationEndpoints | null,
  snapshot: OperatorActivationSnapshot | undefined,
  is_pending: boolean,
  is_fetching: boolean,
  error: Error | null
): OperatorActivationQueryState {
  if (selected_entry === null) return "unselected";
  if (selected_entry.lifecycle_state !== "ready" || endpoints === null)
    return "incompatible";
  if (is_pending) return "loading";
  if (snapshot !== undefined && snapshot.fault !== null) return "faulted";
  if (snapshot !== undefined && error === null && !is_fetching) return "ready";
  if (snapshot !== undefined || is_fetching) return "recovering";
  if (error instanceof OperatorActivationHttpError && error.retryable_read)
    return "recovering";
  return "offline";
}
