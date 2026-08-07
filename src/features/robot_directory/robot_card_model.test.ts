import { describe, expect, it } from "vitest";
import type { ControlStatusSnapshot } from "../../api/pilot/pilot_stream_hub";
import { createRobotCardViewModel } from "./robot_card_model";

const entry = {
  control_id: "control-alpha",
  stream_id: "control.alpha.robot_status",
  schema_id: "nodus.robot_status.v1",
  server_instance_id: "pilot-a"
};

function snapshot(
  state: ControlStatusSnapshot["state"]
): ControlStatusSnapshot {
  return {
    control_id: "control-alpha",
    state,
    last_error: null,
    status: null
  };
}

describe("createRobotCardViewModel", () => {
  it("keeps an offline or malformed robot localized to its own card", () => {
    expect(createRobotCardViewModel(entry, snapshot("idle"))).toMatchObject({
      control_id: "control-alpha",
      status_label: "Awaiting status",
      tone: "neutral"
    });
    expect(
      createRobotCardViewModel(entry, snapshot("malformed"))
    ).toMatchObject({
      control_id: "control-alpha",
      status_label: "Unavailable",
      tone: "danger"
    });
  });
});
