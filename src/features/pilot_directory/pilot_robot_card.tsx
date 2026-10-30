import { ArrowUpRight, Bot } from "lucide-react";
import { Card } from "../../components/feedback/card";
import { StatusBadge } from "../../components/feedback/status_badge";
import { navigateToPilot } from "../../config/pilot_launch";
import { setPilotPreferredControlId } from "../../shell/robot_dock_state";
import { useRobotSelectionLocked } from "../operations/portal_operation_context";
import { withPilotScope, type DiscoveredPilot } from "./pilot_directory";
import styles from "../robot_directory/robot_card.module.css";

export function PilotRobotCard({
  pilot,
  control_id
}: {
  pilot: DiscoveredPilot;
  control_id: string;
}) {
  const locked = useRobotSelectionLocked();
  function selectPilot(path: string): void {
    if (locked) return;
    setPilotPreferredControlId(pilot.pilot_id, control_id);
    navigateToPilot(pilot.pilot_id, path);
  }
  const operation_path = `/robots/${encodeURIComponent(control_id)}/operation`;
  return (
    <Card
      aria-label={`${control_id} at ${pilot.endpoint}`}
      className={styles.card}
    >
      <div className={styles.header}>
        <div className={styles.robot_mark}>
          <Bot aria-hidden="true" />
        </div>
        <StatusBadge label="Not selected" tone="neutral" />
      </div>
      <div className={styles.identity}>
        <h2>{control_id}</h2>
        <p>{pilot.endpoint}</p>
      </div>
      <p>Select this robot to load its status and controls.</p>
      <div className={styles.footer}>
        <button
          className={styles.select_button}
          disabled={locked}
          onClick={() => selectPilot("/home")}
          type="button"
        >
          Select robot
        </button>
        <a
          aria-disabled={locked}
          className={styles.action}
          href={withPilotScope(operation_path, pilot.pilot_id)}
          onClick={(event) => {
            event.preventDefault();
            selectPilot(operation_path);
          }}
        >
          Open Operation <ArrowUpRight aria-hidden="true" />
        </a>
      </div>
    </Card>
  );
}
