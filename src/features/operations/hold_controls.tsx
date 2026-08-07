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

function formatValue(value: number | undefined, unit: string): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(3)} ${unit}`
    : "—";
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
      {label}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
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
  const scheduler = runtime.getScheduler(control_id);
  const operation = useSyncExternalStore(
    (listener) => scheduler.subscribe(listener),
    () => scheduler.getSnapshot(),
    () => scheduler.getSnapshot()
  );
  const robot_state = status.status?.sample?.robot_state;
  const frames = (robot_state?.frames ?? []).filter(
    (frame, index, all_frames) =>
      all_frames.findIndex((item) => item.name === frame.name) === index
  );
  const active_frame = frames.some((frame) => frame.name === selected_frame)
    ? selected_frame
    : (frames[0]?.name ?? "");
  const active_frame_state = frames.find(
    (frame) => frame.name === active_frame
  );
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
    if (!controls_disabled) hold.start(intent);
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
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Motion jog</p>
          <h2>Hold to run</h2>
          <p className={styles.description}>
            Targets are projected from the latest RobotStatus while the control
            is held. Releasing ends local target generation.
          </p>
        </div>
        <dl className={styles.stream_summary}>
          <Metric
            label="Status"
            value={has_authoritative_status ? "Fresh" : "Unavailable"}
          />
          <Metric
            label="Generation"
            value={String(status.status?.connection_generation ?? "—")}
          />
        </dl>
      </header>

      <div className={styles.speed_control}>
        <label htmlFor={`jog-speed-${control_id}`}>Speed</label>
        <input
          aria-label="Jog speed"
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

      {controls_disabled ? (
        <div className={styles.unavailable} role="status">
          <div>
            <strong>Jog unavailable</strong>
            <p>{unavailable_reason}</p>
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
      ) : null}

      <div aria-label="Jog mode" className={styles.tabs} role="tablist">
        <button
          aria-selected={mode === "joint"}
          className={mode === "joint" ? styles.tab_selected : styles.tab}
          onClick={() => selectMode("joint")}
          role="tab"
          type="button"
        >
          Joint
        </button>
        <button
          aria-selected={mode === "task"}
          className={mode === "task" ? styles.tab_selected : styles.tab}
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
            <div>
              <strong>Progressive goals</strong>
              <span>Hold to continue moving toward Home or Ready.</span>
            </div>
            <div className={styles.goal_buttons}>
              {(["home", "ready"] as const).map((kind) => {
                const intent: HoldIntent = { kind, speed_percent };
                return (
                  <HoldButton
                    active={sameIntent(hold.current_intent, intent)}
                    disabled={controls_disabled}
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
              return (
                <article className={styles.joint_row} key={joint_index}>
                  <div className={styles.identity}>
                    <strong>Joint {joint_index + 1}</strong>
                    <span>Authoritative state</span>
                  </div>
                  <div className={styles.jog_buttons}>
                    <HoldButton
                      active={sameIntent(hold.current_intent, negative_intent)}
                      disabled={controls_disabled}
                      intent={negative_intent}
                      label={`Joint ${joint_index + 1} −`}
                      start={start}
                      stop={stop}
                    />
                    <HoldButton
                      active={sameIntent(hold.current_intent, positive_intent)}
                      disabled={controls_disabled}
                      intent={positive_intent}
                      label={`Joint ${joint_index + 1} +`}
                      start={start}
                      stop={stop}
                    />
                  </div>
                  <dl className={styles.metrics}>
                    <Metric
                      label="Position"
                      value={formatValue(
                        robot_state?.real.pos[joint_index],
                        "rad"
                      )}
                    />
                    <Metric
                      label="Velocity"
                      value={formatValue(
                        robot_state?.real.vel[joint_index],
                        "rad/s"
                      )}
                    />
                    <Metric
                      label="Torque"
                      value={formatValue(
                        robot_state?.real.torque[joint_index],
                        "Nm"
                      )}
                    />
                    <Metric
                      label="Accel."
                      value={formatValue(
                        robot_state?.real.acc[joint_index],
                        "rad/s²"
                      )}
                    />
                  </dl>
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
              disabled={controls_disabled || frames.length === 0}
              id={`task-frame-${control_id}`}
              onChange={(event) => changeFrame(event.target.value)}
              value={active_frame}
            >
              {frames.length === 0 ? (
                <option value="">No authoritative task frame</option>
              ) : (
                frames.map((frame) => (
                  <option key={frame.name} value={frame.name}>
                    {frame.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <dl className={styles.pose_grid} aria-label="Selected frame pose">
            <Metric label="X" value={formatValue(active_frame_state?.x, "m")} />
            <Metric label="Y" value={formatValue(active_frame_state?.y, "m")} />
            <Metric label="Z" value={formatValue(active_frame_state?.z, "m")} />
            <Metric
              label="Rx"
              value={formatValue(active_frame_state?.r1, "rad")}
            />
            <Metric
              label="Ry"
              value={formatValue(active_frame_state?.r2, "rad")}
            />
            <Metric
              label="Rz"
              value={formatValue(active_frame_state?.r3, "rad")}
            />
          </dl>
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
              return (
                <article className={styles.axis_row} key={axis}>
                  <div className={styles.identity}>
                    <strong>{axis}</strong>
                    <span>{axis_index < 3 ? "Translation" : "Rotation"}</span>
                  </div>
                  <div className={styles.axis_buttons}>
                    <HoldButton
                      active={sameIntent(hold.current_intent, negative_intent)}
                      disabled={controls_disabled || active_frame.length === 0}
                      intent={negative_intent}
                      label={`Task ${axis} −`}
                      start={start}
                      stop={stop}
                    />
                    <HoldButton
                      active={sameIntent(hold.current_intent, positive_intent)}
                      disabled={controls_disabled || active_frame.length === 0}
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

      <p aria-live="polite" className={styles.operation_state}>
        {operation.presentation === null
          ? session.phase === "ready"
            ? "Pilot operation session ready."
            : `Pilot session: ${session.phase}.`
          : `${operation.presentation.state}: ${operation.presentation.message}`}
      </p>
    </section>
  );
}
