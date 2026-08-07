# Static hosting

Build Portal with `npm run build` and serve the generated `dist/` directory from a static host.

- Return `index.html` for unknown Portal application routes so the browser router can resolve them.
- Do not rewrite `/api` or provider endpoint paths: their owning services handle those requests.
- `public/portal_config.json` is a public runtime configuration file. Its default `same-origin`
  value does not embed a sibling repository address or a secret.
- In development only, set `VITE_PILOT_PROXY_TARGET` to an explicit Pilot HTTP origin to enable the
  Vite `/api` proxy. There is intentionally no guessed default port.
