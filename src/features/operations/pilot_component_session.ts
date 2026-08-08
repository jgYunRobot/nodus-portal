import type { components } from "../../api/pilot/generated/pilot_v1";
import { PilotHttpClient } from "../../api/pilot/pilot_http_client";

export interface MonotonicClock {
  now(): number;
}

export interface PortalSessionSnapshot {
  phase: "starting" | "ready" | "recovering" | "stopped" | "error";
  server_instance_id: string | null;
  last_error: string | null;
}

export interface OperationContext {
  session_id: string;
  generation: number;
  sequence: number;
  source_timestamp_ns: number;
  request_id: string;
}

interface SessionRecord {
  session_id: string;
  server_instance_id: string;
  heartbeat_interval_ms: number;
  lease_timeout_ms: number;
  server_time_ns: number;
  response_received_ms: number;
  lease_renewed_ms: number;
  lifecycle_sequence: number;
  operation_sequence: number;
  operation_generation: number;
}

interface PortalComponentSessionOptions {
  client?: PilotHttpClient;
  clock?: MonotonicClock;
  component_id?: string;
  instance_id?: string;
  storage?: Pick<Storage, "getItem" | "setItem">;
  set_timeout?: typeof window.setTimeout;
  clear_timeout?: typeof window.clearTimeout;
  on_invalidate?: () => void;
}

const COMPONENT_ID_PREFIX = "nodus-portal.";
const COMPONENT_ID_STORAGE_KEY = "nodus.portal.component_id.v1";
const COMPONENT_ID_MAX_LENGTH = 128;
const OBSERVATION_CAPABILITY = "control.robot_status.v1";
const OPERATION_CAPABILITY = "control.operation.v1";
const NANOSECONDS_PER_MILLISECOND = 1_000_000;

function browserClock(): MonotonicClock {
  return { now: () => performance.now() };
}

function createRandomUuid(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const random_bytes = crypto.getRandomValues(new Uint8Array(16));
  random_bytes[6] = (random_bytes[6] & 0x0f) | 0x40;
  random_bytes[8] = (random_bytes[8] & 0x3f) | 0x80;
  const hexadecimal = Array.from(random_bytes, (value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
  const uuid = [
    hexadecimal.slice(0, 8),
    hexadecimal.slice(8, 12),
    hexadecimal.slice(12, 16),
    hexadecimal.slice(16, 20),
    hexadecimal.slice(20)
  ].join("-");
  return uuid;
}

function createInstanceId(): string {
  return `portal-${createRandomUuid()}`;
}

function createComponentId(
  storage?: Pick<Storage, "getItem" | "setItem">
): string {
  let active_storage: Pick<Storage, "getItem" | "setItem">;
  try {
    active_storage = storage ?? window.localStorage;
    const stored_component_id = active_storage.getItem(
      COMPONENT_ID_STORAGE_KEY
    );
    if (
      stored_component_id !== null &&
      stored_component_id.startsWith(COMPONENT_ID_PREFIX) &&
      stored_component_id.length <= COMPONENT_ID_MAX_LENGTH
    ) {
      return stored_component_id;
    }
  } catch {
    return `${COMPONENT_ID_PREFIX}${createRandomUuid()}`;
  }

  const component_id = `${COMPONENT_ID_PREFIX}${createRandomUuid()}`;
  try {
    active_storage.setItem(COMPONENT_ID_STORAGE_KEY, component_id);
  } catch {
    // The runtime-scoped ID still prevents cross-device replacement.
  }
  return component_id;
}

export class PortalComponentSession {
  private readonly client: PilotHttpClient;
  private readonly clock: MonotonicClock;
  private readonly component_id: string;
  private readonly instance_id: string;
  private readonly set_timeout: typeof window.setTimeout;
  private readonly clear_timeout: typeof window.clearTimeout;
  private readonly on_invalidate: () => void;
  private readonly listeners = new Set<() => void>();
  private lifecycle_chain: Promise<void> = Promise.resolve();
  private record: SessionRecord | null = null;
  private heartbeat_timer: number | null = null;
  private stopped = false;
  private registration_in_flight = false;
  private last_clock_ms: number | null = null;
  private snapshot: PortalSessionSnapshot = {
    phase: "stopped",
    server_instance_id: null,
    last_error: null
  };

  constructor(options: PortalComponentSessionOptions = {}) {
    this.client = options.client ?? new PilotHttpClient();
    this.clock = options.clock ?? browserClock();
    this.component_id =
      options.component_id ?? createComponentId(options.storage);
    this.instance_id = options.instance_id ?? createInstanceId();
    this.set_timeout = options.set_timeout ?? window.setTimeout.bind(window);
    this.clear_timeout =
      options.clear_timeout ?? window.clearTimeout.bind(window);
    this.on_invalidate = options.on_invalidate ?? (() => undefined);
  }

  getSnapshot(): PortalSessionSnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (!this.stopped && this.snapshot.phase !== "stopped") return;
    this.stopped = false;
    this.register();
  }

  stop(): void {
    this.stopped = true;
    this.clearHeartbeat();
    this.record = null;
    this.last_clock_ms = null;
    this.publish({
      phase: "stopped",
      server_instance_id: null,
      last_error: null
    });
  }

  notifyVisibilityChange(hidden: boolean): void {
    if (hidden)
      this.invalidate(
        "Portal visibility changed; session recovery is required."
      );
    else if (!this.stopped) this.register();
  }

  reconnect(): void {
    this.invalidate(
      "Browser connection changed; session recovery is required."
    );
  }

  invalidate(reason: string): void {
    this.clearHeartbeat();
    this.record = null;
    this.last_clock_ms = null;
    this.on_invalidate();
    if (this.stopped) return;
    this.publish({
      phase: "recovering",
      server_instance_id: null,
      last_error: reason
    });
    this.register();
  }

  observeServerInstance(server_instance_id: string): void {
    if (
      this.record !== null &&
      this.record.server_instance_id !== server_instance_id
    ) {
      this.invalidate(
        "Pilot server instance changed; session recovery is required."
      );
    }
  }

  reserveOperation(): OperationContext | null {
    const record = this.record;
    if (record === null || this.snapshot.phase !== "ready") return null;
    const now_ms = this.clock.now();
    if (
      !Number.isFinite(now_ms) ||
      now_ms < record.response_received_ms ||
      (this.last_clock_ms !== null && now_ms < this.last_clock_ms)
    ) {
      this.invalidate(
        "Monotonic clock discontinuity; session recovery is required."
      );
      return null;
    }
    this.last_clock_ms = now_ms;
    record.operation_sequence += 1;
    const sequence = record.operation_sequence;
    return {
      session_id: record.session_id,
      generation: record.operation_generation,
      sequence,
      source_timestamp_ns: Math.floor(
        record.server_time_ns +
          (now_ms - record.response_received_ms) * NANOSECONDS_PER_MILLISECOND
      ),
      request_id: `${this.instance_id}-${record.operation_generation}-${sequence}`
    };
  }

  private register(): void {
    if (this.stopped || this.registration_in_flight) return;
    this.registration_in_flight = true;
    const registration_requested_ms = this.clock.now();
    const started_at = Math.floor(
      registration_requested_ms * NANOSECONDS_PER_MILLISECOND
    );
    const request: components["schemas"]["ComponentRegistrationRequest"] = {
      component_id: this.component_id,
      instance_id: this.instance_id,
      component_type: "ui",
      protocol_version: 1,
      supported_schema_versions: [1],
      capabilities: [OPERATION_CAPABILITY, OBSERVATION_CAPABILITY],
      service_endpoints: {},
      initial_state: { health: "starting", reason: null, details: {} },
      started_at,
      metadata: {},
      clock_domain: "monotonic_same_host"
    };
    this.publish({
      phase: "starting",
      server_instance_id: null,
      last_error: null
    });
    void this.client
      .registerComponent(request)
      .then((response) => {
        if (this.stopped) return;
        const response_received_ms = this.clock.now();
        if (
          !Number.isFinite(response_received_ms) ||
          response_received_ms < registration_requested_ms
        ) {
          this.invalidate(
            "Monotonic clock is unavailable; session recovery is required."
          );
          return;
        }
        this.record = {
          session_id: response.session_id,
          server_instance_id: response.server_instance_id,
          heartbeat_interval_ms: response.heartbeat_interval_ms,
          lease_timeout_ms: response.lease_timeout_ms,
          server_time_ns: response.server_time,
          response_received_ms,
          lease_renewed_ms: response_received_ms,
          lifecycle_sequence: 0,
          operation_sequence: 0,
          operation_generation: 0
        };
        this.last_clock_ms = response_received_ms;
        this.publish({
          phase: "ready",
          server_instance_id: response.server_instance_id,
          last_error: null
        });
        this.enqueueLifecycle((record) =>
          this.client.updateComponentState(record.session_id, {
            sequence: record.lifecycle_sequence,
            state: { health: "ready", reason: null, details: {} }
          })
        );
        this.scheduleHeartbeat();
      })
      .catch((error: unknown) => {
        if (!this.stopped) {
          this.publish({
            phase: "error",
            server_instance_id: null,
            last_error:
              error instanceof Error
                ? error.message
                : "Pilot registration failed."
          });
        }
      })
      .finally(() => {
        this.registration_in_flight = false;
      });
  }

  private enqueueLifecycle(
    action: (record: SessionRecord) => Promise<unknown>
  ): void {
    const expected_session_id = this.record?.session_id;
    this.lifecycle_chain = this.lifecycle_chain
      .then(async () => {
        const record = this.record;
        if (
          record === null ||
          this.stopped ||
          record.session_id !== expected_session_id
        ) {
          return;
        }
        const lifecycle_requested_ms = this.clock.now();
        if (
          !Number.isFinite(lifecycle_requested_ms) ||
          (this.last_clock_ms !== null &&
            lifecycle_requested_ms < this.last_clock_ms) ||
          lifecycle_requested_ms - record.lease_renewed_ms >=
            record.lease_timeout_ms
        ) {
          this.invalidate(
            "Session lease or monotonic clock requires recovery."
          );
          return;
        }
        this.last_clock_ms = lifecycle_requested_ms;
        record.lifecycle_sequence += 1;
        const response = await action(record);
        if (this.record !== record || this.stopped) return;
        record.lease_renewed_ms = lifecycle_requested_ms;
        if (
          response !== null &&
          typeof response === "object" &&
          "snapshot" in response &&
          response.snapshot !== null &&
          typeof response.snapshot === "object" &&
          "server_instance_id" in response.snapshot &&
          typeof response.snapshot.server_instance_id === "string"
        ) {
          this.observeServerInstance(response.snapshot.server_instance_id);
        }
      })
      .catch((error: unknown) => {
        this.invalidate(
          error instanceof Error
            ? error.message
            : "Pilot lifecycle update failed."
        );
      });
  }

  private scheduleHeartbeat(): void {
    this.clearHeartbeat();
    const record = this.record;
    if (record === null || this.stopped) return;
    this.heartbeat_timer = this.set_timeout(() => {
      this.heartbeat_timer = null;
      this.enqueueLifecycle((active_record) =>
        this.client.heartbeat(active_record.session_id, {
          sequence: active_record.lifecycle_sequence
        })
      );
      this.scheduleHeartbeat();
    }, record.heartbeat_interval_ms);
  }

  private clearHeartbeat(): void {
    if (this.heartbeat_timer !== null) this.clear_timeout(this.heartbeat_timer);
    this.heartbeat_timer = null;
  }

  private publish(snapshot: PortalSessionSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}
