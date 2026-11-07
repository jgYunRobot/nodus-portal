import { pilot_stream_hub } from "../../api/pilot/use_control_status";
import { HoldSession } from "./hold_session";
import { OperationScheduler } from "./operation_scheduler";
import {
  PilotOperationClient,
  type OperationTarget
} from "./pilot_operation_client";
import { PortalComponentSession } from "./pilot_component_session";
import { adaptMotionRobotStatus } from "./robot_status_adapter";

interface ControlRuntime {
  hold: HoldSession;
  scheduler: OperationScheduler<OperationTarget>;
}

export class PortalOperationRuntime {
  readonly session: PortalComponentSession;
  private readonly controls = new Map<string, ControlRuntime>();
  private readonly selection_listeners = new Set<() => void>();
  private api_request: { cancel: () => void } | null = null;
  constructor() {
    this.session = new PortalComponentSession({
      on_invalidate: () => this.cancelAll()
    });
  }

  getHold(control_id: string): HoldSession {
    let runtime = this.controls.get(control_id);
    if (runtime === undefined) {
      const client = new PilotOperationClient(this.session);
      const scheduler = new OperationScheduler<OperationTarget>((target) => {
        if (
          (target.operation === "control.move_joint_online" ||
            target.operation === "control.move_task_online") &&
          adaptMotionRobotStatus(pilot_stream_hub.getSnapshot(control_id)) ===
            null
        ) {
          this.cancel(control_id);
          return Promise.resolve({
            state: "unavailable",
            message: "Jogging requires fresh RobotStatus with Servo On.",
            terminal: true
          } as const);
        }
        return client.submit(target);
      });
      runtime = {
        scheduler,
        hold: new HoldSession({
          control_id,
          scheduler,
          read_snapshot: () => pilot_stream_hub.getSnapshot(control_id)
        })
      };
      this.controls.set(control_id, runtime);
      scheduler.subscribe(() => this.publishSelection());
    }
    if (runtime === undefined)
      throw new Error("Control runtime could not be created.");
    return runtime.hold;
  }

  getScheduler(control_id: string): OperationScheduler<OperationTarget> {
    this.getHold(control_id);
    return this.controls.get(control_id)!.scheduler;
  }

  cancel(control_id: string): void {
    this.controls.get(control_id)?.hold.stop();
  }

  cancelAll(): void {
    this.api_request?.cancel();
    this.controls.forEach((runtime) => runtime.hold.stop());
  }

  isSelectionLocked(): boolean {
    if (this.api_request !== null) return true;
    return [...this.controls.values()].some(({ hold, scheduler }) => {
      const operation = scheduler.getSnapshot();
      return hold.active || operation.in_flight || operation.has_pending;
    });
  }

  // The API explorer shares command exclusion without creating another operation queue.
  beginApiRequest(cancel: () => void): (() => void) | null {
    if (this.isSelectionLocked()) return null;
    const request = { cancel };
    this.api_request = request;
    this.publishSelection();
    return () => {
      if (this.api_request !== request) return;
      this.api_request = null;
      this.publishSelection();
    };
  }

  private publishSelection(): void {
    for (const listener of [...this.selection_listeners]) listener();
  }

  subscribeSelection(listener: () => void): () => void {
    this.selection_listeners.add(listener);
    return () => {
      this.selection_listeners.delete(listener);
    };
  }
}
