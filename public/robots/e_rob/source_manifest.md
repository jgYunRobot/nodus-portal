# eRob 3 kg URDF Asset Source Manifest

## Adopted Source

- Upstream repository: https://github.com/ZeroErrControl/eRob_ROS2_MoveIt
- MoveIt eRobo3 entrypoint: `erobo3_control/config/eRobo3.urdf.xacro`
- Included upstream URDF: `erob_arm/urdf/erob_arm.urdf`
- Primary meshes: `erob_arm/meshes/base_link.stl`, `Link_1.stl` through `Link_6.stl`
- Upstream package license field for `erob_arm`: `TODO: License declaration`

## Local Asset Files

- URDF: `assets/robots/urdf/e_rob/e_rob_3kg.urdf`
- Official STL copy: `assets/robots/urdf/e_rob/mesh/official_erob_arm/*.stl`
- Local STL filenames use lowercase snake_case to follow this repository's file naming rule:
  `base_link.stl`, `link_1.stl` through `link_6.stl`.

## Integration Decisions

- The local URDF keeps the upstream `erob_arm.urdf` robot name, `Joint_*` joint names, `Link_*` link names, joint origins, mass values, inertia tensors, and visual/collision mesh topology.
- The URDF source adaptations are converting `package://erob_arm/meshes/*.stl` to repo-local `assets/robots/urdf/e_rob/mesh/official_erob_arm/*.stl` mesh paths and aligning local joint-axis signs with the observed eRob/Web UI positive motion direction.
- The previous local asset based on `erob_description/urdf/erobo3/erobo3.urdf` was replaced because that CAD export has nonzero joint-origin RPY values and makes the zero joint pose visually tilted in the web UI.
- Joint limits are local bring-up policy values, not a direct copy of `docs/eRob_rotary_ecat_manual.pdf`. The current local overrides set `Joint_3` to `-140..140 deg`, `Joint_4` to `-130..130 deg`, and `Joint_6` to `-180..180 deg`; safety soft limits keep the existing approximate 4 deg inner margin.
- Local `apps/control/config/e_rob.json` actuator names should match the adopted `Joint_1` through `Joint_6` URDF contract.
- Local `apps/control/config/e_rob.json` app-side software limits are intentionally 10% wider than the URDF hard limits, because the eRob runtime conversion clamps command targets with the config limits while the control/model/view hard limit remains the URDF limit.
- Upstream `erob_arm.urdf` does not include transmission blocks. The local URDF also omits transmissions because current control and web UI paths use only the six kinematic joints and actuator config owns hardware conversion details.
- The upstream `erob_arm` package does not declare a concrete license yet, so redistribution or release packaging should be reviewed separately.

## Portal intake record

- Portal copied the listed URDF and STL files from the PA-CONTROL source path on 2026-08-07;
  PA-CONTROL remains read-only.
- Portal serves the model from `public/robots/e_rob/`. Its copied URDF changes only each mesh
  filename from the PA-CONTROL repository-relative path to
  `mesh/official_erob_arm/*.stl`, so it resolves inside this static package. The mesh bytes are
  otherwise copied unchanged.
- The user approved this intake for private, non-public research and development only. The
  upstream license remains `TODO: License declaration` / unconfirmed.
- This record does not claim that the assets are open source or that any open-source, commercial,
  or other redistribution rights have been obtained. Redistribution and release packaging require
  separate rights review.
