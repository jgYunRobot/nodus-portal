import { Hand } from "lucide-react";
import type { PointerEvent } from "react";
import { Button } from "../../components/actions/button";
import { Card } from "../../components/feedback/card";
import type { DeviceDirectoryEntry } from "../device_directory/device_directory";
import {
  createOperatorRemoteViewModel,
  getOperatorAvailabilityMessage,
  getOperatorLifecycleLabel,
  getOperatorOptionLabel
} from "./operator_remote_model";
import { useOperatorActivationQuery } from "./operator_activation_query";
import { useOperatorLatchedActivation } from "./operator_latched_activation";
import { useOperatorHoldActivation } from "./use_operator_hold_activation";
import type { DeviceDirectoryEvent } from "../device_directory/device_directory_events";
import styles from "./operator_remote_panel.module.css";

export type OperatorRemoteDirectoryState = "loading" | "error" | "ready";

interface OperatorRemotePanelProps {
  candidates: DeviceDirectoryEntry[];
  control_id: string;
  directory_event: DeviceDirectoryEvent | null;
  directory_state: OperatorRemoteDirectoryState;
  on_select_operator: (component_id: string) => void;
  refresh_directory: () => Promise<void>;
  selected_component_id: string | null;
}

export function OperatorRemotePanel({
  candidates,
  control_id,
  directory_event,
  directory_state,
  on_select_operator,
  refresh_directory,
  selected_component_id
}: OperatorRemotePanelProps) {
  const view_model = createOperatorRemoteViewModel(
    candidates,
    selected_component_id
  );
  const activation = useOperatorActivationQuery({
    control_id,
    directory_event,
    refresh_directory,
    selected_entry: view_model.selected_operator
  });
  const latched = useOperatorLatchedActivation({
    client: activation.client,
    control_id,
    data_updated_at: activation.data_updated_at,
    endpoints: activation.endpoints,
    query_state: activation.query_state,
    selected_entry: view_model.selected_operator,
    snapshot: activation.snapshot
  });
  const hold = useOperatorHoldActivation({
    client: activation.client,
    control_id,
    endpoints: activation.endpoints,
    query_key: activation.query_key,
    query_state: activation.query_state,
    selected_entry: view_model.selected_operator,
    snapshot: activation.snapshot
  });
  const selector_disabled =
    directory_state !== "ready" || candidates.length === 0;
  const selector_placeholder = getSelectorPlaceholder(
    directory_state,
    candidates.length
  );
  const status_message = getStatusMessage(
    directory_state,
    view_model,
    activation.query_state,
    activation.snapshot,
    latched.requires_reconciliation,
    hold.state
  );

  function on_hold_pointer_down(event: PointerEvent<HTMLButtonElement>): void {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    hold.start();
  }

  return (
    <Card aria-label="Device Remote" className={styles.panel}>
      <div className={styles.heading}>
        <h2>Device Remote</h2>
      </div>
      <div className={styles.activation_controls}>
        <Button
          aria-label="Run / Pause"
          disabled={!latched.can_submit || hold.is_active}
          onClick={() => latched.request_latched()}
        >
          {latched.label}
        </Button>
        <Button
          aria-label="Hold to Run"
          disabled={!hold.can_start && !hold.is_active}
          onKeyDown={(event) => {
            if (event.repeat || (event.key !== "Enter" && event.key !== " "))
              return;
            event.preventDefault();
            hold.start();
          }}
          onKeyUp={(event) => {
            if (event.key === "Enter" || event.key === " ") hold.release();
          }}
          onLostPointerCapture={() => hold.release()}
          onPointerCancel={() => hold.release()}
          onPointerDown={on_hold_pointer_down}
          onPointerUp={() => hold.release()}
        >
          <Hand aria-hidden="true" size={16} />
          Hold to Run
        </Button>
      </div>
      <label className={styles.selector_label}>
        Operator
        <select
          aria-label="Operator"
          disabled={selector_disabled}
          onChange={(event) => on_select_operator(event.target.value)}
          value={view_model.selected_operator?.component_id ?? ""}
        >
          {selector_placeholder !== null && (
            <option value="">{selector_placeholder}</option>
          )}
          {candidates.map((candidate) => (
            <option key={candidate.component_id} value={candidate.component_id}>
              {getOperatorOptionLabel(candidate, candidates)}
            </option>
          ))}
        </select>
      </label>
      <p aria-live="polite" className={styles.status_line}>
        {status_message}
      </p>
      {view_model.selected_operator !== null && (
        <dl className={styles.details}>
          <div>
            <dt>Component ID</dt>
            <dd>{view_model.selected_operator.component_id}</dd>
          </div>
          <div>
            <dt>Lifecycle</dt>
            <dd>
              {getOperatorLifecycleLabel(
                view_model.selected_operator.lifecycle_state
              )}
            </dd>
          </div>
          <div>
            <dt>Instance</dt>
            <dd>{view_model.selected_operator.instance_id}</dd>
          </div>
          <div>
            <dt>Session generation</dt>
            <dd>{view_model.selected_operator.session_generation}</dd>
          </div>
          <div>
            <dt>Capabilities</dt>
            <dd>
              {view_model.selected_operator.capabilities.join(", ") ||
                "None advertised"}
            </dd>
          </div>
        </dl>
      )}
    </Card>
  );
}

function getSelectorPlaceholder(
  directory_state: OperatorRemoteDirectoryState,
  candidate_count: number
): string | null {
  if (directory_state === "loading") return "Discovering Operators";
  if (directory_state === "error") return "Operator discovery unavailable";
  if (candidate_count === 0) return "No Operator connected";
  return "Select an Operator";
}

function getStatusMessage(
  directory_state: OperatorRemoteDirectoryState,
  view_model: ReturnType<typeof createOperatorRemoteViewModel>,
  query_state: ReturnType<typeof useOperatorActivationQuery>["query_state"],
  snapshot: ReturnType<typeof useOperatorActivationQuery>["snapshot"],
  requires_reconciliation: boolean,
  hold_state: ReturnType<typeof useOperatorHoldActivation>["state"]
): string {
  if (directory_state === "loading") return "Discovering Operators";
  if (directory_state === "error") return "Operator discovery is unavailable.";
  if (view_model.availability !== "activation_contract_unavailable")
    return getOperatorAvailabilityMessage(
      view_model.availability,
      view_model.selected_operator
    );
  if (requires_reconciliation || hold_state === "recovering")
    return "Reconciliation required before another activation request.";
  if (hold_state === "starting") return "Starting Operator hold-to-run.";
  if (hold_state === "holding") return "Operator is running while held.";
  if (hold_state === "stopping") return "Stopping Operator hold-to-run.";
  if (query_state === "loading") return "Reading Operator activation state.";
  if (query_state === "recovering")
    return "Recovering Operator activation state.";
  if (query_state === "offline") return "Operator activation is unavailable.";
  if (query_state === "faulted")
    return snapshot?.fault?.message ?? "Operator reported an activation fault.";
  if (query_state !== "ready" || snapshot === null)
    return "Operator activation contract is unavailable.";
  if (
    snapshot.run_state === "running" &&
    snapshot.activation_kind === "latched"
  )
    return "Operator is running (latched).";
  if (snapshot.activation_kind === "remote_hold")
    return "Operator is running under another remote hold.";
  return "Operator is paused and ready for activation.";
}
