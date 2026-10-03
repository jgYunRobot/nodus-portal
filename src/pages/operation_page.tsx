import { Activity, Box, MousePointer2 } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
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
import {
  getOperatorCandidates,
  resolveOperatorSelection
} from "../features/operator_remote/operator_remote_model";
import {
  OperatorRemotePanel,
  type OperatorRemoteDirectoryState
} from "../features/operator_remote/operator_remote_panel";
import { useDeviceDirectory } from "../features/device_directory/use_device_directory";
import styles from "./operation_page.module.css";

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

export function OperationPage() {
  const { control_id: route_control_id } = useParams();
  const control_id = route_control_id ?? "unresolved-control";
  return <OperationWorkspace key={control_id} control_id={control_id} />;
}

function OperationWorkspace({ control_id }: { control_id: string }) {
  const snapshot = useControlStatus(control_id);
  const device_directory = useDeviceDirectory();
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
  const visualization = adaptRobotVisualizationState(
    snapshot,
    profile ?? undefined
  );
  const [selected_operator_id, setSelectedOperatorId] = useState<string | null>(
    null
  );
  const operator_candidates = useMemo(
    () => getOperatorCandidates(device_directory.directory?.entries ?? []),
    [device_directory.directory?.entries]
  );
  const directory_state: OperatorRemoteDirectoryState =
    device_directory.error !== null
      ? "error"
      : device_directory.directory !== undefined
        ? "ready"
        : "loading";

  const resolved_operator_id = resolveOperatorSelection(
    operator_candidates,
    selected_operator_id,
    selected_operator_id === null
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
          <h1>Operation</h1>
          <p className={styles.eyebrow}>{control_id}</p>
        </div>
        <p className={styles.description}>
          Model, joint feedback, and motion controls.
        </p>
      </div>
      <div className={styles.workspace}>
        <section className={styles.visual_column}>
          <Card className={styles.profile_card}>
            <div className={styles.scene_toolbar}>
              <h2>
                <Box aria-hidden="true" /> Robot visualization
              </h2>
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
            </div>
            {profile === null ? (
              <div className={styles.empty_scene}>
                <Box aria-hidden="true" />
                <h3>Bring your robot into view</h3>
                <p>Choose its model above to inspect the robot in 3D.</p>
                <span>The model choice is saved for this robot.</span>
              </div>
            ) : (
              <Suspense
                fallback={
                  <p className={styles.empty_scene}>Loading visualization…</p>
                }
              >
                <RobotScene
                  key={profile.id}
                  frames={realtime_robot_state?.frames ?? []}
                  profile={profile}
                  joint_positions={visualization.joint_positions}
                />
              </Suspense>
            )}
            {profile !== null ? (
              <p className={styles.scene_hint}>
                <MousePointer2 aria-hidden="true" /> Drag to orbit · Scroll to
                zoom
              </p>
            ) : null}
            {profile !== null && visualization.tone !== "success" ? (
              <p className={styles.visualization_status} role="status">
                {visualization.message}
              </p>
            ) : null}
          </Card>
          <Card
            className={styles.values_card}
            aria-label="Real-time robot values"
          >
            <div className={styles.values_heading}>
              <h2>
                <Activity aria-hidden="true" /> Real-time values
              </h2>
              <p>Latest accepted joint feedback</p>
            </div>
            {realtime_robot_state === undefined ? (
              <p className={styles.empty_values}>
                Waiting for fresh robot feedback. Joint values will appear here
                when available.
              </p>
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
        <aside aria-label="Operation remotes" className={styles.remote_rail}>
          <Card>
            <HoldControls control_id={control_id} />
          </Card>
          <OperatorRemotePanel
            candidates={operator_candidates}
            control_id={control_id}
            directory_event={device_directory.last_event}
            directory_state={directory_state}
            on_select_operator={setSelectedOperatorId}
            refresh_directory={device_directory.refresh_directory}
            selected_component_id={resolved_operator_id}
          />
        </aside>
      </div>
    </main>
  );
}
