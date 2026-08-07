import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTAL_CONFIG,
  loadPortalConfig,
  parsePortalConfig
} from "./portal_config";

describe("parsePortalConfig", () => {
  it("uses same-origin defaults for omitted optional fields", () => {
    expect(parsePortalConfig({})).toEqual(DEFAULT_PORTAL_CONFIG);
  });

  it("accepts an explicit public HTTPS Pilot endpoint", () => {
    expect(
      parsePortalConfig({
        pilotBaseUrl: "https://pilot.example.test",
        portalLabel: "Research Portal"
      })
    ).toEqual({
      pilot_base_url: "https://pilot.example.test",
      portal_label: "Research Portal"
    });
  });

  it("rejects a sibling-relative deployment URL", () => {
    expect(() => parsePortalConfig({ pilotBaseUrl: "../nodus-pilot" })).toThrow(
      "pilotBaseUrl"
    );
  });
});

describe("loadPortalConfig", () => {
  it("uses the same-origin defaults when the optional file is absent", async () => {
    const config = await loadPortalConfig(
      async () => new Response(null, { status: 404 })
    );

    expect(config).toEqual(DEFAULT_PORTAL_CONFIG);
  });
});
