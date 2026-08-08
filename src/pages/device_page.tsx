import { useParams } from "react-router";
import { useControlStatus } from "../api/pilot/use_control_status";
import { Card } from "../components/feedback/card";
import { StatusBadge } from "../components/feedback/status_badge";
import styles from "./device_page.module.css";

function getConnectionStatus(
  state: ReturnType<typeof useControlStatus>["state"],
  available: boolean | undefined,
  fresh: boolean | undefined,
  stale: boolean | undefined
) {
  if (state === "malformed" || state === "error")
    return { label: "Unavailable", tone: "danger" as const };
  if (state === "recovering")
    return { label: "Recovering", tone: "warning" as const };
  if (available !== true)
    return { label: "Awaiting status", tone: "neutral" as const };
  if (fresh !== true || stale === true)
    return { label: "Stale", tone: "warning" as const };
  return { label: "Online", tone: "success" as const };
}

function formatAge(age_ms: number | null | undefined): string {
  if (age_ms === null || age_ms === undefined || !Number.isFinite(age_ms))
    return "Unknown";
  if (age_ms < 1000) return `${Math.round(age_ms)} ms`;
  return `${(age_ms / 1000).toFixed(1)} s`;
}

export function DevicePage() {
  const { control_id: route_control_id } = useParams();
  const control_id = route_control_id ?? "unresolved-control";
  const snapshot = useControlStatus(control_id);
  const status = snapshot.status;
  const robot_interface = status?.sample?.robot_state.interface;
  const connection = getConnectionStatus(
    snapshot.state,
    status?.available,
    status?.fresh,
    status?.stale
  );

  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div>
          <h1>Device</h1>
          <p>{control_id}</p>
        </div>
        <StatusBadge label={connection.label} tone={connection.tone} />
      </div>
      <Card>
        <h2>Control status</h2>
        <dl className={styles.details}>
          <div>
            <dt>Robot type</dt>
            <dd>{robot_interface?.robot_type ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>DOF</dt>
            <dd>
              {robot_interface === undefined ? "Unknown" : robot_interface.dof}
            </dd>
          </div>
          <div>
            <dt>Servo</dt>
            <dd>
              {robot_interface === undefined
                ? "Unknown"
                : robot_interface.servo_activated
                  ? "Activated"
                  : "Not activated"}
            </dd>
          </div>
          <div>
            <dt>Brake</dt>
            <dd>
              {robot_interface === undefined
                ? "Unknown"
                : robot_interface.brake_released
                  ? "Released"
                  : "Applied"}
            </dd>
          </div>
          <div>
            <dt>Latest update</dt>
            <dd>{formatAge(status?.age_ms)}</dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}
