const SAME_ORIGIN = "same-origin";

export interface PortalConfig {
  pilot_base_url: string;
  portal_label: string;
}

interface RawPortalConfig {
  pilotBaseUrl?: unknown;
  portalLabel?: unknown;
}

export type ConfigFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export const DEFAULT_PORTAL_CONFIG: PortalConfig = {
  pilot_base_url: SAME_ORIGIN,
  portal_label: "Nodus Portal"
};

let active_portal_config = DEFAULT_PORTAL_CONFIG;

export function configurePortalConfig(config: PortalConfig): void {
  active_portal_config = config;
}

export function getPortalConfig(): PortalConfig {
  return active_portal_config;
}

export async function loadPortalConfig(
  fetch_config: ConfigFetch = fetch
): Promise<PortalConfig> {
  const response = await fetch_config("/portal_config.json", {
    cache: "no-store"
  });
  if (response.status === 404) {
    return DEFAULT_PORTAL_CONFIG;
  }
  if (!response.ok) {
    throw new Error(
      `Portal configuration request failed with HTTP ${response.status}.`
    );
  }

  return parsePortalConfig(await response.json());
}

export function parsePortalConfig(value: unknown): PortalConfig {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Portal configuration must be an object.");
  }

  const config = value as RawPortalConfig;
  const pilot_base_url = config.pilotBaseUrl ?? SAME_ORIGIN;
  const portal_label = config.portalLabel ?? "Nodus Portal";
  if (
    typeof pilot_base_url !== "string" ||
    !isAllowedPilotBaseUrl(pilot_base_url)
  ) {
    throw new Error(
      "Portal configuration field pilotBaseUrl must be same-origin or an absolute URL."
    );
  }
  if (typeof portal_label !== "string" || portal_label.trim().length === 0) {
    throw new Error(
      "Portal configuration field portalLabel must be a non-empty string."
    );
  }

  return { pilot_base_url, portal_label };
}

function isAllowedPilotBaseUrl(value: string): boolean {
  if (value === SAME_ORIGIN) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
