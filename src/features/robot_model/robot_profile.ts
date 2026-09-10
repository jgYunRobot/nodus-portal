export interface RobotProfile {
  id: "e_rob_3kg" | "e_rob_dual";
  label: string;
  urdf_path: string;
  joint_names: readonly string[];
}

export const E_ROB_3KG_PROFILE: RobotProfile = {
  id: "e_rob_3kg",
  label: "eRob 3 kg",
  urdf_path: "/robots/e_rob/e_rob_3kg.urdf",
  joint_names: Array.from({ length: 6 }, (_, index) => `Joint_${index + 1}`)
};

export const E_ROB_DUAL_PROFILE: RobotProfile = {
  id: "e_rob_dual",
  label: "eRob Dual Arm (12 DOF)",
  urdf_path: "/robots/e_rob_dual/e_rob_dual_arm.urdf",
  joint_names: ["left", "right"].flatMap((side) =>
    Array.from({ length: 6 }, (_, index) => `${side}_Joint_${index + 1}`)
  )
};

export const ROBOT_PROFILES = [E_ROB_3KG_PROFILE, E_ROB_DUAL_PROFILE] as const;

export function profileStorageKey(control_id: string) {
  return `nodus_portal.robot_profile.v1.${control_id}`;
}

export function loadRobotProfile(control_id: string): RobotProfile | null {
  const stored = window.localStorage.getItem(profileStorageKey(control_id));
  return ROBOT_PROFILES.find((profile) => profile.id === stored) ?? null;
}

export function saveRobotProfile(
  control_id: string,
  profile: RobotProfile | null
) {
  const key = profileStorageKey(control_id);
  if (profile === null) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, profile.id);
}
