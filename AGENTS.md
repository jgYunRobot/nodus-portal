# Agent Instructions

- Shared baseline: `docs/agent_docs/AGENTS.md`.
- Project documentation rules: `docs/rules.md`.
- Read and follow the shared baseline and project documentation rules before every coding task.
- The project-specific rules in `docs/rules.md` and below may narrow the shared baseline. If a rule conflicts, the project-specific rule takes precedence.

## Project-specific rules

- `nodus-portal` is the independently launched operator portal that will receive the responsibilities currently under `pa_control/apps/web_ui`.
- Do not migrate Portal source, configuration, assets, dependencies, or build tooling until the relevant design is explicitly approved.
- Preserve the original `pa_control/apps/web_ui` files during migration work.
- Integrate with `nodus-pilot` only through its published HTTP, SSE, discovery, operation, and sample-stream contracts. Do not import Pilot internals.
- Consume Camera and other provider payloads directly through endpoints discovered from Pilot. Do not relay provider payloads through Pilot.
- Do not connect to Control IPC or depend directly on `nodus-control`.
- Until Pilot enforces command authority, keep at most one mutating command source active for a Control and treat Portal command controls as cooperative operation only.
- Run `./setup_dev.sh` to initialize pinned submodules.
- Treat `docs/agent_docs` as an independently versioned submodule. Do not modify its contents as part of this repository.
