import { Bounds, Grid, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import type { Object3D } from "three";
import URDFLoader, { type URDFRobot } from "urdf-loader";
import type { RobotProfile } from "./robot_profile";
import styles from "./robot_scene.module.css";

const default_scene_camera_position: [number, number, number] = [
  -1.4578, 1.1175, -1.2626
];
const default_scene_camera_target: [number, number, number] = [
  0.0036, 0.3785, -0.0372
];
const robot_scene_rotation: [number, number, number] = [-Math.PI / 2, 0, 0];

interface RobotSceneProps {
  profile: RobotProfile;
  joint_positions: readonly number[] | null;
}

interface LoadedRobotProps {
  profile: RobotProfile;
  joint_positions: readonly number[] | null;
  on_error: (message: string | null) => void;
}

function disposeObject(object: Object3D) {
  object.traverse((child) => {
    const mesh = child as Object3D & {
      geometry?: { dispose: () => void };
      material?: { dispose: () => void } | { dispose: () => void }[];
    };
    mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material.dispose());
    } else {
      mesh.material?.dispose();
    }
  });
}

function LoadedRobot({ profile, joint_positions, on_error }: LoadedRobotProps) {
  const [robot, setRobot] = useState<URDFRobot | null>(null);

  useEffect(() => {
    let disposed = false;
    const loader = new URDFLoader();
    loader.workingPath = "/robots/e_rob/";
    loader.parseCollision = false;
    loader.load(
      profile.urdf_path,
      (loaded) => {
        if (disposed) {
          disposeObject(loaded);
          return;
        }
        setRobot(loaded);
      },
      undefined,
      () =>
        on_error("The selected robot profile could not load its model assets.")
    );
    return () => {
      disposed = true;
    };
  }, [on_error, profile.urdf_path]);

  useEffect(() => {
    if (robot === null || joint_positions === null) return;
    joint_positions.forEach((position, index) => {
      robot.joints[`Joint_${index + 1}`]?.setJointValue?.(position);
    });
  }, [joint_positions, robot]);

  useEffect(() => {
    if (robot === null) return;
    return () => disposeObject(robot);
  }, [robot]);

  return robot === null ? null : <primitive object={robot} />;
}

export function RobotScene({ profile, joint_positions }: RobotSceneProps) {
  const [load_error, setLoadError] = useState<string | null>(null);

  return (
    <div className={styles.scene} aria-label={`${profile.label} visualization`}>
      <Canvas
        className={styles.canvas}
        camera={{ position: default_scene_camera_position, fov: 45, zoom: 1 }}
      >
        <color attach="background" args={["#101417"]} />
        <ambientLight intensity={0.65} />
        <directionalLight intensity={1.7} position={[2.4, 3.2, 4.1]} />
        <directionalLight intensity={0.45} position={[-3.4, -2.1, 2.5]} />
        <Grid
          args={[1.6, 16]}
          cellColor="#46505a"
          position={[0, -0.01, 0]}
          sectionColor="#7a8791"
        />
        <Bounds clip margin={1.25}>
          <group rotation={robot_scene_rotation}>
            <LoadedRobot
              profile={profile}
              joint_positions={joint_positions}
              on_error={setLoadError}
            />
          </group>
        </Bounds>
        <OrbitControls
          enableDamping
          makeDefault
          target={default_scene_camera_target}
        />
      </Canvas>
      {load_error === null ? null : (
        <p className={styles.overlay} role="alert">
          {load_error}
        </p>
      )}
    </div>
  );
}
