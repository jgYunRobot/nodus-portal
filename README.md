# nodus-portal

`nodus-portal` is the independent operator portal for observing and operating Nodus systems through the public `nodus-pilot` boundary.

This initial repository contains only shared agent rules and project documentation scaffolding. The existing `pa_control/apps/web_ui` source, assets, configuration, dependencies, and frontend build structure have not been migrated yet.

## Integration boundary

- Portal reads Pilot health, component, endpoint, event, and sample-stream APIs.
- Portal sends semantic operator operations through Pilot and never connects directly to Control IPC.
- Camera and other provider payloads flow directly from the provider endpoints discovered through Pilot.
- Until Pilot provides server-enforced command authority, deployments must keep only one mutating command source active for each Control.

## Development setup

```bash
./setup_dev.sh
```

The setup script initializes the pinned `docs/agent_docs` submodule.
