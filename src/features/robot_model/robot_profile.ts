export interface RobotProfile {
  id: "e_rob_3kg";
  label: string;
  urdf_path: string;
}

export const E_ROB_3KG_PROFILE: RobotProfile = {
  id: "e_rob_3kg",
  label: "eRob 3 kg",
  urdf_path: "/robots/e_rob/e_rob_3kg.urdf"
};

export const ROBOT_PROFILES = [E_ROB_3KG_PROFILE] as const;

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
