import source from "../../../contracts/pilot/v1/openapi.yaml?raw";

export interface ApiSchema {
  $ref?: string;
  type?: string | string[];
  title?: string;
  description?: string;
  const?: unknown;
  default?: unknown;
  example?: unknown;
  enum?: unknown[];
  minimum?: number;
  minItems?: number;
  properties?: Record<string, ApiSchema>;
  required?: string[];
  items?: ApiSchema;
  oneOf?: ApiSchema[];
  anyOf?: ApiSchema[];
  allOf?: ApiSchema[];
}
export interface ApiParameter {
  $ref?: string;
  name: string;
  in: "path" | "query" | "header";
  required?: boolean;
  description?: string;
  schema?: ApiSchema;
}
interface ApiDocument {
  info: { title: string; version: string };
  paths: Record<
    string,
    Record<
      string,
      {
        summary?: string;
        description?: string;
        parameters?: ApiParameter[];
        requestBody?: { content?: Record<string, { schema?: ApiSchema }> };
        responses?: Record<string, { content?: Record<string, unknown> }>;
      }
    >
  >;
  components: {
    schemas: Record<string, ApiSchema>;
    parameters: Record<string, ApiParameter>;
  };
}
export interface ApiEndpoint {
  id: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  parameters: ApiParameter[];
  body_schema?: ApiSchema;
  streaming: boolean;
}
export const api_document = JSON.parse(source) as ApiDocument;

export function resolveSchema(schema: ApiSchema): ApiSchema {
  if (schema.$ref) {
    const name = schema.$ref.split("/").at(-1)!;
    const target = api_document.components.schemas[name];
    if (!target) throw new Error(`Unknown API schema: ${name}`);
    return resolveSchema(target);
  }
  if (schema.allOf) {
    const parts = schema.allOf.map(resolveSchema);
    return {
      ...schema,
      type: "object",
      properties: Object.assign({}, ...parts.map((part) => part.properties)),
      required: [...new Set(parts.flatMap((part) => part.required ?? []))]
    };
  }
  return schema;
}

export const api_endpoints: ApiEndpoint[] = Object.entries(
  api_document.paths
).flatMap(([path, methods]) =>
  Object.entries(methods)
    .filter(([method]) =>
      ["get", "post", "put", "patch", "delete"].includes(method)
    )
    .map(([method, operation]) => ({
      id: `${method.toUpperCase()} ${path}`,
      method: method.toUpperCase(),
      path,
      summary: operation.summary ?? path,
      description: operation.description ?? "",
      parameters: (operation.parameters ?? []).map((parameter) =>
        parameter.$ref
          ? api_document.components.parameters[
              parameter.$ref.split("/").at(-1)!
            ]
          : parameter
      ),
      body_schema: operation.requestBody?.content?.["application/json"]?.schema,
      streaming: Object.values(operation.responses ?? {}).some(
        (response) => response.content?.["text/event-stream"] !== undefined
      )
    }))
);

export const operation_schemas = (
  api_document.components.schemas.OperationRequest.oneOf ?? []
).map((schema) => {
  const resolved = resolveSchema(schema);
  return {
    name: String(resolved.properties?.operation?.const),
    schema: resolved
  };
});
const session_fields = [
  "request_id",
  "session_id",
  "generation",
  "sequence",
  "source_timestamp_ns"
];

export function createSchemaExample(schema: ApiSchema, depth = 0): unknown {
  if (depth > 12) return null;
  const value = resolveSchema(schema);
  if (value.const !== undefined) return value.const;
  if (value.example !== undefined) return value.example;
  if (value.default !== undefined) return value.default;
  if (value.enum) return value.enum[0];
  const branch = value.oneOf?.[0] ?? value.anyOf?.[0];
  if (branch) return createSchemaExample(branch, depth + 1);
  if (value.type === "object" || value.properties) {
    return Object.fromEntries(
      (value.required ?? []).map((name) => [
        name,
        createSchemaExample(value.properties?.[name] ?? {}, depth + 1)
      ])
    );
  }
  if (value.type === "array")
    return Array.from({ length: Math.min(value.minItems ?? 0, 128) }, () =>
      createSchemaExample(value.items ?? {}, depth + 1)
    );
  if (value.type === "boolean") return false;
  if (value.type === "integer" || value.type === "number")
    return value.minimum ?? 0;
  return "";
}

export function createBodyExample(
  schema: ApiSchema,
  control_id: string | null,
  automatic_session: boolean
): string {
  const body = createSchemaExample(schema);
  if (isJsonObject(body)) {
    if ("control_id" in body) body.control_id = control_id ?? "";
    if ("ttl_ms" in body) body.ttl_ms = 250;
    if (automatic_session && "operation" in body)
      for (const field of session_fields) delete body[field];
  }
  return JSON.stringify(body, null, 2);
}
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function parseObject(
  text: string,
  label: string
): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  if (!isJsonObject(value)) throw new Error(`${label} must be a JSON object.`);
  return value;
}

export function createRequestPath(
  endpoint: ApiEndpoint,
  parameters: Record<string, string>,
  query: Record<string, unknown>
): string {
  const path = endpoint.path.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = parameters[name]?.trim();
    if (!value) throw new Error(`Enter ${name}.`);
    return encodeURIComponent(value);
  });
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (typeof item === "object")
        throw new Error(
          `Query parameter ${name} must be a scalar or array of scalars.`
        );
      search.append(name, String(item));
    }
  }
  return path + (search.size ? `?${search}` : "");
}
