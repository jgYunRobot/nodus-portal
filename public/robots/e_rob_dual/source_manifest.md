# eRob dual-arm asset

- Source: `nodus-control/assets/robots/urdf/e_rob/e_rob_dual_arm.urdf`,
  user-requested local dual-arm asset, copied on 2026-09-10.
- Portal adaptation: mesh URLs become `../e_rob/mesh/official_erob_arm/*.stl`,
  relative to the dual URDF directory. The loader prepends its working path.
  Existing Portal STL assets are reused; no sibling checkout is needed at runtime/build time.
- Both base centers are at Y=+0.20/-0.20 m. Left yaw is pi, right yaw is zero,
  orienting the base -Y protrusions outward. Joint origins, axes, limits, masses,
  inertia and fixed mounts otherwise match the Control asset.
- Status order: left joints 1–6, then right joints 1–6. Fixed mounts consume no status entries.
- Mesh provenance and private-research-only intake limitations remain those in
  `../e_rob/source_manifest.md`. This does not establish redistribution rights.
