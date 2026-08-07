import { lazy, Suspense, useState } from "react";
import { useParams } from "react-router";
import { useControlStatus } from "../api/pilot/use_control_status";
import { Card } from "../components/feedback/card";
import { adaptRobotVisualizationState } from "../features/robot_model/robot_status_adapter";
import {
  loadRobotProfile,
  ROBOT_PROFILES,
  saveRobotProfile,
  type RobotProfile
} from "../features/robot_model/robot_profile";
import { HoldControls } from "../features/operations/hold_controls";
import styles from "./jogging_page.module.css";

const RobotScene = lazy(() =>
  import("../features/robot_model/robot_scene").then((module) => ({
    default: module.RobotScene
  }))
);

function formatValue(value: number | undefined, unit: string): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(3)} ${unit}`
    : "—";
}

export function JoggingPage() {
  const { control_id: route_control_id } = useParams();
  const control_id = route_control_id ?? "unresolved-control";
  return <JoggingWorkspace key={control_id} control_id={control_id} />;
}

function JoggingWorkspace({ control_id }: { control_id: string }) {
  const snapshot = useControlStatus(control_id);
  const visualization = adaptRobotVisualizationState(snapshot);
  const robot_state = snapshot.status?.sample?.robot_state;
  const realtime_robot_state =
    snapshot.state === "live" &&
    snapshot.status?.fresh === true &&
    !snapshot.status.stale
      ? robot_state
      : undefined;
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
          <h1>Jogging</h1>
          <p className={styles.eyebrow}>{control_id}</p>
        </div>
      </div>
      <div className={styles.workspace}>
        <section className={styles.visual_column}>
          <Card className={styles.profile_card}>
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
              <p className={styles.empty_scene}>No model selected.</p>
            ) : (
              <Suspense
                fallback={
                  <p className={styles.empty_scene}>Loading visualization…</p>
                }
              >
                <RobotScene
                  profile={profile}
                  joint_positions={visualization.joint_positions}
                />
              </Suspense>
            )}
          </Card>
          <Card
            className={styles.values_card}
            aria-label="Real-time robot values"
          >
            <h2>Real-time values</h2>
            {realtime_robot_state === undefined ? (
              <p className={styles.empty_values}>No fresh RobotStatus.</p>
            ) : (
              <div className={styles.joint_values}>
                {realtime_robot_state.real.pos.map((_, joint_index) => (
                  <article className={styles.value_row} key={joint_index}>
                    <strong>Joint {joint_index + 1}</strong>
                    <dl>
                      <div>
                        <dt>Position</dt>
                        <dd>
                          {formatValue(
                            realtime_robot_state.real.pos[joint_index],
                            "rad"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Velocity</dt>
                        <dd>
                          {formatValue(
                            realtime_robot_state.real.vel[joint_index],
                            "rad/s"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Torque</dt>
                        <dd>
                          {formatValue(
                            realtime_robot_state.real.torque[joint_index],
                            "Nm"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Accel.</dt>
                        <dd>
                          {formatValue(
                            realtime_robot_state.real.acc[joint_index],
                            "rad/s²"
                          )}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </Card>
        </section>
        <Card className={styles.operation_card}>
          <HoldControls control_id={control_id} />
        </Card>
      </div>
    </main>
  );
}
