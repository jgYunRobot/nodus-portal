export const pilot_query_keys = {
  health: ["pilot", "health"] as const,
  snapshot: ["pilot", "snapshot"] as const,
  components: ["pilot", "components"] as const,
  endpoints: ["pilot", "endpoints"] as const,
  robot_status_streams: ["pilot", "streams", "robot_status"] as const,
  control_status: (control_id: string) =>
    ["pilot", "controls", control_id, "status"] as const
};
