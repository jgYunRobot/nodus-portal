import { useParams } from "react-router";
import { useControlStatus } from "../api/pilot/use_control_status";
import { Card } from "../components/feedback/card";
import { HoldControls } from "../features/operations/hold_controls";
import styles from "./operating_page.module.css";

function getStatusLabel(
  state: ReturnType<typeof useControlStatus>["state"]
): string {
  if (state === "live") return "Fresh status available";
  if (state === "error") return "Pilot status unavailable";
  return "Waiting for Pilot status";
}

export function OperatingPage() {
  const { control_id: route_control_id } = useParams();
  const control_id = route_control_id ?? "unresolved-control";
  const snapshot = useControlStatus(control_id);

  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div>
          <h1>Operating</h1>
          <p className={styles.eyebrow}>{control_id}</p>
        </div>
        <p className={styles.status}>{getStatusLabel(snapshot.state)}</p>
      </div>
      <Card className={styles.controls_card}>
        <div className={styles.introduction}>
          <h2>Robot controls</h2>
          <p>
            Commands require a fresh authoritative RobotStatus and remain
            active only while their controls are held.
          </p>
        </div>
        <HoldControls control_id={control_id} />
      </Card>
    </main>
  );
}
