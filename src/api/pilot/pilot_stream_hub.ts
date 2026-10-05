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
  set_timeout?: typeof window.setTimeout;
  clear_timeout?: typeof window.clearTimeout;
}

const STREAM_RETRY_INITIAL_MS = 500;
const STREAM_RETRY_MAX_MS = 5000;

export class PilotStreamHub {
  private readonly snapshots = new Map<string, ControlStatusSnapshot>();
  private readonly initial_snapshots = new Map<string, ControlStatusSnapshot>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly sources = new Map<string, StreamSource>();
  private readonly recovery_versions = new Map<string, number>();
  private readonly reseeding_controls = new Set<string>();
  private readonly reconnect_timers = new Map<string, number>();
  private readonly reconnect_delays = new Map<string, number>();
  private readonly recovery_listeners = new Set<(control_id: string) => void>();
  private readonly set_timeout: typeof window.setTimeout;
  private readonly clear_timeout: typeof window.clearTimeout;
  private server_instance_id: string | null = null;
  private readonly create_source: (url: string) => StreamSource;
  private readonly read_latest: (
    control_id: string
  ) => Promise<components["schemas"]["ControlStatusResponse"]>;
  constructor(options: PilotStreamHubOptions = {}) {
    this.set_timeout = options.set_timeout ?? window.setTimeout.bind(window);
    this.clear_timeout =
      options.clear_timeout ?? window.clearTimeout.bind(window);
    this.create_source =
      options.create_source ??
      ((url) => new EventSource(resolvePilotPath(url)));
    this.read_latest =
      options.read_latest ??
      ((control_id) => new PilotHttpClient().getControlStatus(control_id));
  }
  subscribeRecovery(listener: (control_id: string) => void): () => void {
    this.recovery_listeners.add(listener);
    return () => this.recovery_listeners.delete(listener);
  }
  observeServerInstance(server_instance_id: string): void {
    const previous_server_instance_id = this.server_instance_id;
    this.server_instance_id = server_instance_id;
    if (
      previous_server_instance_id === null ||
      previous_server_instance_id === server_instance_id
    )
      return;
    const active_controls = new Set([
      ...this.sources.keys(),
      ...this.reconnect_timers.keys()
    ]);
    for (const control_id of this.snapshots.keys()) {
      this.invalidateRecovery(control_id);
      this.publish({
        control_id,
        status: null,
        state: "recovering",
        last_error: "Pilot server instance changed; status is being reseeded."
      });
    }
    for (const control_id of active_controls) {
      this.disconnect(control_id);
      this.connect(control_id);
    }
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
    const previous = this.getSnapshot(control_id);
    const next_sample = value.sample;
    const previous_sample = previous.status?.sample;
    if (
      !this.reseeding_controls.has(control_id) &&
      next_sample !== null &&
      previous_sample !== null &&
      previous_sample !== undefined &&
      next_sample.connection_generation ===
        previous_sample.connection_generation
    ) {
      if (next_sample.sample_sequence <= previous_sample.sample_sequence)
        return;
    }
    this.invalidateRecovery(control_id);
    this.reseeding_controls.delete(control_id);
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
    if (this.sources.has(control_id) || this.reconnect_timers.has(control_id))
      return;
    this.reseeding_controls.add(control_id);
    const source = this.create_source(
      `/api/v1/controls/${encodeURIComponent(control_id)}/status/stream`
    );
    this.sources.set(control_id, source);
    source.addEventListener("open", () => {
      if (this.sources.get(control_id) !== source) return;
      this.reconnect_delays.delete(control_id);
      this.reseeding_controls.add(control_id);
      this.startRecovery(
        control_id,
        "Control status SSE connected; reseeding status."
      );
    });
    source.addEventListener("robot_status", (event) => {
      if (this.sources.get(control_id) !== source) return;
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
    source.onerror = () => {
      if (this.sources.get(control_id) !== source) return;
      this.sources.delete(control_id);
      source.close();
      this.startRecovery(
        control_id,
        "Control status SSE connection failed; recovery is required."
      );
      const delay_ms =
        this.reconnect_delays.get(control_id) ?? STREAM_RETRY_INITIAL_MS;
      this.reconnect_delays.set(
        control_id,
        Math.min(delay_ms * 2, STREAM_RETRY_MAX_MS)
      );
      this.reconnect_timers.set(
        control_id,
        this.set_timeout(() => {
          this.reconnect_timers.delete(control_id);
          this.connect(control_id);
        }, delay_ms)
      );
    };
    this.startRecovery(
      control_id,
      "Control status subscription is reseeding from the latest snapshot."
    );
  }
  disconnect(control_id: string): void {
    this.reseeding_controls.add(control_id);
    const source = this.sources.get(control_id);
    this.sources.delete(control_id);
    source?.close();
    const reconnect_timer = this.reconnect_timers.get(control_id);
    if (reconnect_timer !== undefined) this.clear_timeout(reconnect_timer);
    this.reconnect_timers.delete(control_id);
    this.reconnect_delays.delete(control_id);
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
        this.reseeding_controls.delete(control_id);
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
    if (snapshot.state !== "live" && snapshot.state !== "idle")
      this.recovery_listeners.forEach((listener) =>
        listener(snapshot.control_id)
      );
    this.listeners.get(snapshot.control_id)?.forEach((listener) => listener());
  }
}
