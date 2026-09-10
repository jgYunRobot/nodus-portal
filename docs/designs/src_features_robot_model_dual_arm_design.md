# Dual-arm visualization

- Add `e_rob_dual` to the existing per-Control visualization profile selector.
  Selection remains a local presentation preference, not a Control configuration command.
- Serve the dual URDF from `public/robots/e_rob_dual/`, reusing packaged eRob meshes.
  Keep the Control asset's 0.40 m mounting separation and opposite yaw.
- Each profile declares ordered URDF joint names. The dual profile maps positions
  0–5 to left joints and 6–11 to right joints; fixed mounts are not mapped.
- Accept only a fresh finite position vector with exactly the selected profile's
  joint count. Show an unavailable/mismatch message instead of slicing twelve axes
  into a six-axis model. Stale input holds the last rendered pose.
- Remount the scene when the profile changes to discard the old model/load error.
  Resolve relative mesh paths from the selected URDF directory.
  Dual-arm meshes use `../e_rob/mesh/official_erob_arm/*.stl`: the installed
  URDF loader concatenates its working path even for slash-prefixed filenames.
- No dependency or Pilot contract changes; no direct Control IPC or runtime sibling
  asset reads. Jog/Home/Ready command behavior is outside this visualization change.
- Regression cases cover 12-axis preservation, mapping order, wrong counts, stale
  input and a nonfinite right-arm value. Browser rendering is a separate validation.
