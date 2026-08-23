import type { components } from "../../api/pilot/generated/pilot_v1";
import { PilotHttpClient } from "../../api/pilot/pilot_http_client";
import { isErrorResponse } from "../../api/pilot/pilot_runtime_guards";
import {
  PortalComponentSession,
  type OperationContext
} from "./pilot_component_session";

export type OperationTarget =
  | {
      operation: "control.move_joint_online";
      control_id: string;
      target_position: readonly number[];
    }
  | {
      operation: "control.move_task_online";
      control_id: string;
      target_position: readonly number[];
      target_id: number;
      reference_id: number;
    }
  | {
      operation: "control.set_servo_state";
      control_id: string;
      enabled: boolean;
    }
  | {
      operation: "control.reset_fault";
      control_id: string;
    }
  | {
      operation: "control.set_brake_state";
      control_id: string;
      released: boolean;
    };

export interface OperationPresentation {
  state:
    "accepted" | "written_unconfirmed" | "rejected" | "unavailable" | "failed";
  message: string;
  terminal: boolean;
}

const OPERATION_TTL_MS = 250;

export class PilotOperationClient {
  private readonly client: PilotHttpClient;
  private readonly session: PortalComponentSession;
  constructor(session: PortalComponentSession, client = new PilotHttpClient()) {
    this.session = session;
    this.client = client;
  }

  async submit(target: OperationTarget): Promise<OperationPresentation> {
    const context = this.session.reserveOperation();
    if (context === null) {
      return {
        state: "unavailable",
        message: "Pilot component session is not ready.",
        terminal: true
      };
    }
    try {
      const response = await this.client.submitOperation(
        createOperationRequest(context, target)
      );
      if (isErrorResponse(response.body)) {
        if (typeof response.body.snapshot.server_instance_id === "string") {
          this.session.observeServerInstance(
            response.body.snapshot.server_instance_id
          );
        }
        this.invalidateSessionForError(response.body.error.code);
        return {
          state: response.status === 503 ? "unavailable" : "rejected",
          message: response.body.error.message,
          terminal: true
        };
      }
      return presentOperationResult(response.status, response.body);
    } catch (error: unknown) {
      return {
        state: "failed",
        message:
          error instanceof Error ? error.message : "Pilot operation failed.",
        terminal: true
      };
    }
  }

  private invalidateSessionForError(code: string): void {
    if (
      code === "unknown_session" ||
      code === "session_replaced" ||
      code === "lease_expired"
    ) {
      this.session.invalidate(`Pilot session ${code}; recovery is required.`);
    }
  }
}

function createOperationRequest(
  context: OperationContext,
  target: OperationTarget
): components["schemas"]["OperationRequest"] {
  const common = {
    schema_version: 1 as const,
    request_id: context.request_id,
    session_id: context.session_id,
    generation: context.generation,
    sequence: context.sequence,
    source_timestamp_ns: context.source_timestamp_ns,
    ttl_ms: OPERATION_TTL_MS,
    control_id: target.control_id
  };
  if (target.operation === "control.move_joint_online") {
    return {
      ...common,
      operation: target.operation,
      payload: { target_position: [...target.target_position] }
    };
  }
  if (target.operation === "control.move_task_online") {
    return {
      ...common,
      operation: target.operation,
      payload: {
        target_position: [...target.target_position],
        target_id: target.target_id,
        reference_id: target.reference_id
      }
    };
  }
  if (target.operation === "control.set_servo_state") {
    return {
      ...common,
      operation: target.operation,
      payload: { enabled: target.enabled }
    };
  }
  if (target.operation === "control.set_brake_state") {
    return {
      ...common,
      operation: target.operation,
      payload: { released: target.released }
    };
  }
  return { ...common, operation: target.operation, payload: {} };
}

function presentOperationResult(
  http_status: number,
  result: components["schemas"]["OperationResult"]
): OperationPresentation {
  if (
    http_status === 202 ||
    result.delivery?.outcome === "written_unconfirmed"
  ) {
    return {
      state: "written_unconfirmed",
      message: "Control frame was written without execution acknowledgement.",
      terminal: false
    };
  }
  if (
    result.pilot_disposition === "rejected" ||
    result.control_outcome.status === "rejected"
  ) {
    return {
      state: "rejected",
      message:
        result.error?.message ??
        result.control_outcome.message ??
        "Operation was rejected.",
      terminal: true
    };
  }
  if (http_status === 503 || result.pilot_disposition === "unknown") {
    return {
      state: "unavailable",
      message:
        result.error?.message ?? "Pilot operation availability is unknown.",
      terminal: true
    };
  }
  return {
    state: "accepted",
    message: result.control_outcome.message ?? "Pilot forwarded the operation.",
    terminal: false
  };
}
