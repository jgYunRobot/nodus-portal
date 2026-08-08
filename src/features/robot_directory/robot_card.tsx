import { Link } from "react-router";
import { useControlStatus } from "../../api/pilot/use_control_status";
import { Card } from "../../components/feedback/card";
import { StatusBadge } from "../../components/feedback/status_badge";
import type { RobotDirectoryEntry } from "./robot_directory";
import { createRobotCardViewModel } from "./robot_card_model";
import {
  setPreferredControlId,
  useRobotDockState
} from "../../shell/robot_dock_state";
import styles from "./robot_card.module.css";

export function RobotCard({ entry }: { entry: RobotDirectoryEntry }) {
  const snapshot = useControlStatus(entry.control_id);
  const robot = createRobotCardViewModel(entry, snapshot);
  const robot_dock = useRobotDockState();
  const is_selected = robot.control_id === robot_dock.preferred_control_id;

  function selectRobot(): void {
    setPreferredControlId(robot.control_id);
  }

  return (
    <Card
      aria-label={`${robot.control_id} robot summary`}
      className={
        is_selected ? `${styles.card} ${styles.selected}` : styles.card
      }
      data-control-id={robot.control_id}
      data-selected={is_selected}
      onClick={selectRobot}
    >
      <div className={styles.header}>
        <div>
          <h2>{robot.control_id}</h2>
          <p className={styles.identity}>
            RobotStatus stream: {robot.stream_id}
          </p>
        </div>
        <StatusBadge label={robot.status_label} tone={robot.tone} />
      </div>
      <dl className={styles.details}>
        <div className={styles.detail}>
          <dt>Robot type</dt>
          <dd>{robot.robot_type}</dd>
        </div>
        <div className={styles.detail}>
          <dt>DOF</dt>
          <dd>{robot.dof}</dd>
        </div>
        <div className={styles.detail}>
          <dt>Servo</dt>
          <dd>{robot.servo}</dd>
        </div>
        <div className={styles.detail}>
          <dt>Brake</dt>
          <dd>{robot.brake}</dd>
        </div>
        <div className={styles.detail}>
          <dt>Update age</dt>
          <dd>{robot.update_age}</dd>
        </div>
      </dl>
      <Link
        className={styles.action}
        onClick={selectRobot}
        to={`/robots/${encodeURIComponent(robot.control_id)}/jogging`}
      >
        Open Jogging
      </Link>
    </Card>
  );
}
