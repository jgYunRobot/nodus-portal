import type { components } from "./generated/pilot_v1";
import { PilotHttpClient, resolvePilotPath } from "./pilot_http_client";
import { isControlStatusResponse } from "./pilot_runtime_guards";

export interface ControlStatusSnapshot {
  control_id: string;
  status: components["schemas"]["ControlStatusResponse"] | null;
  state: "idle" | "live" | "recovering" | "malformed" | "error";
  last_error: string | null;
}
type Listener = () => void;
interface StreamSource {
  addEventListener(type: string, listener: (event: Event) => void): void;
  close(): void;
  onerror: ((event: Event) => unknown) | null;
}

interface PilotStreamHubOptions {
  create_source?: (url: string) => StreamSource;
  read_latest?: (
    control_id: string
  ) => Promise<components["schemas"]["ControlStatusResponse"]>;
}

export class PilotStreamHub {
  private readonly snapshots = new Map<string, ControlStatusSnapshot>();
  private readonly initial_snapshots = new Map<string, ControlStatusSnapshot>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly sources = new Map<string, StreamSource>();
  private readonly recovery_versions = new Map<string, number>();
  private readonly create_source: (url: string) => StreamSource;
  private readonly read_latest: (
    control_id: string
  ) => Promise<components["schemas"]["ControlStatusResponse"]>;
  constructor(options: PilotStreamHubOptions = {}) {
    this.create_source =
      options.create_source ??
      ((url) => new EventSource(resolvePilotPath(url)));
    this.read_latest =
      options.read_latest ??
      ((control_id) => new PilotHttpClient().getControlStatus(control_id));
  }
  getSnapshot(control_id: string): ControlStatusSnapshot {
    const snapshot = this.snapshots.get(control_id);
    if (snapshot !== undefined) return snapshot;

    let initial_snapshot = this.initial_snapshots.get(control_id);
    if (initial_snapshot === undefined) {
      initial_snapshot = {
        control_id,
        status: null,
        state: "idle",
        last_error: null
      };
      this.initial_snapshots.set(control_id, initial_snapshot);
    }
    return initial_snapshot;
  }
  subscribe(control_id: string, listener: Listener): () => void {
    const listeners = this.listeners.get(control_id) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(control_id, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(control_id);
        this.disconnect(control_id);
      }
    };
  }
  accept(control_id: string, value: unknown): void {
    if (!isControlStatusResponse(value) || value.control_id !== control_id) {
      this.invalidateRecovery(control_id);
      this.publish({
        control_id,
        status: this.getSnapshot(control_id).status,
        state: "malformed",
        last_error: "Malformed or mismatched Control status SSE payload."
      });
      return;
    }
    this.invalidateRecovery(control_id);
    const previous = this.getSnapshot(control_id);
    const next_sample = value.sample;
    const previous_sample = previous.status?.sample;
    if (
      next_sample !== null &&
      previous_sample !== null &&
      previous_sample !== undefined &&
      next_sample.connection_generation ===
        previous_sample.connection_generation
    ) {
      if (next_sample.sample_sequence <= previous_sample.sample_sequence)
        return;
    }
    this.publish({
      control_id,
      status: value,
      state: "live",
      last_error: null
    });
  }
  markRecovery(control_id: string, reason: string): void {
    const snapshot = this.getSnapshot(control_id);
    this.publish({
      control_id,
      status: snapshot.status,
      state: "recovering",
      last_error: reason
    });
  }
  connect(control_id: string): void {
    if (this.sources.has(control_id)) return;
    const source = this.create_source(
      `/api/v1/controls/${encodeURIComponent(control_id)}/status/stream`
    );
    source.addEventListener("robot_status", (event) => {
      try {
        this.accept(
          control_id,
          JSON.parse((event as MessageEvent<string>).data)
        );
      } catch {
        this.startRecovery(
          control_id,
          "Control status SSE payload could not be parsed."
        );
      }
    });
    source.onerror = () =>
      this.startRecovery(
        control_id,
        "Control status SSE connection failed; recovery is required."
      );
    this.sources.set(control_id, source);
    this.startRecovery(
      control_id,
      "Control status subscription is reseeding from the latest snapshot."
    );
  }
  disconnect(control_id: string): void {
    this.sources.get(control_id)?.close();
    this.sources.delete(control_id);
    this.invalidateRecovery(control_id);
    const snapshot = this.getSnapshot(control_id);
    this.publish({
      control_id,
      status: snapshot.status,
      state: "recovering",
      last_error: "Control status subscription is disconnected."
    });
  }
  private startRecovery(control_id: string, reason: string): void {
    const recovery_version = this.invalidateRecovery(control_id);
    this.markRecovery(control_id, reason);
    void this.read_latest(control_id)
      .then((status) => {
        if (this.recovery_versions.get(control_id) !== recovery_version) return;
        if (
          !isControlStatusResponse(status) ||
          status.control_id !== control_id
        ) {
          this.publish({
            control_id,
            status: this.getSnapshot(control_id).status,
            state: "malformed",
            last_error:
              "Control status recovery payload is malformed or mismatched."
          });
          return;
        }
        this.publish({
          control_id,
          status,
          state: "live",
          last_error: null
        });
      })
      .catch(() => {
        if (this.recovery_versions.get(control_id) !== recovery_version) return;
        const snapshot = this.getSnapshot(control_id);
        this.publish({
          control_id,
          status: snapshot.status,
          state: "error",
          last_error: "Control status recovery request failed."
        });
      });
  }
  private invalidateRecovery(control_id: string): number {
    const recovery_version = (this.recovery_versions.get(control_id) ?? 0) + 1;
    this.recovery_versions.set(control_id, recovery_version);
    return recovery_version;
  }
  private publish(snapshot: ControlStatusSnapshot): void {
    this.snapshots.set(snapshot.control_id, snapshot);
    this.listeners.get(snapshot.control_id)?.forEach((listener) => listener());
  }
}
