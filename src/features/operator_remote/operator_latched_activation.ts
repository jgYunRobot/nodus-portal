import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { DeviceDirectoryEntry } from "../device_directory/device_directory";
import {
  OperatorActivationClient,
  OperatorActivationHttpError
} from "./operator_activation_client";
import {
  matchesOperatorActivationRuntime,
  type OperatorActivationEndpoints,
  type OperatorActivationSnapshot
} from "./operator_activation_contract";
import {
  getOperatorActivationQueryKey,
  selectNewestActivationSnapshot,
  type OperatorActivationQueryState
} from "./operator_activation_query";

export function getLatchedDesiredState(
  snapshot: OperatorActivationSnapshot | null
): "running" | "paused" | null {
  if (snapshot?.run_state === "paused" && snapshot.activation_kind === "none")
    return "running";
  if (
    snapshot?.run_state === "running" &&
    snapshot.activation_kind === "latched"
  ) {
    return "paused";
  }
  return null;
}

interface OperatorLatchedActivationInput {
  control_id: string;
  selected_entry: DeviceDirectoryEntry | null;
  endpoints: OperatorActivationEndpoints | null;
  snapshot: OperatorActivationSnapshot | null;
  data_updated_at: number;
  query_state: OperatorActivationQueryState;
  client: OperatorActivationClient;
}

export function useOperatorLatchedActivation({
  control_id,
  selected_entry,
  endpoints,
  snapshot,
  data_updated_at,
  query_state,
  client
}: OperatorLatchedActivationInput) {
  const query_client = useQueryClient();
  const [reconciliation_started_at, setReconciliationStartedAt] = useState<
    number | null
  >(null);
  const requires_reconciliation =
    reconciliation_started_at !== null &&
    !(query_state === "ready" && data_updated_at >= reconciliation_started_at);
  const desired_state = getLatchedDesiredState(snapshot);
  const can_submit =
    selected_entry !== null &&
    endpoints !== null &&
    snapshot !== null &&
    query_state === "ready" &&
    desired_state !== null &&
    !requires_reconciliation;
  const query_key = getOperatorActivationQueryKey(
    selected_entry?.runtime_key ?? "unselected"
  );
  const mutation = useMutation({
    mutationKey: [...query_key, "latched"],
    mutationFn: async ({
      desired_state: next_desired_state,
      observed_generation,
      endpoint
    }: {
      desired_state: "running" | "paused";
      observed_generation: number;
      endpoint: string;
    }) =>
      client.setLatchedActivation(endpoint, {
        desired_state: next_desired_state,
        observed_generation
      }),
    onSuccess: (next_snapshot) => {
      if (
        selected_entry === null ||
        !matchesOperatorActivationRuntime(
          next_snapshot,
          selected_entry,
          control_id
        )
      ) {
        setReconciliationStartedAt(Date.now());
        return;
      }
      query_client.setQueryData<OperatorActivationSnapshot>(
        query_key,
        (current) => selectNewestActivationSnapshot(current, next_snapshot)
      );
      void query_client.invalidateQueries({ exact: true, queryKey: query_key });
    },
    onError: (error) => {
      const conflict_snapshot =
        error instanceof OperatorActivationHttpError
          ? (error.response?.snapshot ?? null)
          : null;
      if (
        conflict_snapshot !== null &&
        selected_entry !== null &&
        matchesOperatorActivationRuntime(
          conflict_snapshot,
          selected_entry,
          control_id
        )
      ) {
        query_client.setQueryData<OperatorActivationSnapshot>(
          query_key,
          (current) =>
            selectNewestActivationSnapshot(current, conflict_snapshot)
        );
      }
      setReconciliationStartedAt(Date.now());
      void query_client.invalidateQueries({ exact: true, queryKey: query_key });
    }
  });

  function requestLatched(): boolean {
    if (
      !can_submit ||
      selected_entry === null ||
      endpoints === null ||
      snapshot === null ||
      desired_state === null ||
      mutation.isPending
    ) {
      return false;
    }
    mutation.mutate({
      desired_state,
      observed_generation: snapshot.generation,
      endpoint: endpoints.latched
    });
    return true;
  }

  return {
    label:
      desired_state === "running"
        ? "Run"
        : desired_state === "paused"
          ? "Pause"
          : "Run / Pause",
    can_submit: can_submit && !mutation.isPending,
    is_pending: mutation.isPending,
    requires_reconciliation,
    request_latched: requestLatched
  };
}
