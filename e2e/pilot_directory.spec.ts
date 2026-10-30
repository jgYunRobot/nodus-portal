import { expect, test } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";

function status(model: string) {
  return {
    control_id: "control.same",
    available: true,
    fresh: true,
    stale: false,
    age_ms: 1,
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
          robot_type: model,
          connected: true,
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

async function mockPilot(id: string) {
  const state = {
    id,
    available: true,
    open_streams: 0,
    registrations: 0,
    operations: [] as Record<string, unknown>[],
    delay_operation: false,
    release_operation: null as (() => void) | null
  };
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture.local").pathname;
    response.setHeader("Content-Type", "application/json");
    if (!state.available) {
      response.writeHead(503);
      response.end("{}");
      return;
    }
    if (path.endsWith("/status/stream")) {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache"
      });
      state.open_streams++;
      response.on("close", () => {
        state.open_streams--;
      });
      response.write(
        `event: robot_status\ndata: ${JSON.stringify(status(state.id))}\n\n`
      );
    } else if (path === "/api/v1/health")
      response.end(
        JSON.stringify({
          status: "ok",
          server_instance_id: state.id,
          revision: 1,
          readiness: {}
        })
      );
    else if (path === "/api/v1/pilot/streams")
      response.end(
        JSON.stringify({
          server_instance_id: state.id,
          streams: [
            {
              stream_id: "control.same.robot_status",
              owner: "pilot",
              control_id: "control.same",
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
      );
    else if (path.endsWith("/status"))
      response.end(JSON.stringify(status(state.id)));
    else if (path === "/api/v1/components/register") {
      state.registrations++;
      request.resume();
      response.writeHead(201);
      response.end(
        JSON.stringify({
          session_id: `${state.id}-session`,
          server_instance_id: state.id,
          accepted_protocol_version: 1,
          accepted_schema_versions: [1],
          heartbeat_interval_ms: 1000,
          lease_timeout_ms: 10000,
          server_time: 1_000_000_000
        })
      );
    } else if (request.method === "POST" && path === "/api/v1/operations") {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        const command = JSON.parse(body);
        state.operations.push(command);
        const complete = () =>
          response.end(
            JSON.stringify({
              schema_version: 1,
              request_id: command.request_id,
              operation: command.operation,
              control_id: command.control_id,
              pilot_disposition: "forwarded",
              control_outcome: { status: "accepted" }
            })
          );
        if (state.delay_operation) state.release_operation = complete;
        else complete();
      });
    } else if (request.method === "POST") {
      request.resume();
      response.end(
        JSON.stringify({
          status: "accepted",
          snapshot: { server_instance_id: state.id }
        })
      );
    } else if (path === "/api/v1/components")
      response.end(JSON.stringify({ components: [], snapshot_revision: 1 }));
    else if (path.startsWith("/api/v1/endpoints"))
      response.end(
        JSON.stringify({
          server_instance_id: state.id,
          catalog_revision: 1,
          endpoints: [],
          next_cursor: null
        })
      );
    else {
      response.writeHead(404);
      response.end("{}");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    id,
    server,
    endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    state
  };
}

async function closeServer(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

test("Select Robot isolates two real HTTP Pilot fixtures, routes commands, and closes old SSE", async ({
  page,
  request
}, test_info) => {
  const a = await mockPilot("fixture-pilot-a");
  const b = await mockPilot("fixture-pilot-b");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    let pilots: {
      pilot_id: string;
      server_instance_id: string;
      endpoint: string;
    }[] = [];
    await expect
      .poll(
        async () => {
          const directory = await (
            await request.get("/__portal/pilots")
          ).json();
          pilots = directory.pilots.filter(
            (p: { server_instance_id: string }) =>
              [a.id, b.id].includes(p.server_instance_id)
          );
          return pilots.length;
        },
        { timeout: 15000 }
      )
      .toBe(2);
    const pilot_a = pilots.find((p) => p.server_instance_id === a.id)!;
    const pilot_b = pilots.find((p) => p.server_instance_id === b.id)!;
    await page.route(
      (url) => url.pathname === "/__portal/pilots",
      async (route) => {
        const response = await route.fetch();
        const directory = await response.json();
        await route.fulfill({
          json: {
            ...directory,
            pilots: directory.pilots.filter(
              (p: { server_instance_id: string }) =>
                [a.id, b.id].includes(p.server_instance_id)
            )
          }
        });
      }
    );
    await page.goto("/home");
    const selector = page.getByLabel("Selected robot", { exact: true });
    await expect(selector.locator("optgroup")).toHaveCount(2);
    expect(a.state.registrations + b.state.registrations).toBe(0);
    await expect(
      page.getByRole("heading", { name: "Home", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Discovered robots" })
    ).toBeVisible();
    await page.screenshot({
      path: test_info.outputPath("multiple-pilots.png"),
      fullPage: true
    });
    await selector.selectOption(
      JSON.stringify([pilot_b.pilot_id, "control.same"])
    );
    await expect(page).toHaveURL(new RegExp(`pilot=${pilot_b.pilot_id}`));
    await expect(
      page
        .locator('[data-control-id="control.same"]')
        .getByText(b.id, { exact: true })
    ).toBeVisible();
    await expect.poll(() => b.state.open_streams).toBe(1);
    b.state.delay_operation = true;
    await page
      .getByRole("button", { name: "Fault Reset", exact: true })
      .click();
    await expect.poll(() => b.state.operations.length).toBe(1);
    await expect(selector).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Select robot", exact: true })
    ).toBeDisabled();
    expect(a.state.operations).toEqual([]);
    b.state.release_operation!();
    await expect(selector).toBeEnabled();
    await page.screenshot({
      path: test_info.outputPath("selected-pilot.png"),
      fullPage: true
    });
    await selector.selectOption(
      JSON.stringify([pilot_a.pilot_id, "control.same"])
    );
    await expect(page).toHaveURL(new RegExp(`pilot=${pilot_a.pilot_id}`));
    await expect(
      page
        .locator('[data-control-id="control.same"]')
        .getByText(a.id, { exact: true })
    ).toBeVisible();
    await expect.poll(() => b.state.open_streams).toBe(0);
    expect(b.state.operations).toHaveLength(1);
    await page.getByRole("link", { name: "Operation", exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`/robots/control.same/operation\\?pilot=${pilot_a.pilot_id}`)
    );
    await selector.selectOption(
      JSON.stringify([pilot_b.pilot_id, "control.same"])
    );
    await expect(page).toHaveURL(
      new RegExp(`/robots/control.same/operation\\?pilot=${pilot_b.pilot_id}`)
    );
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`pilot=${pilot_a.pilot_id}`));
    await expect(selector).toHaveValue(
      JSON.stringify([pilot_a.pilot_id, "control.same"])
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/home?pilot=${pilot_a.pilot_id}`);
    await expect(selector).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Home", exact: true })
    ).toBeVisible();
    await expect(
      page
        .locator('[data-control-id="control.same"]')
        .getByText(a.id, { exact: true })
    ).toBeVisible();
    await page.screenshot({
      path: test_info.outputPath("mobile-pilot-selector.png"),
      fullPage: true
    });
    expect(errors).toEqual([]);
  } finally {
    await page.goto("about:blank");
    await Promise.all([closeServer(a.server), closeServer(b.server)]);
  }
});

test("auto-connects a sole late Pilot but never replaces a missing explicit selection", async ({
  page,
  request
}) => {
  const pilot = await mockPilot("fixture-late-pilot");
  try {
    let selected: { pilot_id: string } | undefined;
    await expect
      .poll(
        async () => {
          const directory = await (
            await request.get("/__portal/pilots")
          ).json();
          selected = directory.pilots.find(
            (p: { server_instance_id: string }) =>
              p.server_instance_id === pilot.id
          );
          return selected !== undefined;
        },
        { timeout: 15000 }
      )
      .toBe(true);
    let publish = false;
    await page.route(
      (url) => url.pathname === "/__portal/pilots",
      async (route) => {
        const response = await route.fetch();
        const directory = await response.json();
        await route.fulfill({
          json: {
            ...directory,
            pilots: publish
              ? directory.pilots.filter(
                  (p: { server_instance_id: string }) =>
                    p.server_instance_id === pilot.id
                )
              : []
          }
        });
      }
    );
    await page.goto("/home");
    await expect(
      page.getByLabel("Selected robot", { exact: true })
    ).toHaveValue("");
    publish = true;
    await expect(page).toHaveURL(new RegExp(`pilot=${selected!.pilot_id}`), {
      timeout: 10000
    });
    const missing = "f".repeat(24);
    await page.goto(`/robots/control.same/operation?pilot=${missing}`);
    await expect(
      page.getByLabel("Selected robot", { exact: true })
    ).toHaveValue(JSON.stringify([missing, "control.same"]));
    await expect(
      page
        .getByLabel("Selected robot")
        .locator("option", { hasText: "Pilot unavailable" })
    ).toHaveCount(1);
    expect(page.url()).toContain(`pilot=${missing}`);
    expect(pilot.state.operations).toEqual([]);
  } finally {
    await page.goto("about:blank");
    await closeServer(pilot.server);
  }
});

test("recovers the selected Pilot after repeated restarts without accumulating streams or replaying commands", async ({
  page,
  request
}, test_info) => {
  test.setTimeout(90000);
  const pilot = await mockPilot("fixture-restart-before");
  const page_errors: string[] = [];
  let api_requests = 0;
  page.on("pageerror", (error) => page_errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/__portal/pilots"))
      api_requests++;
  });
  const cdp = await page.context().newCDPSession(page);
  const heaps: number[] = [];
  const request_counts: number[] = [];
  async function measureHeap() {
    await cdp.send("HeapProfiler.collectGarbage");
    const heap = await cdp.send("Runtime.getHeapUsage");
    heaps.push(heap.usedSize);
  }
  try {
    let selected: { pilot_id: string } | undefined;
    await expect
      .poll(
        async () => {
          const directory = await (
            await request.get("/__portal/pilots")
          ).json();
          selected = directory.pilots.find(
            (candidate: { endpoint: string }) =>
              candidate.endpoint === pilot.endpoint
          );
          return selected !== undefined;
        },
        { timeout: 15000 }
      )
      .toBe(true);
    const pilot_id = selected!.pilot_id;
    await page.goto(`/home?pilot=${pilot_id}`);
    const selector = page.getByLabel("Selected robot", { exact: true });
    await selector.selectOption(JSON.stringify([pilot_id, "control.same"]));
    const card = page.locator('[data-control-id="control.same"]');
    await expect(card.getByText(pilot.state.id, { exact: true })).toBeVisible();
    await expect.poll(() => pilot.state.registrations).toBeGreaterThan(0);
    const selected_url = page.url();
    await measureHeap();
    for (let cycle = 0; cycle < 5; cycle++) {
      const registrations = pilot.state.registrations;
      const requests_before = api_requests;
      pilot.state.available = false;
      pilot.server.closeAllConnections();
      await expect(
        selector.locator("option", { hasText: "Pilot unavailable" })
      ).toHaveCount(1, { timeout: 15000 });
      await expect.poll(() => pilot.state.open_streams).toBe(0);
      pilot.state.id = `fixture-restart-after-${cycle}`;
      pilot.state.available = true;
      await expect(
        selector.locator("option", { hasText: "Pilot unavailable" })
      ).toHaveCount(0, { timeout: 15000 });
      await expect(selector).toHaveValue(
        JSON.stringify([pilot_id, "control.same"])
      );
      await expect(card.getByText(pilot.state.id, { exact: true })).toBeVisible(
        { timeout: 15000 }
      );
      await expect
        .poll(() => pilot.state.registrations, { timeout: 15000 })
        .toBeGreaterThan(registrations);
      await expect.poll(() => pilot.state.open_streams).toBe(1);
      request_counts.push(api_requests - requests_before);
      expect(request_counts.at(-1)).toBeLessThan(100);
      expect(page.url()).toBe(selected_url);
      expect(pilot.state.operations).toEqual([]);
      await measureHeap();
    }
    expect(heaps.at(-1)! - heaps[1]).toBeLessThan(8 * 1024 * 1024);
    expect(page_errors).toEqual([]);
    await writeFile(
      test_info.outputPath("restart-stability.json"),
      JSON.stringify(
        {
          heaps,
          request_counts,
          operations: pilot.state.operations.length,
          page_errors
        },
        null,
        2
      )
    );
    await page.goto("about:blank");
    await expect.poll(() => pilot.state.open_streams).toBe(0);
  } finally {
    await page.goto("about:blank");
    await closeServer(pilot.server);
  }
});
