# nodus-portal

`nodus-portal` is the independent React/Vite operator portal for observing and operating Nodus
systems through public Pilot contracts and direct provider endpoints. It includes multi-robot Home,
the global Device directory, direct Vision previews, robot-scoped Operation/Jog controls, the
persistent Robot Dock, and direct Operator activation controls.

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

Install the locked frontend dependencies explicitly after setup:

```bash
npm ci
```

### Run locally

Start the Vite development server for access from this host only and proxy same-origin `/api`
requests to the local Pilot:

```bash
VITE_PILOT_PROXY_TARGET=http://127.0.0.1:8765 ./run_app.sh --port 5173 --strictPort
```

Open `http://localhost:5173`. The Portal itself also answers at `http://127.0.0.1:5173`, but the
current Vision Pilot-enabled profiles allow the exact `http://localhost:5173` origin rather than
the numeric loopback origin.

### Run on the local network

Stop any Portal development server already using port 5173, then bind Vite to every host interface:

```bash
VITE_PILOT_PROXY_TARGET=http://127.0.0.1:8765 \
  ./run_app.sh --host 0.0.0.0 --port 5173 --strictPort
```

Open `http://<host-lan-ip>:5173` from another device on the same network. For the current research
host profile this is `http://192.168.219.106:5173`; confirm the host address again if DHCP changes
it. `0.0.0.0` is a server bind address and must not be used as the browser URL.

The current Operator and Vision research profiles allow the exact origin
`http://192.168.219.106:5173`. If the Portal host address or port changes, update those providers'
advertised URLs/CORS allowlists before expecting direct Camera or activation requests to work.

`--strictPort` prevents Vite from silently moving to another port when 5173 is already occupied.
Stop the old process with `Ctrl+C`; if it was launched from another terminal, inspect the listener
before starting a replacement:

```bash
ss -ltnp | grep ':5173'
```

Other Vite options are forwarded unchanged:

```bash
./run_app.sh --host 127.0.0.1 --port 4173 --strictPort
./run_app.sh --host 0.0.0.0 --port 5173 --strictPort --open
./run_app.sh --help
```

The checked-in `public/portal_config.json` uses `pilotBaseUrl: "same-origin"`. In development,
`VITE_PILOT_PROXY_TARGET` makes Vite proxy `/api` to Pilot while provider payloads continue directly
to their discovered endpoints. For static deployment, build `dist/`, serve SPA fallback routes, and
set `pilotBaseUrl` or the hosting reverse proxy explicitly as described in `docs/static_hosting.md`.

Create the production bundle with the existing `npm run build` command.

```bash
npm run build
```

There is no `make_full.sh` wrapper for Portal; dependency installation remains `npm ci` and the
production build remains `npm run build`.

## Normal stack startup order

For the current same-host research deployment, start the processes in separate terminals:

1. `nodus-control`: `./run_app.sh`
2. `nodus-pilot`: `./run_app.sh`
3. Optional `nodus-vision`: `./run_app.sh`
4. Optional `nodus-operator`: `./run_app.sh`
5. `nodus-portal`: use the local or LAN command above

Pilot can start before Control and reconnect, but starting Control first makes initial status easier
to interpret. Keep only one mutating Operator/Portal source active for a Control under the current
cooperative `pass_through` deployment.

## Frontend commands

Portal requires Node.js 24.19.0 and npm 11.17.0 or newer within the Node 24 line.

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```
