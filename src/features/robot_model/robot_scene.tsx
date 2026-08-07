import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import type { Object3D } from "three";
import URDFLoader, { type URDFRobot } from "urdf-loader";
import type { RobotProfile } from "./robot_profile";
import styles from "./robot_scene.module.css";

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
        camera={{ position: [1.3, 0.9, 1.3], fov: 42 }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight intensity={2.2} position={[3, 4, 2]} />
        <Grid args={[2, 2]} cellColor="#587077" sectionColor="#9bccc8" />
        <LoadedRobot
          profile={profile}
          joint_positions={joint_positions}
          on_error={setLoadError}
        />
        <OrbitControls makeDefault />
      </Canvas>
      <p
        className={styles.overlay}
        role={load_error === null ? undefined : "alert"}
      >
        {load_error ??
          "Drag to inspect. This is a presentation profile, not a robot identity claim."}
      </p>
    </div>
  );
}
