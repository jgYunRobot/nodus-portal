import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Braces, Search, Send, Square } from "lucide-react";
import { Button } from "../components/actions/button";
import { getPortalConfig } from "../config/portal_config";
import {
  usePortalOperationRuntime,
  useRobotSelectionLocked
} from "../features/operations/portal_operation_context";
import { useRobotStatusStreams } from "../api/pilot/pilot_queries";
import {
  getCommandLabel,
  createCommandExample,
  setCommandPayload
} from "../features/api_explorer/command_values";
import {
  CommandFields,
  CurrentCommandState
} from "../features/api_explorer/command_fields";
import { useRobotDockState } from "../shell/robot_dock_state";
import { getEffectiveControlId } from "../shell/robot_route_selection";
import {
  api_document,
  api_endpoints,
  operation_schemas,
  createBodyExample,
  createRequestPath,
  isJsonObject,
  parseObject,
  resolveSchema,
  type ApiEndpoint,
  type ApiSchema
} from "../features/api_explorer/api_catalog";
import {
  sendApiRequest,
  type ApiResponse
} from "../features/api_explorer/api_request";
import styles from "./commands_page.module.css";

export function CommandsPage() {
  const [mode, setMode] = useState<"commands" | "http">("commands");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(api_endpoints[0]);
  const [selected_command, setSelectedCommand] = useState(
    "control.move_joint_request"
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const query = search.trim().toLowerCase();
  const featured = [
    "control.move_linear_request",
    "control.move_joint_request",
    "control.set_force"
  ];
  const commands = [...operation_schemas]
    .sort((a, b) => {
      const rank = (name: string) =>
        featured.includes(name) ? featured.indexOf(name) : featured.length;
      return rank(a.name) - rank(b.name);
    })
    .filter((item) =>
      `${getCommandLabel(item.name)} ${item.name}`.toLowerCase().includes(query)
    );
  const filtered = api_endpoints.filter((endpoint) =>
    `${endpoint.method} ${endpoint.path} ${endpoint.summary}`
      .toLowerCase()
      .includes(query)
  );
  const operation_endpoint = api_endpoints.find(
    (item) => item.path === "/api/v1/operations"
  )!;
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <h1>
            <Braces aria-hidden="true" /> Commands
          </h1>
          <p>
            Choose a command, enter its values, and run it on the selected
            Pilot.
          </p>
        </div>
        <span className={styles.version}>
          {operation_schemas.length} commands · Pilot API{" "}
          {api_document.info.version}
        </span>
      </header>
      <div
        className={styles.mode_buttons}
        role="group"
        aria-label="Command workspace mode"
      >
        <Button
          aria-pressed={mode === "commands"}
          tone={mode === "commands" ? "primary" : "secondary"}
          onClick={() => {
            setMode("commands");
            setSearch("");
          }}
        >
          Control commands
        </Button>
        <Button
          aria-pressed={mode === "http"}
          tone={mode === "http" ? "primary" : "secondary"}
          onClick={() => {
            setMode("http");
            setSearch("");
          }}
        >
          HTTP APIs
        </Button>
      </div>
      <div className={styles.workspace}>
        <aside
          className={styles.catalog}
          aria-label={
            mode === "commands" ? "Control commands" : "Pilot API endpoints"
          }
        >
          <label className={styles.search}>
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search commands"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                mode === "commands"
                  ? "moveL, moveJ, setForce…"
                  : "Search HTTP APIs"
              }
              type="search"
            />
          </label>
          <div className={styles.endpoint_list}>
            {mode === "commands"
              ? commands.map((item) => (
                  <button
                    type="button"
                    className={styles.endpoint}
                    key={item.name}
                    aria-label={`${getCommandLabel(item.name)} — ${item.name}`}
                    aria-pressed={item.name === selected_command}
                    onClick={() => setSelectedCommand(item.name)}
                  >
                    <span className={styles.command_item}>
                      <strong>{getCommandLabel(item.name)}</strong>
                      <small>{item.name}</small>
                    </span>
                  </button>
                ))
              : filtered.map((endpoint) => (
                  <button
                    type="button"
                    key={endpoint.id}
                    aria-label={`${endpoint.id} — ${endpoint.summary}`}
                    aria-pressed={endpoint.id === selected.id}
                    className={styles.endpoint}
                    onClick={() => setSelected(endpoint)}
                  >
                    <span
                      className={styles.method}
                      data-method={endpoint.method}
                    >
                      {endpoint.method}
                    </span>
                    <span>
                      <code>{endpoint.path.replace("/api/v1/", "")}</code>
                      <small>{endpoint.summary}</small>
                    </span>
                  </button>
                ))}
            {(mode === "commands" ? commands : filtered).length === 0 ? (
              <p className={styles.muted}>No matching commands or APIs.</p>
            ) : null}
          </div>
        </aside>
        {mode === "commands" ? (
          <ApiRequestEditor
            key={`command-${selected_command}`}
            endpoint={operation_endpoint}
            command_mode
            initial_operation={selected_command}
            initial_body={drafts[selected_command]}
            onDraftChange={(body) =>
              setDrafts((previous) => ({
                ...previous,
                [selected_command]: body
              }))
            }
          />
        ) : (
          <ApiRequestEditor key={selected.id} endpoint={selected} />
        )}
      </div>
    </div>
  );
}

function ApiRequestEditor({
  endpoint,
  initial_operation = "control.get_robot_status",
  command_mode = false,
  initial_body,
  onDraftChange
}: {
  endpoint: ApiEndpoint;
  initial_operation?: string;
  command_mode?: boolean;
  initial_body?: string;
  onDraftChange?: (body: string) => void;
}) {
  const runtime = usePortalOperationRuntime();
  const locked = useRobotSelectionLocked();
  const session = useSyncExternalStore(
    (listener) => runtime.session.subscribe(listener),
    () => runtime.session.getSnapshot(),
    () => runtime.session.getSnapshot()
  );
  const { preferred_control_id } = useRobotDockState();
  const control_id = getEffectiveControlId(undefined, preferred_control_id);
  const is_operation = endpoint.path === "/api/v1/operations";
  const [operation_name, setOperationName] = useState(initial_operation);
  const operation =
    operation_schemas.find((item) => item.name === operation_name) ??
    operation_schemas[0];
  const body_schema = is_operation ? operation.schema : endpoint.body_schema;
  const [automatic_session, setAutomaticSession] = useState(true);
  const [body, setBodyState] = useState(
    () =>
      initial_body ??
      (command_mode
        ? createCommandExample(operation.name, control_id)
        : body_schema
          ? createBodyExample(body_schema, control_id, is_operation)
          : "")
  );
  const setBody = (next: string) => {
    setBodyState(next);
    onDraftChange?.(next);
  };
  const streams = useRobotStatusStreams();
  const available_controls = [
    ...new Set(
      (streams.data?.streams ?? [])
        .filter((stream) => stream.stream_kind === "robot_status")
        .map((stream) => stream.control_id)
        .filter((id): id is string => typeof id === "string")
    )
  ];
  let body_object: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(body);
    if (isJsonObject(parsed)) body_object = parsed;
  } catch {
    /* Raw JSON can be incomplete while editing. */
  }
  const effective_control_id =
    (typeof body_object.control_id === "string"
      ? body_object.control_id
      : "") ||
    control_id ||
    (available_controls.length === 1 ? available_controls[0] : "");
  const payload = isJsonObject(body_object.payload) ? body_object.payload : {};

  const [parameters, setParameters] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      endpoint.parameters
        .filter((parameter) => parameter.in === "path")
        .map((parameter) => [
          parameter.name,
          parameter.name === "control_id" ? (control_id ?? "") : ""
        ])
    )
  );
  const [query, setQuery] = useState("{}");
  const [headers, setHeaders] = useState("{}");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [request_path, setRequestPath] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const config = getPortalConfig();
  const has_pilot = !config.pilot_discovery_enabled || config.pilot_id !== null;
  const mutating = endpoint.method !== "GET";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort("Request stopped after leaving the API.");
      controller.current = null;
    };
  }, []);

  function selectOperation(name: string) {
    const selected = operation_schemas.find((item) => item.name === name)!;
    setOperationName(name);
    setBody(createBodyExample(selected.schema, control_id, automatic_session));
    setResponse(null);
    setError(null);
  }

  function toggleSession(automatic: boolean) {
    try {
      const value = parseObject(body, "Request body");
      const fields: Record<string, unknown> = {
        request_id: "",
        session_id: "",
        generation: 0,
        sequence: 0,
        source_timestamp_ns: 0
      };
      for (const [name, default_value] of Object.entries(fields)) {
        if (automatic) delete value[name];
        else if (!(name in value)) value[name] = default_value;
      }
      setBody(JSON.stringify(value, null, 2));
      setAutomaticSession(automatic);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Invalid request JSON."
      );
    }
  }

  async function sendRequest() {
    if (controller.current) return;
    const active = new AbortController();
    let release: (() => void) | null = null;
    try {
      const path = createRequestPath(
        endpoint,
        parameters,
        parseObject(query, "Query")
      );
      const custom_headers = parseObject(headers, "Headers");
      for (const value of Object.values(custom_headers))
        if (typeof value !== "string")
          throw new Error("Header values must be strings.");
      let request_body: unknown = body_schema ? JSON.parse(body) : undefined;
      if (command_mode) {
        if (!effective_control_id) throw new Error("Select a Control.");
        if (!isJsonObject(request_body))
          throw new Error("Command request must be an object.");
        request_body = { ...request_body, control_id: effective_control_id };
      }
      if (mutating) {
        release = runtime.beginApiRequest(() =>
          active.abort("Portal session changed; local request stopped.")
        );
        if (!release)
          throw new Error(
            "Another command is in flight. Wait for it to finish."
          );
      }
      if (is_operation && automatic_session) {
        if (!isJsonObject(request_body))
          throw new Error("Operation request body must be a JSON object.");
        const context = runtime.session.reserveOperation();
        if (!context) throw new Error("The Portal session is not ready.");
        request_body = { ...request_body, ...context };
      }
      controller.current = active;
      setRequestPath(path);
      setResponse(null);
      setError(null);
      setNotice(null);
      setPending(true);
      await sendApiRequest(
        path,
        endpoint.method,
        custom_headers as Record<string, string>,
        request_body === undefined ? undefined : JSON.stringify(request_body),
        endpoint.streaming,
        active,
        (value) => {
          if (controller.current === active) setResponse(value);
        }
      );
    } catch (cause) {
      if (
        mounted.current &&
        (controller.current === active || controller.current === null)
      ) {
        const message = active.signal.aborted
          ? `${String(active.signal.reason ?? "Stopped locally.")}${mutating ? " The request may already have reached Pilot." : ""}`
          : cause instanceof Error
            ? cause.message
            : "API request failed.";
        if (
          active.signal.aborted &&
          active.signal.reason === "Stopped locally."
        )
          setNotice(endpoint.streaming ? "Stream stopped." : message);
        else setError(message);
      }
    } finally {
      release?.();
      if (controller.current === active) {
        controller.current = null;
        setPending(false);
      }
    }
  }

  return (
    <div className={styles.editor}>
      <section className={styles.panel} aria-labelledby="request-heading">
        <div className={styles.request_heading}>
          <span className={styles.method} data-method={endpoint.method}>
            {endpoint.method}
          </span>
          <h2 id="request-heading">
            {command_mode ? getCommandLabel(operation.name) : endpoint.path}
          </h2>
        </div>
        <p className={styles.muted}>
          {command_mode ? operation.name : endpoint.summary}
        </p>
        {!command_mode && endpoint.description ? (
          <p className={styles.muted}>{endpoint.description}</p>
        ) : null}
        {!has_pilot ? (
          <p role="status">
            Select a Pilot in the Robot Dock before sending a request.
          </p>
        ) : null}
        {endpoint.parameters
          .filter((parameter) => parameter.in === "path")
          .map((parameter) => (
            <label className={styles.field} key={parameter.name}>
              {parameter.name} <small>path · required</small>
              <input
                disabled={pending}
                value={parameters[parameter.name] ?? ""}
                onChange={(event) =>
                  setParameters({
                    ...parameters,
                    [parameter.name]: event.target.value
                  })
                }
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          ))}
        {is_operation && !command_mode ? (
          <>
            <label className={styles.field}>
              Control operation
              <select
                disabled={pending}
                value={operation.name}
                onChange={(event) => selectOperation(event.target.value)}
              >
                {operation_schemas.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.session_option}>
              <input
                type="checkbox"
                checked={automatic_session}
                disabled={pending}
                onChange={(event) => toggleSession(event.target.checked)}
              />
              Use current Portal session
            </label>
            <p className={styles.hint}>
              {automatic_session
                ? "Session, generation, sequence, request ID and timestamp are assigned when you send."
                : "Enter your own session and producer cursor in the request body."}
            </p>
          </>
        ) : null}
        {command_mode ? (
          <>
            <label className={styles.field}>
              Control
              {available_controls.length ? (
                <select
                  aria-label="Command Control"
                  disabled={pending}
                  value={effective_control_id}
                  onChange={(event) =>
                    setBody(
                      JSON.stringify(
                        { ...body_object, control_id: event.target.value },
                        null,
                        2
                      )
                    )
                  }
                >
                  <option value="">Select a Control</option>
                  {effective_control_id &&
                  !available_controls.includes(effective_control_id) ? (
                    <option value={effective_control_id}>
                      {effective_control_id}
                    </option>
                  ) : null}
                  {available_controls.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label="Command Control"
                  value={effective_control_id}
                  disabled={pending}
                  onChange={(event) =>
                    setBody(
                      JSON.stringify(
                        { ...body_object, control_id: event.target.value },
                        null,
                        2
                      )
                    )
                  }
                />
              )}
            </label>
            {effective_control_id &&
            [
              "control.move_joint_request",
              "control.move_joint_online",
              "control.move_joint_offline",
              "control.move_linear_request",
              "control.move_circle_request"
            ].includes(operation.name) ? (
              <CurrentCommandState
                key={effective_control_id}
                control_id={effective_control_id}
                operation={operation.name}
                payload={payload}
                disabled={pending}
                onChange={(next) => setBody(setCommandPayload(body, next))}
              />
            ) : null}
            <CommandFields
              control_id={effective_control_id}
              name="payload"
              operation={operation.name}
              schema={operation.schema.properties?.payload ?? {}}
              value={payload}
              disabled={pending}
              onChange={(next) => setBody(setCommandPayload(body, next))}
            />
            <p className={styles.hint}>
              Angles are entered in degrees; pose orientation uses Z-Y-X.
              Session fields are filled automatically.
            </p>
          </>
        ) : null}
        <details className={styles.details} open={!command_mode}>
          <summary>
            {command_mode ? "Advanced request JSON / HTTP" : "Request options"}
          </summary>
          <label className={styles.field}>
            Query parameters <small>JSON object</small>
            <textarea
              rows={3}
              value={query}
              disabled={pending}
              spellCheck={false}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <p className={styles.hint}>
            {endpoint.parameters
              .filter((parameter) => parameter.in === "query")
              .map(
                (parameter) =>
                  `${parameter.name}${parameter.required ? " (required)" : ""}`
              )
              .join(" · ") ||
              "Optional query parameters; leave {} when none are needed."}
          </p>
          {body_schema ? (
            <>
              {!command_mode ? (
                <ScalarFields
                  body={body}
                  schema={body_schema}
                  disabled={pending}
                  onChange={setBody}
                />
              ) : null}
              <label className={styles.field}>
                Request body{" "}
                <small>
                  JSON · vectors and nested values can be edited here
                </small>
                <textarea
                  className={styles.body}
                  rows={14}
                  value={body}
                  disabled={pending}
                  spellCheck={false}
                  onChange={(event) => setBody(event.target.value)}
                />
              </label>
              <details className={styles.details}>
                <summary>Request schema</summary>
                <pre>{JSON.stringify(resolveSchema(body_schema), null, 2)}</pre>
              </details>
            </>
          ) : null}
          <details className={styles.details}>
            <summary>Request headers</summary>
            <label className={styles.field}>
              Headers JSON
              <textarea
                rows={3}
                value={headers}
                disabled={pending}
                spellCheck={false}
                onChange={(event) => setHeaders(event.target.value)}
              />
            </label>
          </details>
        </details>
        <div className={styles.actions}>
          <Button
            disabled={
              !has_pilot ||
              pending ||
              (mutating && locked) ||
              (is_operation && automatic_session && session.phase !== "ready")
            }
            onClick={() => void sendRequest()}
          >
            <Send size={16} aria-hidden="true" />
            {command_mode
              ? `${payload.auto_play === false ? "Prepare" : "Run"} ${getCommandLabel(operation.name)}`
              : endpoint.streaming
                ? "Start stream"
                : "Send request"}
          </Button>
          {pending ? (
            <Button
              tone="secondary"
              onClick={() => controller.current?.abort("Stopped locally.")}
            >
              <Square size={14} aria-hidden="true" />
              {endpoint.streaming ? "Stop stream" : "Cancel request"}
            </Button>
          ) : null}
          <span className={styles.hint} role="status">
            {pending
              ? endpoint.streaming
                ? "Streaming…"
                : "Sending…"
              : "One request per click · no automatic retries"}
          </span>
        </div>
        {is_operation && automatic_session && session.phase !== "ready" ? (
          <p role="status">
            {session.last_error ?? "Waiting for the Portal session."}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className={styles.hint}>
            {notice}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
      </section>
      <section className={styles.panel} aria-labelledby="response-heading">
        <div className={styles.response_heading}>
          <h2 id="response-heading">Response</h2>
          {response ? (
            <span
              className={styles.response_status}
              data-error={(response.status ?? 500) >= 400}
            >
              HTTP {response.status} {response.status_text} ·{" "}
              {Math.round(response.elapsed_ms)} ms
            </span>
          ) : null}
        </div>
        {response ? (
          <>
            <code className={styles.request_path}>{request_path}</code>
            {response.truncated ? (
              <p className={styles.hint}>
                Display limited to 65,536 characters
                {endpoint.streaming ? "; showing the latest data" : ""}.
              </p>
            ) : null}
            <pre className={styles.response_body} aria-label="Response body">
              {response.body ||
                (pending ? "Waiting for data…" : "(empty body)")}
            </pre>
            <details className={styles.details}>
              <summary>Response headers</summary>
              <pre>{JSON.stringify(response.headers, null, 2)}</pre>
            </details>
          </>
        ) : (
          <p className={styles.empty}>
            The HTTP status and response will appear here after you send a
            request.
          </p>
        )}
      </section>
    </div>
  );
}

function ScalarFields({
  body,
  schema,
  disabled,
  onChange
}: {
  body: string;
  schema: ApiSchema;
  disabled: boolean;
  onChange: (body: string) => void;
}) {
  let value: Record<string, unknown>;
  try {
    value = parseObject(body, "Request body");
  } catch {
    return null;
  }
  const properties = resolveSchema(schema).properties ?? {};
  const fields = Object.entries(value)
    .flatMap(([name, item]) => {
      if (
        [
          "schema_version",
          "operation",
          "request_id",
          "session_id",
          "generation",
          "sequence",
          "source_timestamp_ns"
        ].includes(name)
      )
        return [];
      if (name === "payload" && isJsonObject(item)) {
        const payload_properties =
          resolveSchema(properties.payload ?? {}).properties ?? {};
        return Object.entries(item).map(([key, field_value]) => ({
          name: `payload.${key}`,
          value: field_value,
          schema: resolveSchema(payload_properties[key] ?? {}),
          key
        }));
      }
      return [
        {
          name,
          value: item,
          schema: resolveSchema(properties[name] ?? {}),
          key: name
        }
      ];
    })
    .filter((field) =>
      ["number", "string", "boolean"].includes(typeof field.value)
    );
  if (fields.length === 0) return null;
  return (
    <fieldset className={styles.values}>
      <legend>Values</legend>
      {fields.map((field) => {
        const update = (next: unknown) => {
          const updated = { ...value };
          if (field.name.startsWith("payload."))
            updated.payload = {
              ...(isJsonObject(value.payload) ? value.payload : {}),
              [field.key]: next
            };
          else updated[field.key] = next;
          onChange(JSON.stringify(updated, null, 2));
        };
        return (
          <label className={styles.field} key={field.name}>
            {field.name}
            {field.schema.enum ? (
              <select
                disabled={disabled}
                value={String(field.value)}
                onChange={(event) =>
                  update(
                    field.schema.enum!.find(
                      (item) => String(item) === event.target.value
                    )
                  )
                }
              >
                {field.schema.enum.map((item) => (
                  <option key={String(item)} value={String(item)}>
                    {String(item)}
                  </option>
                ))}
              </select>
            ) : typeof field.value === "boolean" ? (
              <select
                disabled={disabled}
                value={String(field.value)}
                onChange={(event) => update(event.target.value === "true")}
              >
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            ) : (
              <input
                disabled={disabled}
                type={typeof field.value === "number" ? "number" : "text"}
                step="any"
                value={String(field.value)}
                onChange={(event) =>
                  update(
                    typeof field.value === "number"
                      ? Number(event.target.value)
                      : event.target.value
                  )
                }
              />
            )}
          </label>
        );
      })}
    </fieldset>
  );
}
