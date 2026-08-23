import { describe, expect, it } from "vitest";
import { PilotOperationClient } from "./pilot_operation_client";

const context = {
  session_id: "opaque",
  generation: 0,
  sequence: 1,
  source_timestamp_ns: 1_000,
  request_id: "request-1"
};

function operationResult(
  outcome: "response_received" | "written_unconfirmed" = "response_received"
) {
  return {
    schema_version: 1 as const,
    request_id: "request-1",
    operation: "control.move_joint_online" as const,
    control_id: "control-a",
    pilot_disposition: "forwarded" as const,
    delivery: { outcome, connection_generation: 1 },
    control_outcome: { status: "accepted" as const, code: null, message: null },
    result: null,
    error: null
  };
}

describe("PilotOperationClient", () => {
  it.each([
    [200, operationResult(), "accepted"],
    [202, operationResult("written_unconfirmed"), "written_unconfirmed"],
    [
      409,
      { error: { code: "rejected", message: "no" }, snapshot: {} },
      "rejected"
    ],
    [
      404,
      { error: { code: "not_found", message: "gone" }, snapshot: {} },
      "rejected"
    ],
    [
      503,
      { error: { code: "unavailable", message: "busy" }, snapshot: {} },
      "unavailable"
    ]
  ] as const)(
    "presents typed HTTP %s result truthfully",
    async (status, body, expected) => {
      const client = new PilotOperationClient(
        { reserveOperation: () => context } as never,
        { submitOperation: async () => ({ status, body }) } as never
      );
      await expect(
        client.submit({
          operation: "control.move_joint_online",
          control_id: "control-a",
          target_position: [0, 0, 0, 0, 0, 0]
        })
      ).resolves.toMatchObject({ state: expected });
    }
  );

  it("invalidates a lost session and never retries the mutation", async () => {
    let invalidated = 0;
    const client = new PilotOperationClient(
      {
        reserveOperation: () => context,
        invalidate: () => {
          invalidated += 1;
        }
      } as never,
      {
        submitOperation: async () => ({
          status: 409,
          body: {
            error: { code: "unknown_session", message: "expired" },
            snapshot: {}
          }
        })
      } as never
    );
    await client.submit({
      operation: "control.move_task_online",
      control_id: "control-a",
      target_position: [0, 0, 0, 0, 0, 0, 0],
      target_id: 3,
      reference_id: 0
    });
    expect(invalidated).toBe(1);
  });

  it.each([
    [
      {
        operation: "control.move_task_online" as const,
        control_id: "control-a",
        target_position: [0, 0, 0, 0, 0, 1, 0],
        target_id: 3,
        reference_id: 0
      },
      {
        operation: "control.move_task_online",
        payload: {
          target_position: [0, 0, 0, 0, 0, 1, 0],
          target_id: 3,
          reference_id: 0
        }
      }
    ],
    [
      {
        operation: "control.set_servo_state" as const,
        control_id: "control-a",
        enabled: true
      },
      { operation: "control.set_servo_state", payload: { enabled: true } }
    ],
    [
      { operation: "control.reset_fault" as const, control_id: "control-a" },
      { operation: "control.reset_fault", payload: {} }
    ],
    [
      {
        operation: "control.set_brake_state" as const,
        control_id: "control-a",
        released: false
      },
      { operation: "control.set_brake_state", payload: { released: false } }
    ]
  ])(
    "encodes robot command %s through the public operation contract",
    async (target, expected) => {
      let submitted: unknown = null;
      const client = new PilotOperationClient(
        { reserveOperation: () => context } as never,
        {
          submitOperation: async (request: unknown) => {
            submitted = request;
            return {
              status: 202,
              body: operationResult("written_unconfirmed")
            };
          }
        } as never
      );

      await client.submit(target);

      expect(submitted).toMatchObject(expected);
    }
  );
});
