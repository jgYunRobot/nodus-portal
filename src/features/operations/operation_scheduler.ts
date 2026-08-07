import type { OperationPresentation } from "./pilot_operation_client";

export interface SchedulerSnapshot {
  in_flight: boolean;
  has_pending: boolean;
  presentation: OperationPresentation | null;
}

export class OperationScheduler<T> {
  private active = true;
  private in_flight = false;
  private pending: T | null = null;
  private sequence = 0;
  private cancellation_generation = 0;
  private snapshot: SchedulerSnapshot = {
    in_flight: false,
    has_pending: false,
    presentation: null
  };
  private readonly listeners = new Set<() => void>();
  constructor(
    private readonly submit: (target: T) => Promise<OperationPresentation>
  ) {}

  getSnapshot(): SchedulerSnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  schedule(target: T): void {
    if (!this.active) return;
    if (this.in_flight) {
      this.pending = target;
      this.publish();
      return;
    }
    this.dispatch(target);
  }

  cancel(): void {
    this.active = false;
    this.pending = null;
    this.cancellation_generation += 1;
    this.publish();
  }

  resume(): void {
    this.active = true;
    this.snapshot = { ...this.snapshot, presentation: null };
  }

  private dispatch(target: T): void {
    this.in_flight = true;
    const token = ++this.sequence;
    const dispatched_cancellation_generation = this.cancellation_generation;
    this.publish();
    void this.submit(target).then((presentation) => {
      if (token !== this.sequence) return;
      this.in_flight = false;
      const was_cancelled =
        dispatched_cancellation_generation !== this.cancellation_generation;
      if (!was_cancelled) {
        this.snapshot = { ...this.snapshot, presentation };
      }
      if (!this.active || (!was_cancelled && presentation.terminal)) {
        this.pending = null;
        if (!was_cancelled && presentation.terminal) this.active = false;
        this.publish();
        return;
      }
      const pending = this.pending;
      this.pending = null;
      this.publish();
      if (pending !== null) this.dispatch(pending);
    });
  }

  private publish(): void {
    this.snapshot = {
      ...this.snapshot,
      in_flight: this.in_flight,
      has_pending: this.pending !== null
    };
    this.listeners.forEach((listener) => listener());
  }
}
