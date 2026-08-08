import { useSyncExternalStore } from "react";
import { useControlStatus } from "../../api/pilot/use_control_status";
import { usePortalOperationRuntime } from "./portal_operation_context";
import type { OperationTarget } from "./pilot_operation_client";
import styles from "./robot_command_controls.module.css";

export function RobotCommandControls({ control_id }: { control_id: string }) {
  const runtime = usePortalOperationRuntime();
  const hold = runtime.getHold(control_id);
  const scheduler = runtime.getScheduler(control_id);
  const status = useControlStatus(control_id);
  const session = useSyncExternalStore(
    (listener) => runtime.session.subscribe(listener),
    () => runtime.session.getSnapshot(),
    () => runtime.session.getSnapshot()
  );
  const operation = useSyncExternalStore(
    (listener) => scheduler.subscribe(listener),
    () => scheduler.getSnapshot(),
    () => scheduler.getSnapshot()
  );
  const robot_interface = status.status?.sample?.robot_state.interface;
  const has_authoritative_status =
    status.state === "live" &&
    status.status?.available === true &&
    status.status.fresh &&
    !status.status.stale &&
    robot_interface !== undefined;
  const command_pending = operation.in_flight || operation.has_pending;
  const controls_disabled =
    session.phase !== "ready" ||
    !has_authoritative_status ||
    hold.active ||
    command_pending;
  const servo_activated = robot_interface?.servo_activated === true;
  const brake_released = robot_interface?.brake_released === true;

  function submitCommand(target: OperationTarget): void {
    runtime.cancel(control_id);
    scheduler.resume();
    scheduler.schedule(target);
  }

  return (
    <>
      <div aria-label="Robot commands" className={styles.commands}>
        <button
          aria-pressed={servo_activated}
          className={servo_activated ? styles.active : styles.command}
          disabled={controls_disabled}
          onClick={() =>
            submitCommand({
              operation: "control.set_servo_state",
              control_id,
              enabled: !servo_activated
            })
          }
          type="button"
        >
          {servo_activated ? "Servo Off" : "Servo On"}
        </button>
        <button
          className={styles.command}
          disabled={controls_disabled}
          onClick={() =>
            submitCommand({ operation: "control.reset_fault", control_id })
          }
          type="button"
        >
          Fault Reset
        </button>
        <button
          aria-pressed={!brake_released}
          className={!brake_released ? styles.active : styles.command}
          disabled={controls_disabled}
          onClick={() =>
            submitCommand({
              operation: "control.set_brake_state",
              control_id,
              released: !brake_released
            })
          }
          type="button"
        >
          {brake_released ? "Engage Brake" : "Release Brake"}
        </button>
      </div>
    </>
  );
}
