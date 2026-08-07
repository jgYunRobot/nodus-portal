import {
  useEffect,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent
} from "react";
import { usePortalOperationRuntime } from "./portal_operation_context";
import type { HoldIntent } from "./hold_session";

interface HoldControlsProps {
  control_id: string;
}

function HoldButton({
  label,
  intent,
  disabled,
  active,
  start,
  stop
}: {
  label: string;
  intent: HoldIntent;
  disabled: boolean;
  active: boolean;
  start: (intent: HoldIntent, event?: PointerEvent<HTMLButtonElement>) => void;
  stop: () => void;
}) {
  function on_pointer_down(event: PointerEvent<HTMLButtonElement>): void {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    start(intent, event);
  }
  function on_key_down(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    start(intent);
  }
  function on_key_up(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    stop();
  }
  return (
    <button
      aria-pressed={active}
      disabled={disabled}
      onKeyDown={on_key_down}
      onKeyUp={on_key_up}
      onLostPointerCapture={stop}
      onPointerCancel={stop}
      onPointerDown={on_pointer_down}
      onPointerUp={stop}
      type="button"
    >
      {label}
    </button>
  );
}

export function HoldControls({ control_id }: HoldControlsProps) {
  const runtime = usePortalOperationRuntime();
  const hold = runtime.getHold(control_id);
  const session = useSyncExternalStore(
    (listener) => runtime.session.subscribe(listener),
    () => runtime.session.getSnapshot(),
    () => runtime.session.getSnapshot()
  );
  const scheduler = runtime.getScheduler(control_id);
  const operation = useSyncExternalStore(
    (listener) => scheduler.subscribe(listener),
    () => scheduler.getSnapshot(),
    () => scheduler.getSnapshot()
  );
  const disabled = session.phase !== "ready";

  useEffect(() => {
    const stop = () => runtime.cancel(control_id);
    const on_visibility = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", on_visibility);
    return () => {
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", on_visibility);
      stop();
    };
  }, [control_id, runtime]);

  function start(intent: HoldIntent): void {
    if (!disabled) hold.start(intent);
  }

  function stop(): void {
    runtime.cancel(control_id);
  }

  return (
    <section aria-label="Continuous jogging controls">
      <h2>Continuous controls</h2>
      <p>
        Hold a control to continue submitting status-reconciled targets. Release
        ends local target generation.
      </p>
      <div className="hold_controls">
        <HoldButton
          active={hold.active}
          disabled={disabled}
          intent={{
            kind: "joint",
            joint_index: 0,
            direction: -1,
            speed_percent: 25
          }}
          label="Joint 1 −"
          start={start}
          stop={stop}
        />
        <HoldButton
          active={hold.active}
          disabled={disabled}
          intent={{
            kind: "joint",
            joint_index: 0,
            direction: 1,
            speed_percent: 25
          }}
          label="Joint 1 +"
          start={start}
          stop={stop}
        />
        <HoldButton
          active={hold.active}
          disabled={disabled}
          intent={{
            kind: "task",
            frame_name: "Base",
            axis_index: 0,
            direction: -1,
            speed_percent: 25
          }}
          label="Task X −"
          start={start}
          stop={stop}
        />
        <HoldButton
          active={hold.active}
          disabled={disabled}
          intent={{
            kind: "task",
            frame_name: "Base",
            axis_index: 0,
            direction: 1,
            speed_percent: 25
          }}
          label="Task X +"
          start={start}
          stop={stop}
        />
        <HoldButton
          active={hold.active}
          disabled={disabled}
          intent={{ kind: "home", speed_percent: 25 }}
          label="Home"
          start={start}
          stop={stop}
        />
        <HoldButton
          active={hold.active}
          disabled={disabled}
          intent={{ kind: "ready", speed_percent: 25 }}
          label="Ready"
          start={start}
          stop={stop}
        />
      </div>
      <p aria-live="polite">
        {operation.presentation === null
          ? `Session: ${session.phase}`
          : `${operation.presentation.state}: ${operation.presentation.message}`}
      </p>
    </section>
  );
}
