import { ArrowUpRight, Bot, Check, Circle } from "lucide-react";
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
        <div className={styles.robot_mark}>
          <Bot aria-hidden="true" />
        </div>
        <StatusBadge label={robot.status_label} tone={robot.tone} />
      </div>
      <div className={styles.identity}>
        <h2>{robot.control_id}</h2>
        <p title={robot.stream_id}>{robot.stream_id}</p>
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
      <div className={styles.footer}>
        <button
          aria-label={`Select ${robot.control_id}`}
          aria-pressed={is_selected}
          className={styles.select_button}
          onClick={selectRobot}
          type="button"
        >
          {is_selected ? (
            <Check aria-hidden="true" />
          ) : (
            <Circle aria-hidden="true" />
          )}
          {is_selected ? "Selected" : "Select robot"}
        </button>
        <Link
          className={styles.action}
          onClick={selectRobot}
          to={`/robots/${encodeURIComponent(robot.control_id)}/operation`}
        >
          Open Operation <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}
