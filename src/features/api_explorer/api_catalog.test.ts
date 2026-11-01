import { describe, expect, it } from "vitest";
import {
  api_endpoints,
  api_document,
  operation_schemas,
  createBodyExample,
  createRequestPath,
  parseObject
} from "./api_catalog";

describe("Pilot API catalog", () => {
  it("exposes current operations absent from the old Portal contract", () => {
    expect(api_document.info.version).toBe("1.11.0");
    expect(operation_schemas.map((item) => item.name)).toEqual(
      expect.arrayContaining([
        "control.set_ik_mode",
        "control.set_force",
        "control.detach_rigid_body",
        "control.select_external_frame"
      ])
    );
    expect(api_endpoints.filter((endpoint) => endpoint.streaming)).toHaveLength(
      3
    );
    expect(
      api_endpoints.find((endpoint) =>
        endpoint.path.endsWith("/endpoint-catalog")
      )?.method
    ).toBe("PUT");
  });
  it("creates IK input with automatic transport fields omitted and manual fields retained", () => {
    const schema = operation_schemas.find(
      (item) => item.name === "control.set_ik_mode"
    )!.schema;
    const automatic = JSON.parse(createBodyExample(schema, "control-b", true));
    expect(automatic).toMatchObject({
      control_id: "control-b",
      operation: "control.set_ik_mode",
      ttl_ms: 250,
      payload: { mode: "dls" }
    });
    expect(automatic).not.toHaveProperty("session_id");
    expect(
      JSON.parse(createBodyExample(schema, "control-b", false))
    ).toHaveProperty("sequence");
  });
  it("creates fixed-size force vectors and a selected Control", () => {
    const schema = operation_schemas.find(
      (item) => item.name === "control.set_force"
    )!.schema;
    const body = JSON.parse(createBodyExample(schema, "control-b", true));
    expect(body.payload.force).toHaveLength(6);
    expect(body.payload.stiffness).toHaveLength(6);
    expect(body.control_id).toBe("control-b");
  });
  it("escapes path values and preserves repeated query values without allowing URL replacement", () => {
    const endpoint = api_endpoints.find((item) =>
      item.path.endsWith("/{stream_id}/samples")
    )!;
    expect(
      createRequestPath(
        endpoint,
        { stream_id: "a/b?other=x" },
        { stream_id: ["one", "two"], limit: 0 }
      )
    ).toBe(
      "/api/v1/pilot/streams/a%2Fb%3Fother%3Dx/samples?stream_id=one&stream_id=two&limit=0"
    );
    expect(() => createRequestPath(endpoint, {}, {})).toThrow(
      "Enter stream_id"
    );
    expect(() =>
      createRequestPath(endpoint, { stream_id: "a" }, { bad: {} })
    ).toThrow("scalar");
    expect(() => parseObject("[]", "Query")).toThrow("JSON object");
  });
});
