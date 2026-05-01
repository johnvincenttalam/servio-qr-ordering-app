import { expect, test } from "@playwright/test";

test.describe("customer landing", () => {
  test("missing table param shows the scan-QR prompt", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Invalid Table" })).toBeVisible();
    await expect(page.getByText(/scan a valid QR code/i)).toBeVisible();
  });

  test("unknown table id is rejected", async ({ page }) => {
    await page.goto("/?t=ZZZZ_NOT_A_TABLE");
    // Validation hits the DB so the empty-state can take a second to
    // resolve. waitFor handles the small async window.
    await expect(
      page.getByRole("heading", { name: "Invalid Table" })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/Invalid table "ZZZZ_NOT_A_TABLE"/i)
    ).toBeVisible();
  });
});
