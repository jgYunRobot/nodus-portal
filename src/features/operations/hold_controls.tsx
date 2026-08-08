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
import styles from "./hold_controls.module.css";

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
  display_label = label,
  intent,
  disabled,
  active,
  start,
  stop
}: {
  label: string;
  display_label?: string;
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
      aria-label={label}
      aria-pressed={active}
      className={active ? styles.hold_button_active : styles.hold_button}
      disabled={disabled}
      onKeyDown={on_key_down}
      onKeyUp={on_key_up}
      onLostPointerCapture={stop}
      onPointerCancel={stop}
      onPointerDown={on_pointer_down}
      onPointerUp={stop}
      type="button"
    >
      {display_label}
    </button>
  );
}

export function HoldControls({ control_id }: HoldControlsProps) {
  const runtime = usePortalOperationRuntime();
  const hold = runtime.getHold(control_id);
  const status = useControlStatus(control_id);
  const [mode, setMode] = useState<"joint" | "task">("joint");
  const [speed_percent, setSpeedPercent] = useState(25);
  const [selected_frame, setSelectedFrame] = useState("");
  const session = useSyncExternalStore(
    (listener) => runtime.session.subscribe(listener),
    () => runtime.session.getSnapshot(),
    () => runtime.session.getSnapshot()
  );
  const robot_state = status.status?.sample?.robot_state;
  const task_frames = (robot_state?.frames ?? [])
    .filter((frame) => frame.parent_link_id > 0)
    .filter(
      (frame, index, all_frames) =>
        all_frames.findIndex((item) => item.name === frame.name) === index
    );
  const active_frame = task_frames.some(
    (frame) => frame.name === selected_frame
  )
    ? selected_frame
    : (task_frames[0]?.name ?? "");
  const joint_count = Math.max(
    DEFAULT_JOINT_COUNT,
    robot_state?.real.pos.length ?? 0
  );
  const has_authoritative_status =
    status.state === "live" &&
    status.status?.available === true &&
    status.status.fresh &&
    !status.status.stale &&
    robot_state !== undefined;
  const controls_disabled =
    session.phase !== "ready" || !has_authoritative_status;
  const hold_active = hold.active;
  const interaction_locked = controls_disabled || hold_active;
  const unavailable_reason =
    session.phase !== "ready"
      ? (session.last_error ?? "Pilot component session is not ready.")
      : "A fresh authoritative RobotStatus is required before a hold can begin.";

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
    if (!controls_disabled && !hold.active) hold.start(intent);
  }

  function stop(): void {
    runtime.cancel(control_id);
  }

  function selectMode(next_mode: "joint" | "task"): void {
    stop();
    setMode(next_mode);
  }

  function changeSpeed(next_speed: number): void {
    stop();
    setSpeedPercent(next_speed);
  }

  function changeFrame(next_frame: string): void {
    stop();
    setSelectedFrame(next_frame);
  }

  return (
    <section
      aria-label="Continuous jogging controls"
      className={styles.controls}
    >
      <h2 className={styles.heading}>Jog</h2>

      <div className={styles.speed_control}>
        <label htmlFor={`jog-speed-${control_id}`}>Speed</label>
        <input
          aria-label="Jog speed"
          disabled={interaction_locked}
          id={`jog-speed-${control_id}`}
          max="100"
          min="1"
          onChange={(event) => changeSpeed(Number(event.target.value))}
          step="1"
          type="range"
          value={speed_percent}
        />
        <output htmlFor={`jog-speed-${control_id}`}>{speed_percent}%</output>
      </div>

      <div aria-label="Jog mode" className={styles.tabs} role="tablist">
        <button
          aria-selected={mode === "joint"}
          className={mode === "joint" ? styles.tab_selected : styles.tab}
          disabled={interaction_locked}
          onClick={() => selectMode("joint")}
          role="tab"
          type="button"
        >
          Joint
        </button>
        <button
          aria-selected={mode === "task"}
          className={mode === "task" ? styles.tab_selected : styles.tab}
          disabled={interaction_locked}
          onClick={() => selectMode("task")}
          role="tab"
          type="button"
        >
          Task
        </button>
      </div>

      {mode === "joint" ? (
        <div className={styles.mode_content} role="tabpanel">
          <div className={styles.goal_bar}>
            <div className={styles.goal_buttons}>
              {(["home", "ready"] as const).map((kind) => {
                const intent: HoldIntent = { kind, speed_percent };
                const active = sameIntent(hold.current_intent, intent);
                return (
                  <HoldButton
                    active={active}
                    disabled={controls_disabled || (hold_active && !active)}
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
          <div className={styles.joint_list}>
            {Array.from({ length: joint_count }, (_, joint_index) => {
              const negative_intent: HoldIntent = {
                kind: "joint",
                joint_index,
                direction: -1,
                speed_percent
              };
              const positive_intent: HoldIntent = {
                ...negative_intent,
                direction: 1
              };
              const negative_active = sameIntent(
                hold.current_intent,
                negative_intent
              );
              const positive_active = sameIntent(
                hold.current_intent,
                positive_intent
              );
              return (
                <article className={styles.joint_row} key={joint_index}>
                  <div className={styles.identity}>
                    <strong>Joint {joint_index + 1}</strong>
                  </div>
                  <div className={styles.jog_buttons}>
                    <HoldButton
                      active={negative_active}
                      disabled={
                        controls_disabled || (hold_active && !negative_active)
                      }
                      display_label="−"
                      intent={negative_intent}
                      label={`Joint ${joint_index + 1} −`}
                      start={start}
                      stop={stop}
                    />
                    <HoldButton
                      active={positive_active}
                      disabled={
                        controls_disabled || (hold_active && !positive_active)
                      }
                      display_label="+"
                      intent={positive_intent}
                      label={`Joint ${joint_index + 1} +`}
                      start={start}
                      stop={stop}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.mode_content} role="tabpanel">
          <div className={styles.frame_bar}>
            <label htmlFor={`task-frame-${control_id}`}>Task frame</label>
            <select
              aria-label="Task jog frame"
              disabled={interaction_locked || task_frames.length === 0}
              id={`task-frame-${control_id}`}
              onChange={(event) => changeFrame(event.target.value)}
              value={active_frame}
            >
              {task_frames.length === 0 ? (
                <option value="">No authoritative task frame</option>
              ) : (
                task_frames.map((frame) => (
                  <option key={frame.name} value={frame.name}>
                    {frame.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className={styles.axis_list}>
            {TASK_AXES.map((axis, axis_index) => {
              const negative_intent: HoldIntent = {
                kind: "task",
                frame_name: active_frame,
                axis_index,
                direction: -1,
                speed_percent
              };
              const positive_intent: HoldIntent = {
                ...negative_intent,
                direction: 1
              };
              const negative_active = sameIntent(
                hold.current_intent,
                negative_intent
              );
              const positive_active = sameIntent(
                hold.current_intent,
                positive_intent
              );
              return (
                <article className={styles.axis_row} key={axis}>
                  <div className={styles.identity}>
                    <strong>{axis}</strong>
                  </div>
                  <div className={styles.axis_buttons}>
                    <HoldButton
                      active={negative_active}
                      disabled={
                        controls_disabled ||
                        active_frame.length === 0 ||
                        (hold_active && !negative_active)
                      }
                      display_label="−"
                      intent={negative_intent}
                      label={`Task ${axis} −`}
                      start={start}
                      stop={stop}
                    />
                    <HoldButton
                      active={positive_active}
                      disabled={
                        controls_disabled ||
                        active_frame.length === 0 ||
                        (hold_active && !positive_active)
                      }
                      display_label="+"
                      intent={positive_intent}
                      label={`Task ${axis} +`}
                      start={start}
                      stop={stop}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      <div aria-live="polite" className={styles.status_panel} role="status">
        <div className={styles.status_messages}>
          <p className={styles.operation_state}>
            ready: Hold-to-run controls are available.
          </p>
          {controls_disabled ? (
            <p className={styles.recovery_state}>
              {`recovery: ${unavailable_reason}`}
            </p>
          ) : null}
        </div>
        {session.phase !== "ready" ? (
          <button
            className={styles.retry_button}
            onClick={() => runtime.session.reconnect()}
            type="button"
          >
            Retry session
          </button>
        ) : null}
      </div>
    </section>
  );
}
