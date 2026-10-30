import { describe, expect, it } from "vitest";
import {
  choosePilotId,
  getPilotRobotKey,
  parsePilotDirectory,
  withPilotScope,
  type PilotDirectory
} from "./pilot_directory";

const pilot = {
  pilot_id: "a".repeat(24),
  endpoint: "http://127.0.0.1:12345",
  server_instance_id: "instance-a",
  control_ids: ["control.same"]
};
const directory: PilotDirectory = {
  schema_version: 1,
  pilots: [pilot],
  partial: false,
  discovery_error: null
};

describe("Pilot selection identity", () => {
  it("connects a first visit only to a sole Pilot and retains missing explicit/saved selections", () => {
    expect(choosePilotId(directory, null, null)).toBe(pilot.pilot_id);
    expect(choosePilotId({ ...directory, pilots: [] }, null, null)).toBeNull();
    expect(
      choosePilotId(
        {
          ...directory,
          pilots: [pilot, { ...pilot, pilot_id: "b".repeat(24) }]
        },
        null,
        null
      )
    ).toBeNull();
    expect(choosePilotId(directory, "missing-explicit", null)).toBe(
      "missing-explicit"
    );
    expect(choosePilotId(directory, null, "missing-saved")).toBe(
      "missing-saved"
    );
  });
  it("distinguishes identical Control IDs and preserves route/query/hash when selecting a Pilot", () => {
    expect(getPilotRobotKey("pilot-a", "control.same")).not.toBe(
      getPilotRobotKey("pilot-b", "control.same")
    );
    expect(
      withPilotScope(
        "/robots/control.same/operation?device=cam#scene",
        "pilot-b"
      )
    ).toBe("/robots/control.same/operation?device=cam&pilot=pilot-b#scene");
  });
  it("rejects HTML/invalid catalogs rather than treating them as live Pilot metadata", () => {
    expect(parsePilotDirectory(directory)).toEqual(directory);
    expect(() => parsePilotDirectory("<html />")).toThrow();
    expect(() =>
      parsePilotDirectory({
        ...directory,
        pilots: [{ ...pilot, pilot_id: "bad" }]
      })
    ).toThrow();
  });
});

it("requires selection when discovery is partial even if only one Pilot has responded", () => {
  expect(choosePilotId({ ...directory, partial: true }, null, null)).toBeNull();
  expect(
    choosePilotId(
      { ...directory, discovery_error: "socket catalog unavailable" },
      null,
      null
    )
  ).toBeNull();
});
