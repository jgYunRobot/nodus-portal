# Static hosting

Build Portal with `npm run build` and serve the generated `dist/` directory from a static host.

- Return `index.html` for unknown Portal application routes so the browser router can resolve them.
- Do not rewrite `/api` or provider endpoint paths: their owning services handle those requests.
- `public/portal_config.json` is a public runtime configuration file. Its default `same-origin`
  value does not embed a sibling repository address or a secret.
- Vite development and local built-file preview include Portal-owned discovery at
  `/__portal/pilots`. On Linux the host probes listening loopback sockets using public Pilot APIs;
  it does not watch source files in preview mode. The existing `VITE_PILOT_PROXY_TARGET` is an
  explicit discovery candidate and legacy `/api` proxy, not the exclusive destination for managed
  multi-Pilot selection.
- Add comma-separated public Pilot base URLs with `PORTAL_PILOT_URLS` for other hosts or operating
  systems. Discovery does not scan arbitrary LAN addresses. It can report partial results or local
  socket-list errors; these are shown in the shell.
- The Robot Dock groups Controls by endpoint. A first visit auto-connects only to a sole Pilot;
  multiple instances require selection. `?pilot=<id>` pins the endpoint identity. Restarting Pilot
  at the same endpoint recovers automatically with a new session and fresh status; previous commands
  are never replayed. A missing endpoint stays unavailable and never switches to a different one.
  Legacy process-scoped selections require selecting the endpoint once after this update.
- Pilot changes unmount the old UI and load a new runtime before opening the destination. Old
  HTTP/session/query/stream state is not retargeted. All active-hold/in-flight selection locks apply
  to Home selection as well as the Dock.
- A generic static host without this middleware retains explicit `pilotBaseUrl` configuration and
  must provide its own API reverse proxy. Vite preview is the local built-file workflow, not a
  production hosting/security service.
