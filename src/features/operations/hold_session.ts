import type { ControlStatusSnapshot } from "../../api/pilot/pilot_stream_hub";
import {
  HOME_JOINT_TARGET,
  JOINT_RATE_RAD_PER_SECOND,
  createTaskTargetPosition,
  projectDirectionalTarget,
  projectGoalTarget,
  projectTaskRotation,
  READY_JOINT_TARGET,
  TASK_TRANSLATION_RATE_PER_SECOND,
  type JogDirection,
  type RotationMatrix3
} from "./jog_target_projector";
import type { OperationTarget } from "./pilot_operation_client";
import { OperationScheduler } from "./operation_scheduler";
import { adaptMotionRobotStatus } from "./robot_status_adapter";

export type HoldIntent =
  | {
      kind: "joint";
      joint_index: number;
      direction: JogDirection;
      speed_percent: number;
    }
  | {
      kind: "task";
      frame_name: string;
      axis_index: number;
      direction: JogDirection;
      speed_percent: number;
    }
  | { kind: "home"; speed_percent: number }
  | { kind: "ready"; speed_percent: number };

export interface HoldSessionOptions {
  control_id: string;
  read_snapshot: () => ControlStatusSnapshot;
  scheduler: OperationScheduler<OperationTarget>;
  now?: () => number;
  set_interval?: typeof window.setInterval;
  clear_interval?: typeof window.clearInterval;
}

const HOLD_TICK_MS = 50;

export class HoldSession {
  private readonly now: () => number;
  private readonly set_interval: typeof window.setInterval;
  private readonly clear_interval: typeof window.clearInterval;
  private timer: number | null = null;
  private intent: HoldIntent | null = null;
  private projection: number[] | null = null;
  private task_rotation: RotationMatrix3 | null = null;
  private connection_generation: number | null = null;
  private last_tick_ms: number | null = null;
  constructor(private readonly options: HoldSessionOptions) {
    this.now = options.now ?? (() => performance.now());
    this.set_interval = options.set_interval ?? window.setInterval.bind(window);
    this.clear_interval =
      options.clear_interval ?? window.clearInterval.bind(window);
    this.options.scheduler.subscribe(() => {
      if (
        this.intent !== null &&
        this.options.scheduler.getSnapshot().presentation?.terminal
      ) {
        this.stop();
      }
    });
  }

  get active(): boolean {
    return this.intent !== null;
  }

  get current_intent(): Readonly<HoldIntent> | null {
    return this.intent;
  }

  start(intent: HoldIntent): void {
    this.stop();
    this.options.scheduler.resume();
    this.intent = intent;
    this.last_tick_ms = this.now();
    this.tick();
    if (this.intent !== null)
      this.timer = this.set_interval(() => this.tick(), HOLD_TICK_MS);
  }

  stop(): void {
    if (this.timer !== null) this.clear_interval(this.timer);
    this.timer = null;
    this.intent = null;
    this.projection = null;
    this.task_rotation = null;
    this.connection_generation = null;
    this.last_tick_ms = null;
    this.options.scheduler.cancel();
  }

  private tick(): void {
    const intent = this.intent;
    if (intent === null) return;
    const status = adaptMotionRobotStatus(this.options.read_snapshot());
    if (status === null) {
      this.stop();
      return;
    }
    if (
      this.connection_generation !== null &&
      this.connection_generation !== status.connection_generation
    ) {
      this.stop();
      return;
    }
    this.connection_generation = status.connection_generation;
    const now_ms = this.now();
    const elapsed_ms = Math.max(0, now_ms - (this.last_tick_ms ?? now_ms));
    this.last_tick_ms = now_ms;
    const target = this.createTarget(intent, status, elapsed_ms);
    if (target === null) {
      this.stop();
      return;
    }
    this.options.scheduler.schedule(target);
  }

  private createTarget(
    intent: HoldIntent,
    status: ReturnType<typeof adaptMotionRobotStatus> & object,
    elapsed_ms: number
  ): OperationTarget | null {
    if (intent.kind === "joint") {
      const positions = [...status.joint_positions];
      const current = positions[intent.joint_index];
      if (current === undefined) return null;
      if (this.projection === null) this.projection = positions;
      this.projection[intent.joint_index] = projectDirectionalTarget(
        this.projection[intent.joint_index],
        current,
        intent.direction,
        intent.speed_percent,
        elapsed_ms,
        JOINT_RATE_RAD_PER_SECOND
      );
      positions[intent.joint_index] = this.projection[intent.joint_index];
      return {
        operation: "control.move_joint_online",
        control_id: this.options.control_id,
        target_position: positions
      };
    }
    if (intent.kind === "task") {
      const frame = status.frames.get(intent.frame_name);
      if (frame === undefined) return null;
      if (this.projection === null) this.projection = [...frame.translation];
      if (this.task_rotation === null) this.task_rotation = frame.rotation;
      if (intent.axis_index < 3) {
        this.projection[intent.axis_index] = projectDirectionalTarget(
          this.projection[intent.axis_index]!,
          frame.translation[intent.axis_index]!,
          intent.direction,
          intent.speed_percent,
          elapsed_ms,
          TASK_TRANSLATION_RATE_PER_SECOND
        );
      } else {
        this.task_rotation = projectTaskRotation(
          this.task_rotation,
          frame.rotation,
          intent.axis_index,
          intent.direction,
          intent.speed_percent,
          elapsed_ms
        );
        if (this.task_rotation === null) return null;
      }
      const target_position = createTaskTargetPosition(
        this.projection,
        this.task_rotation
      );
      if (target_position === null) return null;
      return {
        operation: "control.move_task_online",
        control_id: this.options.control_id,
        target_position
      };
    }
    const goal =
      intent.kind === "home" ? HOME_JOINT_TARGET : READY_JOINT_TARGET;
    if (this.projection === null) this.projection = [...status.joint_positions];
    this.projection = projectGoalTarget(
      this.projection,
      status.joint_positions,
      goal,
      intent.speed_percent,
      elapsed_ms
    );
    return {
      operation: "control.move_joint_online",
      control_id: this.options.control_id,
      target_position: this.projection
    };
  }
}
