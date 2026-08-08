import { Card } from "../components/feedback/card";
import { StatusBadge } from "../components/feedback/status_badge";
import type { DeviceDirectoryEntry } from "../features/device_directory/device_directory";
import { useDeviceDirectory } from "../features/device_directory/use_device_directory";
import styles from "./device_page.module.css";

export function DevicePage() {
  const { directory, error, is_loading } = useDeviceDirectory();
  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div>
          <h1>Device directory</h1>
          <p>Discover connected provider devices independently of any robot.</p>
        </div>
      </div>
      {is_loading && <Card>Loading the public device directory…</Card>}
      {error !== null && error !== undefined && (
        <Card>
          <h2>Device directory unavailable</h2>
          <p>{getErrorMessage(error)}</p>
        </Card>
      )}
      {directory !== undefined && (
        <section aria-label="Device directory" className={styles.directory}>
          {directory.slots.map((slot) =>
            slot.kind === "empty" ? (
              <Card
                className={styles.empty_slot}
                key={`empty-${slot.slot_number}`}
              >
                <h2>Empty slot {slot.slot_number}</h2>
                <p>No supported provider device is registered in this slot.</p>
              </Card>
            ) : (
              <DeviceCard entry={slot.entry} key={slot.entry.runtime_key} />
            )
          )}
        </section>
      )}
    </main>
  );
}

function DeviceCard({ entry }: { entry: DeviceDirectoryEntry }) {
  return (
    <Card className={styles.device_card}>
      <div className={styles.card_heading}>
        <div>
          <p className={styles.type_label}>{getCardTypeLabel(entry)}</p>
          <h2>{entry.display_name}</h2>
          <p className={styles.component_id}>{entry.component_id}</p>
        </div>
        <StatusBadge
          label={getLifecycleLabel(entry.lifecycle_state)}
          tone={getLifecycleTone(entry.lifecycle_state)}
        />
      </div>
      <dl className={styles.details}>
        <div>
          <dt>Instance</dt>
          <dd>{entry.instance_id}</dd>
        </div>
        <div>
          <dt>Capabilities</dt>
          <dd>{entry.capabilities.join(", ") || "None advertised"}</dd>
        </div>
        <div>
          <dt>Endpoints</dt>
          <dd>{entry.endpoint_count}</dd>
        </div>
      </dl>
      {entry.malformed_endpoint_count > 0 && (
        <p className={styles.warning}>
          {entry.malformed_endpoint_count} malformed endpoint descriptor
          {entry.malformed_endpoint_count === 1 ? "" : "s"} ignored.
        </p>
      )}
      <p className={styles.read_only}>Read-only information</p>
    </Card>
  );
}

function getCardTypeLabel(entry: DeviceDirectoryEntry): string {
  if (entry.card_kind === "camera") return "Camera";
  if (entry.card_kind === "operator") return "Operator";
  return entry.component_type;
}

function getLifecycleLabel(
  state: DeviceDirectoryEntry["lifecycle_state"]
): string {
  if (state === "ready") return "Online";
  if (state === "degraded") return "Degraded";
  if (state === "faulted") return "Faulted";
  if (state === "stopping") return "Stopping";
  return "Starting";
}

function getLifecycleTone(
  state: DeviceDirectoryEntry["lifecycle_state"]
): "success" | "warning" | "danger" | "neutral" {
  if (state === "ready") return "success";
  if (state === "degraded" || state === "stopping") return "warning";
  if (state === "faulted") return "danger";
  return "neutral";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Pilot did not provide a usable device directory.";
}
