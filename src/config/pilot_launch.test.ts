import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePilotLaunch } from "./pilot_launch";
import { DEFAULT_PORTAL_CONFIG } from "./portal_config";

afterEach(() => vi.restoreAllMocks());
const location = { origin: "http://portal.test", search: "" };
const id = "a".repeat(24);
const response = () =>
  Promise.resolve(
    new Response(
      JSON.stringify({
        schema_version: 1,
        pilots: [
          {
            pilot_id: id,
            endpoint: "http://127.0.0.1:32123",
            server_instance_id: "instance-a",
            control_ids: ["control.same"]
          }
        ],
        partial: false,
        discovery_error: null
      })
    )
  );

describe("Pilot launch configuration", () => {
  it("selects a discovered Pilot before clients are constructed", async () => {
    expect(
      await resolvePilotLaunch(DEFAULT_PORTAL_CONFIG, location, response, null)
    ).toMatchObject({
      pilot_id: id,
      pilot_discovery_enabled: true,
      pilot_base_url: `http://portal.test/__portal/pilots/${id}/`
    });
  });
  it("does not redirect a missing explicit/saved Pilot to another instance", async () => {
    expect(
      await resolvePilotLaunch(
        DEFAULT_PORTAL_CONFIG,
        { ...location, search: "?pilot=missing" },
        response,
        null
      )
    ).toMatchObject({
      pilot_id: "missing",
      pilot_base_url: "http://portal.test/__portal/pilots/missing/"
    });
    expect(
      await resolvePilotLaunch(
        DEFAULT_PORTAL_CONFIG,
        location,
        response,
        "previous"
      )
    ).toMatchObject({ pilot_id: "previous" });
  });
  it("keeps explicit configuration on older static hosts and never falls back for a scoped URL", async () => {
    const missing = async () => new Response(null, { status: 404 });
    expect(
      await resolvePilotLaunch(DEFAULT_PORTAL_CONFIG, location, missing, null)
    ).toBe(DEFAULT_PORTAL_CONFIG);
    expect(
      await resolvePilotLaunch(
        DEFAULT_PORTAL_CONFIG,
        { ...location, search: "?pilot=old" },
        missing,
        null
      )
    ).toMatchObject({ pilot_id: "old" });
  });
});

it("does not fall back to the physical proxy after invalid JSON metadata or host failure", async () => {
  expect(
    await resolvePilotLaunch(
      DEFAULT_PORTAL_CONFIG,
      location,
      async () => Response.json({ broken: true }),
      null
    )
  ).toMatchObject({ pilot_discovery_enabled: true, pilot_id: null });
  expect(
    await resolvePilotLaunch(
      DEFAULT_PORTAL_CONFIG,
      location,
      async () => new Response(null, { status: 503 }),
      null
    )
  ).toMatchObject({ pilot_discovery_enabled: true, pilot_id: null });
});

it("requests the selected address when discovery deduplicates process aliases", async () => {
  const fetch_directory = vi.fn<typeof fetch>(response);
  await resolvePilotLaunch(
    DEFAULT_PORTAL_CONFIG,
    { ...location, search: `?pilot=${id}` },
    fetch_directory,
    null
  );
  expect(fetch_directory.mock.calls[0]?.[0]).toBe(
    `/__portal/pilots?pilot=${id}`
  );
});
