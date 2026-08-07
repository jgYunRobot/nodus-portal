import {
  useEffect,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent
} from "react";
import { useControlStatus } from "../../api/pilot/use_control_status";
import { usePortalOperationRuntime } from "./portal_operation_context";
import type { HoldIntent } from "./hold_session";

interface HoldControlsProps {
  control_id: string;
}

const TASK_AXES = ["X", "Y", "Z", "Rx", "Ry", "Rz"] as const;
const DEFAULT_JOINT_COUNT = 6;

function sameIntent(
  active_intent: Readonly<HoldIntent> | null,
  intent: HoldIntent
): boolean {
  if (active_intent === null || active_intent.kind !== intent.kind)
    return false;
  if (intent.kind === "joint" && active_intent.kind === "joint") {
    return (
      active_intent.joint_index === intent.joint_index &&
      active_intent.direction === intent.direction
    );
  }
  if (intent.kind === "task" && active_intent.kind === "task") {
    return (
      active_intent.frame_name === intent.frame_name &&
      active_intent.axis_index === intent.axis_index &&
      active_intent.direction === intent.direction
    );
  }
  return true;
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
  const status = useControlStatus(control_id);
  const [speed_percent, setSpeedPercent] = useState(25);
  const [selected_frame, setSelectedFrame] = useState("");
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
  const frames = (status.status?.sample?.robot_state.frames ?? [])
    .map((frame) => frame.name)
    .filter((name, index, names) => names.indexOf(name) === index);
  const active_frame = frames.includes(selected_frame)
    ? selected_frame
    : (frames[0] ?? "");
  const joint_count = Math.max(
    DEFAULT_JOINT_COUNT,
    status.status?.sample?.robot_state.real.pos.length ?? 0
  );

  useEffect(() => {
    const stop = () => runtime.cancel(control_id);
    const on_visibility = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("blur", stop);
    window.addEventListener("keyup", stop);
    document.addEventListener("visibilitychange", on_visibility);
    return () => {
      window.removeEventListener("blur", stop);
      window.removeEventListener("keyup", stop);
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
      <label className="hold_speed">
        Speed {speed_percent}%
        <input
          aria-label="Jog speed"
          max="100"
          min="1"
          onChange={(event) => setSpeedPercent(Number(event.target.value))}
          step="1"
          type="range"
          value={speed_percent}
        />
      </label>
      <div className="hold_group">
        <h3>Joint jog</h3>
        <div className="hold_controls">
          {Array.from({ length: joint_count }, (_, joint_index) =>
            ([-1, 1] as const).map((direction) => {
              const intent: HoldIntent = {
                kind: "joint",
                joint_index,
                direction,
                speed_percent
              };
              return (
                <HoldButton
                  active={sameIntent(hold.current_intent, intent)}
                  disabled={disabled}
                  intent={intent}
                  key={`${joint_index}-${direction}`}
                  label={`Joint ${joint_index + 1} ${direction < 0 ? "−" : "+"}`}
                  start={start}
                  stop={stop}
                />
              );
            })
          )}
        </div>
      </div>
      <div className="hold_group">
        <h3>Task jog</h3>
        <label className="hold_frame">
          Frame
          <select
            aria-label="Task jog frame"
            disabled={disabled || frames.length === 0}
            onChange={(event) => setSelectedFrame(event.target.value)}
            value={active_frame}
          >
            {frames.length === 0 ? (
              <option value="">No authoritative task frame</option>
            ) : (
              frames.map((frame) => (
                <option key={frame} value={frame}>
                  {frame}
                </option>
              ))
            )}
          </select>
        </label>
        <div className="hold_controls">
          {TASK_AXES.flatMap((axis, axis_index) =>
            ([-1, 1] as const).map((direction) => {
              const intent: HoldIntent = {
                kind: "task",
                frame_name: active_frame,
                axis_index,
                direction,
                speed_percent
              };
              return (
                <HoldButton
                  active={sameIntent(hold.current_intent, intent)}
                  disabled={disabled || active_frame.length === 0}
                  intent={intent}
                  key={`${axis}-${direction}`}
                  label={`Task ${axis} ${direction < 0 ? "−" : "+"}`}
                  start={start}
                  stop={stop}
                />
              );
            })
          )}
        </div>
      </div>
      <div className="hold_group">
        <h3>Goals</h3>
        <div className="hold_controls">
          {(["home", "ready"] as const).map((kind) => {
            const intent: HoldIntent = { kind, speed_percent };
            return (
              <HoldButton
                active={sameIntent(hold.current_intent, intent)}
                disabled={disabled}
                intent={intent}
                key={kind}
                label={kind === "home" ? "Home" : "Ready"}
                start={start}
                stop={stop}
              />
            );
          })}
        </div>
      </div>
      <p aria-live="polite">
        {operation.presentation === null
          ? `Session: ${session.phase}`
          : `${operation.presentation.state}: ${operation.presentation.message}`}
      </p>
    </section>
  );
}
