import { pilot_stream_hub } from "../../api/pilot/use_control_status";
import { HoldSession } from "./hold_session";
import { OperationScheduler } from "./operation_scheduler";
import {
  PilotOperationClient,
  type OperationTarget
} from "./pilot_operation_client";
import { PortalComponentSession } from "./pilot_component_session";

interface ControlRuntime {
  hold: HoldSession;
  scheduler: OperationScheduler<OperationTarget>;
}

export class PortalOperationRuntime {
  readonly session: PortalComponentSession;
  private readonly controls = new Map<string, ControlRuntime>();
  constructor() {
    this.session = new PortalComponentSession({
      on_invalidate: () => this.cancelAll()
    });
  }

  getHold(control_id: string): HoldSession {
    let runtime = this.controls.get(control_id);
    if (runtime === undefined) {
      const client = new PilotOperationClient(this.session);
      const scheduler = new OperationScheduler<OperationTarget>((target) =>
        client.submit(target)
      );
      runtime = {
        scheduler,
        hold: new HoldSession({
          control_id,
          scheduler,
          read_snapshot: () => pilot_stream_hub.getSnapshot(control_id)
        })
      };
      this.controls.set(control_id, runtime);
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
    this.controls.forEach((runtime) => runtime.hold.stop());
  }
}
