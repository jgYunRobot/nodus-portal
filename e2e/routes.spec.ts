import { expect, test } from "@playwright/test";

test("redirects the root route to Home", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute(
    "aria-current",
    "page"
  );
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
  await expect(page.getByRole("link", { name: "Device" })).toHaveAttribute(
    "href",
    "/robots/control-alpha/device"
  );
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
