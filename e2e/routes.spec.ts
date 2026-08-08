import { expect, test } from "@playwright/test";

function createControlStatus(
  control_id: string,
  options: { available?: boolean; fresh?: boolean; stale?: boolean } = {}
) {
  const available = options.available ?? true;
  const fresh = options.fresh ?? true;
  const stale = options.stale ?? false;
  return {
    control_id,
    available,
    fresh,
    stale,
    age_ms: stale ? 1500 : 1,
    request_pending: false,
    connection_generation: 1,
    last_success_monotonic_ns: 1,
    last_failure_monotonic_ns: null,
    configured_polling_hz: 60,
    measured_polling_hz: 60,
    missed_poll_count: 0,
    timeout_count: 0,
    gateway_queue_high_watermark: 0,
    sample: {
      sample_sequence: 1,
      connection_generation: 1,
      source_timestamp_ns: 1,
      pilot_receive_monotonic_ns: 1,
      robot_state: {
        timestamp_ns: 1,
        real: { pos: [0, 0, 0, 0, 0, 0], vel: [], acc: [], torque: [] },
        desired: { pos: [0, 0, 0, 0, 0, 0], vel: [], acc: [], torque: [] },
        interface: {
          schema_version: 1,
          robot_type: "fixture",
          connected: available,
          dof: 6,
          servo_activated: false,
          brake_released: false,
          brake_state_source: "fixture",
          motion_gate_state: "fixture",
          motion_gate_reason: "",
          expected_wkc: 0,
          last_wkc: 0,
          last_error: ""
        },
        frames: []
      }
    }
  };
}

test("redirects the root route to Home", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute(
    "aria-current",
    "page"
  );
});

test("keeps robot-scoped pages unavailable when discovery is successfully empty", async ({
  page
}) => {
  await page.route(
    (url) => url.pathname === "/api/v1/pilot/streams",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ server_instance_id: "pilot-a", streams: [] })
      });
    }
  );

  await page.goto("/robots/control-alpha/jogging");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

  const jogging = page.getByRole("link", { name: "Jogging" });
  await expect(jogging).toHaveAttribute("aria-disabled", "true");
  await jogging.click();
  await expect(page).toHaveURL(/\/home$/);
});

test("renders stable multi-robot Home cards from public stream descriptors", async ({
  page
}) => {
  await page.route(
    (url) => url.pathname === "/api/v1/pilot/streams",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          server_instance_id: "pilot-a",
          streams: [
            {
              stream_id: "control.bravo.robot_status",
              owner: "pilot",
              control_id: "control-bravo",
              stream_kind: "robot_status",
              schema_id: "nodus.robot_status.v1",
              schema_version: 1,
              source_clock_domains: ["monotonic_same_host"],
              configured_production_hz: 60,
              retention_capacity: 64,
              recording_grade: true
            },
            {
              stream_id: "control.alpha.robot_status",
              owner: "pilot",
              control_id: "control-alpha",
              stream_kind: "robot_status",
              schema_id: "nodus.robot_status.v1",
              schema_version: 1,
              source_clock_domains: ["monotonic_same_host"],
              configured_production_hz: 60,
              retention_capacity: 64,
              recording_grade: true
            }
          ]
        })
      });
    }
  );

  await page.goto("/home");
  await expect(
    page.getByRole("region", { name: "Discovered robots" })
  ).toBeVisible();
  expect(
    await page
      .locator("[data-control-id]")
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute("data-control-id"))
      )
  ).toEqual(["control-alpha", "control-bravo"]);
  await expect(
    page.getByRole("link", { name: "Open Jogging" }).first()
  ).toHaveAttribute("href", "/robots/control-alpha/jogging");
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("keeps a Home card selection while sidebar navigation targets that Control", async ({
  page
}) => {
  await page.route(
    (url) => url.pathname === "/api/v1/pilot/streams",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          server_instance_id: "pilot-a",
          streams: [
            {
              stream_id: "control.alpha.robot_status",
              owner: "pilot",
              control_id: "control-alpha",
              stream_kind: "robot_status",
              schema_id: "nodus.robot_status.v1",
              schema_version: 1,
              source_clock_domains: ["monotonic_same_host"],
              configured_production_hz: 60,
              retention_capacity: 64,
              recording_grade: true
            }
          ]
        })
      });
    }
  );

  await page.goto("/home");
  const card = page.locator('[data-control-id="control-alpha"]');
  await card.click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(card).toHaveAttribute("data-selected", "true");
  await expect(page.getByRole("link", { name: "Devices" })).toHaveAttribute(
    "href",
    "/devices"
  );
});

test("keeps Devices global and redirects the legacy robot-scoped route", async ({
  page
}) => {
  await page.route(
    (url) => url.pathname === "/api/v1/pilot/streams",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ server_instance_id: "pilot-a", streams: [] })
      });
    }
  );

  await page.goto("/devices");
  await expect(page).toHaveURL(/\/devices$/);
  await expect(
    page.getByRole("heading", { name: "Device directory" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Devices" })).toHaveAttribute(
    "aria-current",
    "page"
  );

  await page.goto("/robots/control-alpha/device");
  await expect(page).toHaveURL(/\/devices$/);
});

test("builds the minimum-five-slot directory from public device records", async ({
  page
}) => {
  await page.route(
    (url) => url.pathname === "/api/v1/pilot/streams",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ server_instance_id: "pilot-a", streams: [] })
      });
    }
  );
  await page.route(
    (url) => url.pathname === "/api/v1/components",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          snapshot_revision: 1,
          components: [
            {
              component_id: "camera.top",
              instance_id: "camera.top.instance",
              component_type: "camera",
              session_generation: 1,
              capabilities: ["camera.stream.color.preview"],
              service_endpoints: {},
              state: { health: "ready", reason: null, details: {} },
              metadata: { display_name: "Top camera" },
              registered_at_ns: 1,
              last_heartbeat_ns: 1,
              expires_at_ns: 2,
              last_sequence: 1,
              clock_domain: "monotonic_same_host",
              available: true
            },
            {
              component_id: "operator.leader",
              instance_id: "operator.leader.instance",
              component_type: "input_source",
              session_generation: 1,
              capabilities: ["control.operation.v1"],
              service_endpoints: {},
              state: { health: "ready", reason: null, details: {} },
              metadata: {},
              registered_at_ns: 1,
              last_heartbeat_ns: 1,
              expires_at_ns: 2,
              last_sequence: 1,
              clock_domain: "monotonic_same_host",
              available: true
            }
          ]
        })
      });
    }
  );
  await page.route(
    (url) => url.pathname === "/api/v1/endpoints",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          server_instance_id: "pilot-a",
          catalog_revision: 1,
          endpoints: [],
          next_cursor: null
        })
      });
    }
  );

  await page.goto("/devices");
  const directory = page.getByRole("region", { name: "Device directory" });
  await expect(directory.getByRole("heading")).toHaveCount(5);
  await expect(
    directory.getByRole("heading", { name: "Top camera" })
  ).toBeVisible();
  await expect(
    directory.getByRole("heading", { name: "operator.leader" })
  ).toBeVisible();
  await expect(
    directory.getByRole("heading", { name: "Empty slot 1" })
  ).toBeVisible();
});

test("collapses the right-anchored Robot Dock without resizing main content", async ({
  page
}) => {
  await page.route(
    (url) => url.pathname === "/api/v1/pilot/streams",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          server_instance_id: "pilot-a",
          streams: [
            {
              stream_id: "control.alpha.robot_status",
              owner: "pilot",
              control_id: "control-alpha",
              stream_kind: "robot_status",
              schema_id: "nodus.robot_status.v1",
              schema_version: 1,
              source_clock_domains: ["monotonic_same_host"],
              configured_production_hz: 60,
              retention_capacity: 64,
              recording_grade: true
            }
          ]
        })
      });
    }
  );

  await page.goto("/home");
  const dock = page.getByRole("complementary", {
    name: "Selected robot controls"
  });
  await expect(dock).toHaveAttribute("data-mode", "expanded");
  await expect(dock.getByLabel("Selected robot")).toHaveCount(1);
  await dock.getByLabel("Selected robot").selectOption("control-alpha");
  await expect(dock.getByRole("button", { name: "Servo On" })).toHaveCount(1);
  await expect(dock.getByRole("button", { name: "Fault Reset" })).toHaveCount(
    1
  );
  await expect(dock.getByRole("button", { name: "Release Brake" })).toHaveCount(
    1
  );
  const before = await page.getByTestId("portal-main-content").boundingBox();
  await dock.getByRole("button", { name: "Collapse robot controls" }).click();
  await expect(dock).toHaveAttribute("data-mode", "collapsed");
  await expect(dock.getByRole("button")).toHaveCount(1);
  const after = await page.getByTestId("portal-main-content").boundingBox();
  expect(after).toEqual(before);
});

test("defaults the Robot Dock to collapsed on phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/home");
  await expect(
    page.getByRole("complementary", { name: "Selected robot controls" })
  ).toHaveAttribute("data-mode", "collapsed");
});

test("switches a robot-scoped route without changing its page kind", async ({
  page
}) => {
  await page.route(
    (url) => url.pathname === "/api/v1/pilot/streams",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          server_instance_id: "pilot-a",
          streams: [
            {
              stream_id: "control.alpha.robot_status",
              owner: "pilot",
              control_id: "control-alpha",
              stream_kind: "robot_status",
              schema_id: "nodus.robot_status.v1",
              schema_version: 1,
              source_clock_domains: ["monotonic_same_host"],
              configured_production_hz: 60,
              retention_capacity: 64,
              recording_grade: true
            },
            {
              stream_id: "control.bravo.robot_status",
              owner: "pilot",
              control_id: "control-bravo",
              stream_kind: "robot_status",
              schema_id: "nodus.robot_status.v1",
              schema_version: 1,
              source_clock_domains: ["monotonic_same_host"],
              configured_production_hz: 60,
              retention_capacity: 64,
              recording_grade: true
            }
          ]
        })
      });
    }
  );

  await page.goto("/robots/control-alpha/operating");
  const dock = page.getByRole("complementary", {
    name: "Selected robot controls"
  });
  await dock.getByLabel("Selected robot").selectOption("control-bravo");
  await expect(page).toHaveURL(/\/robots\/control-bravo\/operating$/);
  await expect(
    page.getByTestId("portal-main-content").getByText("control-bravo", {
      exact: true
    })
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/robots\/control-alpha\/operating$/);
});

test("retains stale, offline, and removed selections without auto-switching", async ({
  page
}) => {
  await page.route(
    (url) => url.pathname === "/api/v1/pilot/streams",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          server_instance_id: "pilot-a",
          streams: [
            {
              stream_id: "control.alpha.robot_status",
              owner: "pilot",
              control_id: "control-alpha",
              stream_kind: "robot_status",
              schema_id: "nodus.robot_status.v1",
              schema_version: 1,
              source_clock_domains: ["monotonic_same_host"],
              configured_production_hz: 60,
              retention_capacity: 64,
              recording_grade: true
            },
            {
              stream_id: "control.bravo.robot_status",
              owner: "pilot",
              control_id: "control-bravo",
              stream_kind: "robot_status",
              schema_id: "nodus.robot_status.v1",
              schema_version: 1,
              source_clock_domains: ["monotonic_same_host"],
              configured_production_hz: 60,
              retention_capacity: 64,
              recording_grade: true
            }
          ]
        })
      });
    }
  );
  await page.route(/\/api\/v1\/controls\/[^/]+\/status$/, async (route) => {
    const control_id = route.request().url().split("/").at(-2);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        control_id === "control-alpha"
          ? createControlStatus(control_id, { fresh: false, stale: true })
          : createControlStatus(control_id ?? "unknown", { available: false })
      )
    });
  });

  await page.goto("/robots/control-alpha/operating");
  const dock = page.getByRole("complementary", {
    name: "Selected robot controls"
  });
  await expect(dock).toContainText("Status stale");
  await dock.getByLabel("Selected robot").selectOption("control-bravo");
  await expect(page).toHaveURL(/\/robots\/control-bravo\/operating$/);
  await expect(dock).toContainText("Offline");

  await page.goto("/robots/control-removed/operating");
  await expect(dock.getByLabel("Selected robot")).toHaveValue(
    "control-removed"
  );
  await expect(
    dock.getByRole("option", { name: /control-removed \(unavailable\)/ })
  ).toHaveCount(1);
});

test("uses black, light, and system themes without Dock motion under reduced motion", async ({
  page
}) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/home");
  await page.getByRole("button", { name: "Choose theme" }).click();
  await page.getByRole("menuitemradio", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Choose theme" }).click();
  await page.getByRole("menuitemradio", { name: "System" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "black");
  await expect(
    page.getByRole("complementary", { name: "Selected robot controls" })
  ).toHaveCSS("transition-duration", "0.001s");
});

test("captures Robot Dock expanded and collapsed desktop and phone states", async ({
  page
}, testInfo) => {
  await page.route(
    (url) => url.pathname === "/api/v1/pilot/streams",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          server_instance_id: "pilot-a",
          streams: [
            {
              stream_id: "control.alpha.robot_status",
              owner: "pilot",
              control_id: "control-alpha",
              stream_kind: "robot_status",
              schema_id: "nodus.robot_status.v1",
              schema_version: 1,
              source_clock_domains: ["monotonic_same_host"],
              configured_production_hz: 60,
              retention_capacity: 64,
              recording_grade: true
            }
          ]
        })
      });
    }
  );
  await page.route(
    /\/api\/v1\/controls\/control-alpha\/status$/,
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(createControlStatus("control-alpha"))
      });
    }
  );
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  const dock = page.getByRole("complementary", {
    name: "Selected robot controls"
  });
  await dock.getByLabel("Selected robot").selectOption("control-alpha");
  await expect(dock.getByRole("button", { name: "Servo On" })).toBeVisible();
  const [status_bounds, selector_bounds, servo_bounds] = await Promise.all([
    dock.getByText("Online", { exact: true }).boundingBox(),
    dock.getByLabel("Selected robot").boundingBox(),
    dock.getByRole("button", { name: "Servo On" }).boundingBox()
  ]);
  expect(status_bounds).not.toBeNull();
  expect(selector_bounds).not.toBeNull();
  expect(servo_bounds).not.toBeNull();
  expect(status_bounds!.x).toBeLessThan(selector_bounds!.x);
  expect(selector_bounds!.x).toBeLessThan(servo_bounds!.x);
  await page.screenshot({
    path: testInfo.outputPath("dock-desktop-expanded.png")
  });
  await dock.getByRole("button", { name: "Collapse robot controls" }).click();
  await page.screenshot({
    path: testInfo.outputPath("dock-desktop-collapsed.png")
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("dock-phone-collapsed.png")
  });
  await dock.getByRole("button", { name: "Expand robot controls" }).click();
  await expect(dock.getByRole("button", { name: "Servo On" })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("dock-phone-expanded.png")
  });
});

test("restores the direct Control-scoped Jogging route", async ({ page }) => {
  await page.goto("/robots/control-alpha/jogging");
  await expect(page.getByRole("heading", { name: "Jogging" })).toBeVisible();
  await expect(page.getByText("control-alpha", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Jogging" })).toHaveAttribute(
    "aria-current",
    "page"
  );
});

test("loads a selected Portal-owned robot profile only on the Jogging route", async ({
  page
}) => {
  await page.goto("/robots/control-alpha/jogging");
  await expect(page.locator("canvas")).toHaveCount(0);

  const loaded_meshes = new Set<string>();
  page.on("response", (response) => {
    if (
      response.status() === 200 &&
      response.url().includes("/official_erob_arm/")
    ) {
      loaded_meshes.add(response.url());
    }
  });

  const urdf = page.waitForResponse(
    (response) =>
      response.url().endsWith("/robots/e_rob/e_rob_3kg.urdf") &&
      response.status() === 200
  );
  await page.getByLabel("Visualization profile").selectOption("e_rob_3kg");
  await urdf;
  await expect.poll(() => loaded_meshes.size).toBe(7);
  await expect(page.getByLabel("eRob 3 kg visualization")).toBeVisible();

  const visualization_bounds = await page
    .getByLabel("eRob 3 kg visualization")
    .boundingBox();
  const controls_bounds = await page
    .getByLabel("Continuous jogging controls")
    .boundingBox();
  const values_bounds = await page
    .getByRole("heading", { name: "Real-time values" })
    .boundingBox();
  expect(visualization_bounds).not.toBeNull();
  expect(controls_bounds).not.toBeNull();
  expect(values_bounds).not.toBeNull();
  if (
    visualization_bounds === null ||
    controls_bounds === null ||
    values_bounds === null
  )
    throw new Error("Jogging layout landmarks are unavailable.");
  expect(controls_bounds.x).toBeGreaterThan(visualization_bounds.x);
  expect(values_bounds.y).toBeGreaterThan(visualization_bounds.y);

  await page.goto("/home");
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("uses the route error surface for unknown paths and opens the mobile drawer", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/missing");
  await expect(
    page.getByRole("heading", { name: "Page not found" })
  ).toBeVisible();
  await page.goto("/home");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("dialog", { name: "Nodus Portal" })
  ).toBeVisible();
  await page.getByRole("link", { name: "Home" }).last().click();
  await expect(page.getByRole("dialog", { name: "Nodus Portal" })).toBeHidden();
});
