import { useState } from "react";
import { Button } from "../../components/actions/button";
import { useControlStatus } from "../../api/pilot/use_control_status";
import {
  createSchemaExample,
  isJsonObject,
  resolveSchema,
  type ApiSchema
} from "./api_catalog";
import { fieldsToPose, poseToFields, frameToPose } from "./command_values";
import styles from "../../pages/commands_page.module.css";

interface FieldProps {
  name: string;
  schema: ApiSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
  operation: string;
  control_id?: string;
}
const titles: Record<string, string> = {
  start: "Start",
  dest: "Destination",
  force: "Force / torque",
  stiffness: "Stiffness",
  damping_ratio: "Damping ratio (ζ)",
  linear_limit: "Linear limits",
  angular_limit: "Angular limits",
  velocity_limit: "Velocity limit",
  acceleration_limit: "Acceleration limit",
  jerk_limit: "Jerk limit",
  auto_play: "Run after preparation",
  frame_id: "Target frame ID",
  reference_id: "Reference frame ID",
  transition_time: "Transition time (s)"
};

export function CommandFields(props: FieldProps) {
  const schema = resolveSchema(props.schema);
  const branches = schema.oneOf ?? schema.anyOf;
  if (branches && branches.length > 1) {
    const current = branches.findIndex((item) => {
      const candidate = resolveSchema(item);
      return Array.isArray(props.value)
        ? candidate.type === "array" &&
            (candidate.minItems === undefined ||
              props.value.length >= candidate.minItems) &&
            ((candidate as ApiSchema & { maxItems?: number }).maxItems ===
              undefined ||
              props.value.length <=
                (candidate as ApiSchema & { maxItems: number }).maxItems)
        : isJsonObject(props.value)
          ? candidate.type === "object"
          : candidate.type === typeof props.value;
    });
    const index = current < 0 ? 0 : current;
    return (
      <div>
        <label className={styles.field}>
          {titles[props.name] ?? props.name} format
          <select
            disabled={props.disabled}
            value={index}
            onChange={(event) =>
              props.onChange(
                createSchemaExample(branches[Number(event.target.value)])
              )
            }
          >
            {branches.map((item, i) => {
              const candidate = resolveSchema(item);
              return (
                <option value={i} key={i}>
                  {candidate.title ??
                    (candidate.type === "array"
                      ? `${candidate.minItems ?? 0} values`
                      : `Option ${i + 1}`)}
                </option>
              );
            })}
          </select>
        </label>
        <CommandFields {...props} schema={branches[index]} />
      </div>
    );
  }
  if (schema.properties || schema.type === "object") {
    const value = isJsonObject(props.value) ? props.value : {};
    const required = schema.required ?? [];
    const properties = schema.properties ?? {};
    return (
      <div className={styles.payload_fields}>
        {Object.keys(properties)
          .filter((name) => required.includes(name) || name in value)
          .map((name) => (
            <CommandFields
              key={name}
              {...props}
              name={name}
              schema={properties[name]}
              value={value[name]}
              onChange={(next) => props.onChange({ ...value, [name]: next })}
            />
          ))}
        {Object.keys(properties).some(
          (name) => !required.includes(name) && !(name in value)
        ) ? (
          <details className={styles.details}>
            <summary>Optional values</summary>
            {Object.keys(properties)
              .filter((name) => !required.includes(name) && !(name in value))
              .map((name) => (
                <Button
                  key={name}
                  tone="secondary"
                  disabled={props.disabled}
                  onClick={() =>
                    props.onChange({
                      ...value,
                      [name]: createSchemaExample(properties[name])
                    })
                  }
                >
                  Add {titles[name] ?? name}
                </Button>
              ))}
          </details>
        ) : null}
      </div>
    );
  }
  if (
    Array.isArray(props.value) &&
    props.value.every((value) => typeof value === "number")
  )
    return <NumericVector {...props} value={props.value as number[]} />;
  if (
    props.control_id &&
    ["frame_id", "reference_id", "target_id"].includes(props.name)
  )
    return <FrameValue {...props} control_id={props.control_id} />;
  const title = titles[props.name] ?? props.name.replaceAll("_", " ");
  if (schema.enum)
    return (
      <label className={styles.field}>
        {title}
        <select
          disabled={props.disabled}
          value={String(props.value)}
          onChange={(event) =>
            props.onChange(
              schema.enum!.find((value) => String(value) === event.target.value)
            )
          }
        >
          {schema.enum.map((value) => (
            <option value={String(value)} key={String(value)}>
              {String(value)}
            </option>
          ))}
        </select>
      </label>
    );
  if (typeof props.value === "boolean")
    return (
      <label className={styles.session_option}>
        <input
          type="checkbox"
          checked={props.value}
          disabled={props.disabled}
          onChange={(event) => props.onChange(event.target.checked)}
        />
        {title}
      </label>
    );
  if (typeof props.value === "object") return <JsonValue {...props} />;
  return (
    <label className={styles.field}>
      {title}
      <input
        disabled={props.disabled || schema.const !== undefined}
        type={
          schema.type === "number" || schema.type === "integer"
            ? "number"
            : "text"
        }
        step={schema.type === "integer" ? "1" : "any"}
        value={String(props.value ?? "")}
        onChange={(event) =>
          props.onChange(
            schema.type === "number" || schema.type === "integer"
              ? Number(event.target.value)
              : event.target.value
          )
        }
      />
    </label>
  );
}

function NumericVector(props: FieldProps & { value: number[] }) {
  const joint =
    props.operation.includes("joint") &&
    [
      "start",
      "dest",
      "target_position",
      "velocity_limit",
      "acceleration_limit",
      "jerk_limit"
    ].includes(props.name);
  const pose =
    ["start", "dest", "pose"].includes(props.name) &&
    props.value.length === 7 &&
    !joint;
  const angular = props.name === "angular_limit";
  const [per_joint, setPerJoint] = useState(
    !props.value.every((value) => value === props.value[0])
  );
  const uniform_limit = joint && props.name.endsWith("_limit");
  const multiplier = joint || angular ? 180 / Math.PI : 1;
  const values = pose
    ? poseToFields(props.value)
    : props.value.map((value) => value * multiplier);
  const labels = pose
    ? [
        "X (m)",
        "Y (m)",
        "Z (m)",
        "Rz / yaw (deg)",
        "Ry / pitch (deg)",
        "Rx / roll (deg)"
      ]
    : props.name === "force"
      ? ["Fx (N)", "Fy (N)", "Fz (N)", "Tx (Nm)", "Ty (Nm)", "Tz (Nm)"]
      : props.name === "stiffness" && values.length === 6
        ? [
            "Kx (N/m)",
            "Ky (N/m)",
            "Kz (N/m)",
            "Krx (Nm/rad)",
            "Kry (Nm/rad)",
            "Krz (Nm/rad)"
          ]
        : props.name === "inertia" &&
            props.operation === "control.set_force" &&
            values.length === 6
          ? [
              "Mx (kg)",
              "My (kg)",
              "Mz (kg)",
              "Ix (kg·m²)",
              "Iy (kg·m²)",
              "Iz (kg·m²)"
            ]
          : props.name === "linear_limit"
            ? ["Velocity (m/s)", "Acceleration (m/s²)", "Jerk (m/s³)"]
            : angular
              ? ["Velocity (deg/s)", "Acceleration (deg/s²)", "Jerk (deg/s³)"]
              : values.map((_, index) =>
                  joint
                    ? `J${index + 1} (${props.name === "velocity_limit" ? "deg/s" : props.name === "acceleration_limit" ? "deg/s²" : props.name === "jerk_limit" ? "deg/s³" : "deg"})`
                    : `${index + 1}`
                );
  const shown = uniform_limit && !per_joint ? values.slice(0, 1) : values;
  return (
    <fieldset className={styles.vector}>
      <legend>
        {props.name === "inertia" && props.operation === "control.set_force"
          ? "Added virtual mass"
          : (titles[props.name] ?? props.name.replaceAll("_", " "))}
      </legend>
      {uniform_limit ? (
        <label className={styles.session_option}>
          <input
            type="checkbox"
            checked={per_joint}
            disabled={props.disabled}
            onChange={(event) => setPerJoint(event.target.checked)}
          />
          Per-joint limits
        </label>
      ) : null}
      <div className={styles.vector_grid}>
        {shown.map((value, index) => (
          <label className={styles.field} key={index}>
            {uniform_limit && !per_joint
              ? `All joints (${props.name === "velocity_limit" ? "deg/s" : props.name === "acceleration_limit" ? "deg/s²" : "deg/s³"})`
              : labels[index]}
            <input
              type="number"
              step="any"
              disabled={props.disabled}
              value={Number(value.toFixed(8))}
              onChange={(event) => {
                const next = [...values];
                const number = Number(event.target.value);
                if (uniform_limit && !per_joint) next.fill(number);
                else next[index] = number;
                props.onChange(
                  pose
                    ? fieldsToPose(next)
                    : next.map((item) => item / multiplier)
                );
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function JsonValue(props: FieldProps) {
  const [draft, setDraft] = useState(JSON.stringify(props.value, null, 2));
  const [error, setError] = useState<string | null>(null);
  return (
    <label className={styles.field}>
      {props.name}
      <textarea
        rows={4}
        disabled={props.disabled}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          try {
            props.onChange(JSON.parse(draft));
            setError(null);
          } catch {
            setError("Enter valid JSON.");
          }
        }}
      />
      {error ? (
        <span role="alert" className={styles.error}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function CurrentCommandState({
  control_id,
  operation,
  payload,
  disabled,
  onChange
}: {
  control_id: string;
  operation: string;
  payload: Record<string, unknown>;
  disabled: boolean;
  onChange: (payload: Record<string, unknown>) => void;
}) {
  const snapshot = useControlStatus(control_id);
  const state =
    snapshot.state === "live" &&
    snapshot.status?.fresh &&
    !snapshot.status.stale
      ? snapshot.status.sample?.robot_state
      : undefined;
  const joint =
    operation.includes("joint") &&
    [
      "control.move_joint_request",
      "control.move_joint_online",
      "control.move_joint_offline"
    ].includes(operation);
  const cartesian = [
    "control.move_linear_request",
    "control.move_circle_request"
  ].includes(operation);
  const frame = state?.frames.find((item) => item.id === payload.frame_id);
  if (!joint && !cartesian) return null;
  return (
    <div className={styles.current_state}>
      <Button
        tone="secondary"
        disabled={
          disabled ||
          !state ||
          (cartesian && (!frame || payload.reference_id !== 0))
        }
        onClick={() => {
          if (!state) return;
          if (joint) {
            const position = [...state.real.pos];
            if (operation === "control.move_joint_request") {
              const next = { ...payload, start: position, dest: [...position] };
              for (const key of [
                "velocity_limit",
                "acceleration_limit",
                "jerk_limit"
              ]) {
                const values = payload[key] as number[];
                (next as Record<string, unknown>)[key] = Array.from(
                  { length: position.length },
                  (_, i) => values[i] ?? values[0]
                );
              }
              onChange(next);
            } else onChange({ ...payload, target_position: position });
          } else if (frame) {
            const pose = frameToPose(frame);
            if (pose) onChange({ ...payload, start: pose, dest: [...pose] });
          }
        }}
      >
        {joint ? "Use current joint position" : "Use current frame pose"}
      </Button>
      <span className={styles.hint}>
        {joint
          ? "Fills the start and destination from fresh feedback."
          : "Current pose loading uses the target frame with world reference (0)."}
      </span>
    </div>
  );
}

function FrameValue(props: FieldProps & { control_id: string }) {
  const snapshot = useControlStatus(props.control_id);
  const frames =
    snapshot.state === "live" &&
    snapshot.status?.fresh &&
    !snapshot.status.stale
      ? (snapshot.status.sample?.robot_state.frames ?? [])
      : [];
  const reference = props.name === "reference_id";
  const choices = frames.filter(
    (frame) => frame.id > 0 && (reference || frame.parent_link_id > 0)
  );
  const value = Number(props.value ?? 0);
  return (
    <label className={styles.field}>
      {reference ? "Reference frame" : "Target frame"}
      <select
        disabled={props.disabled || props.schema.const !== undefined}
        value={value}
        onChange={(event) => props.onChange(Number(event.target.value))}
      >
        {reference ? <option value={0}>World (0)</option> : null}
        {!choices.some((frame) => frame.id === value) &&
        !(reference && value === 0) ? (
          <option value={value}>Frame {value}</option>
        ) : null}
        {choices.map((frame) => (
          <option value={frame.id} key={frame.id}>
            {frame.name} ({frame.id})
          </option>
        ))}
      </select>
    </label>
  );
}
