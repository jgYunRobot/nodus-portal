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

test("restores the direct Control-scoped Jogging route", async ({ page }) => {
  await page.goto("/robots/control-alpha/jogging");
  await expect(page.getByRole("heading", { name: "Jogging" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "control-alpha" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Jogging" })).toHaveAttribute(
    "aria-current",
    "page"
  );
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
