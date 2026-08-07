import { lazy, Suspense, useState } from "react";
import { useParams } from "react-router";
import { useControlStatus } from "../api/pilot/use_control_status";
import { Card } from "../components/feedback/card";
import { StatusBadge } from "../components/feedback/status_badge";
import {
  adaptRobotVisualizationState,
  type RobotVisualizationState
} from "../features/robot_model/robot_status_adapter";
import {
  loadRobotProfile,
  ROBOT_PROFILES,
  saveRobotProfile,
  type RobotProfile
} from "../features/robot_model/robot_profile";
import styles from "./jogging_page.module.css";

const RobotScene = lazy(() =>
  import("../features/robot_model/robot_scene").then((module) => ({
    default: module.RobotScene
  }))
);

function statusLabel(state: RobotVisualizationState) {
  return state.tone === "success"
    ? "Live"
    : state.tone === "warning"
      ? "Held"
      : state.tone === "danger"
        ? "Unavailable"
        : "Waiting";
}

export function JoggingPage() {
  const { control_id: route_control_id } = useParams();
  const control_id = route_control_id ?? "unresolved-control";
  return <JoggingWorkspace key={control_id} control_id={control_id} />;
}

function JoggingWorkspace({ control_id }: { control_id: string }) {
  const snapshot = useControlStatus(control_id);
  const visualization = adaptRobotVisualizationState(snapshot);
  const [profile, setProfile] = useState<RobotProfile | null>(() =>
    loadRobotProfile(control_id)
  );

  function selectProfile(profile_id: string) {
    const next = ROBOT_PROFILES.find((item) => item.id === profile_id) ?? null;
    saveRobotProfile(control_id, next);
    setProfile(next);
  }

  return (
    <main className={styles.page}>
      <div className={styles.title_row}>
        <div>
          <p className={styles.eyebrow}>Selected Control</p>
          <h1>Jogging</h1>
        </div>
        <StatusBadge
          label={statusLabel(visualization)}
          tone={visualization.tone}
        />
      </div>
      <Card>
        <h2>{control_id}</h2>
        <div className={styles.status_row}>
          <StatusBadge
            label={`Stream: ${snapshot.state}`}
            tone={visualization.tone}
          />
          <p>{visualization.message}</p>
        </div>
      </Card>
      <Card className={styles.detail_grid} aria-label="Robot status details">
        <div>
          <strong>Freshness</strong>
          <p>{snapshot.status?.fresh ? "Fresh" : "Not fresh"}</p>
        </div>
        <div>
          <strong>Connection generation</strong>
          <p>{snapshot.status?.connection_generation ?? "Unavailable"}</p>
        </div>
        <div>
          <strong>Sample sequence</strong>
          <p>{snapshot.status?.sample?.sample_sequence ?? "Unavailable"}</p>
        </div>
      </Card>
      <Card className={styles.profile_card}>
        <div>
          <h2>Visualization profile</h2>
          <p>
            Choose a Portal presentation profile for this Control. It does not
            identify the connected robot or authorize motion.
          </p>
        </div>
        <label>
          Robot model
          <select
            aria-label="Visualization profile"
            onChange={(event) => selectProfile(event.target.value)}
            value={profile?.id ?? ""}
          >
            <option value="">No profile selected</option>
            {ROBOT_PROFILES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {profile === null ? (
          <p className={styles.empty_scene}>
            No visualization profile is assigned to this Control.
          </p>
        ) : (
          <Suspense
            fallback={
              <p className={styles.empty_scene}>Loading robot visualization…</p>
            }
          >
            <RobotScene
              profile={profile}
              joint_positions={visualization.joint_positions}
            />
          </Suspense>
        )}
      </Card>
    </main>
  );
}
