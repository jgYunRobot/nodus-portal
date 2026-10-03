import { createRandomUuid } from "../operations/identity";
import type { OperatorActivationClient } from "./operator_activation_client";
import type {
  OperatorActivationEndpoints,
  OperatorActivationSnapshot,
  OperatorHoldStartResponse
} from "./operator_activation_contract";

const HOLD_HEARTBEAT_INTERVAL_MS = 100;

export type OperatorHoldSessionState =
  "idle" | "starting" | "holding" | "stopping" | "recovering";

interface OperatorHoldTransport {
  startHold(
    endpoint: string,
    request: { request_id: string }
  ): Promise<OperatorHoldStartResponse>;
  heartbeatHold(
    endpoint: string,
    request: { lease_id: string; generation: number }
  ): Promise<OperatorActivationSnapshot>;
  stopHold(
    endpoint: string,
    request: { lease_id: string; generation: number }
  ): Promise<OperatorActivationSnapshot>;
}

interface OperatorHoldSessionOptions {
  client: OperatorActivationClient;
  endpoints: OperatorActivationEndpoints;
  is_current_snapshot: (snapshot: OperatorActivationSnapshot) => boolean;
  on_snapshot: (snapshot: OperatorActivationSnapshot) => void;
  on_change?: (state: OperatorHoldSessionState) => void;
  create_request_id?: () => string;
  set_interval?: typeof window.setInterval;
  clear_interval?: typeof window.clearInterval;
}

interface LocalLease {
  lease_id: string;
  generation: number;
}

export class OperatorHoldSession {
  private readonly client: OperatorHoldTransport;
  private readonly endpoints: OperatorActivationEndpoints;
  private readonly is_current_snapshot: (
    snapshot: OperatorActivationSnapshot
  ) => boolean;
  private readonly on_snapshot: (snapshot: OperatorActivationSnapshot) => void;
  private readonly on_change: (state: OperatorHoldSessionState) => void;
  private readonly create_request_id: () => string;
  private readonly set_interval: typeof window.setInterval;
  private readonly clear_interval: typeof window.clearInterval;
  private state: OperatorHoldSessionState = "idle";
  private lease: LocalLease | null = null;
  private heartbeat_timer: number | null = null;
  private heartbeat_in_flight = false;
  private release_requested = false;
  private stop_requested = false;

  constructor(options: OperatorHoldSessionOptions) {
    this.client = options.client;
    this.endpoints = options.endpoints;
    this.is_current_snapshot = options.is_current_snapshot;
    this.on_snapshot = options.on_snapshot;
    this.on_change = options.on_change ?? (() => undefined);
    this.create_request_id =
      options.create_request_id ?? (() => `portal-hold-${createRandomUuid()}`);
    this.set_interval = options.set_interval ?? window.setInterval.bind(window);
    this.clear_interval =
      options.clear_interval ?? window.clearInterval.bind(window);
  }

  getState(): OperatorHoldSessionState {
    return this.state;
  }

  start(): boolean {
    if (this.state !== "idle") return false;
    this.release_requested = false;
    this.stop_requested = false;
    this.setState("starting");
    void this.startLease();
    return true;
  }

  release(): void {
    this.release_requested = true;
    if (this.state === "starting") return;
    if (this.state === "holding") this.stopCurrentLease();
  }

  reconcile(): boolean {
    if (this.state !== "recovering" || this.lease !== null) return false;
    this.setState("idle");
    return true;
  }

  dispose(): void {
    this.release();
  }

  private async startLease(): Promise<void> {
    let response: OperatorHoldStartResponse;
    try {
      response = await this.client.startHold(this.endpoints.hold_start, {
        request_id: this.create_request_id()
      });
    } catch {
      this.setState("recovering");
      return;
    }
    if (!this.is_current_snapshot(response.snapshot)) {
      this.setState("recovering");
      return;
    }
    this.lease = {
      lease_id: response.lease.lease_id,
      generation: response.lease.generation
    };
    this.on_snapshot(response.snapshot);
    if (this.release_requested) {
      this.stopCurrentLease();
      return;
    }
    this.setState("holding");
    this.heartbeat_timer = this.set_interval(() => {
      void this.heartbeat();
    }, HOLD_HEARTBEAT_INTERVAL_MS);
  }

  private async heartbeat(): Promise<void> {
    const lease = this.lease;
    if (
      this.state !== "holding" ||
      lease === null ||
      this.heartbeat_in_flight
    ) {
      return;
    }
    this.heartbeat_in_flight = true;
    try {
      const snapshot = await this.client.heartbeatHold(
        this.endpoints.hold_heartbeat,
        lease
      );
      if (this.state !== "holding" || this.lease !== lease) return;
      if (!this.is_current_snapshot(snapshot)) {
        this.closeForRecovery();
        return;
      }
      this.on_snapshot(snapshot);
    } catch {
      this.closeForRecovery();
    } finally {
      this.heartbeat_in_flight = false;
    }
  }

  private stopCurrentLease(): void {
    const lease = this.lease;
    if (lease === null || this.stop_requested) return;
    this.stop_requested = true;
    this.clearLocalLease();
    this.setState("stopping");
    void this.stopLease(lease);
  }

  private async stopLease(lease: LocalLease): Promise<void> {
    try {
      const snapshot = await this.client.stopHold(
        this.endpoints.hold_stop,
        lease
      );
      if (this.is_current_snapshot(snapshot)) this.on_snapshot(snapshot);
      this.setState("idle");
    } catch {
      this.setState("recovering");
    }
  }

  private closeForRecovery(): void {
    this.clearLocalLease();
    this.setState("recovering");
  }

  private clearLocalLease(): void {
    this.lease = null;
    if (this.heartbeat_timer !== null) {
      this.clear_interval(this.heartbeat_timer);
      this.heartbeat_timer = null;
    }
  }

  private setState(next_state: OperatorHoldSessionState): void {
    if (this.state === next_state) return;
    this.state = next_state;
    this.on_change(next_state);
  }
}
