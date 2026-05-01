import { expect, test } from "@playwright/test";

test.describe("admin shell — unauthenticated", () => {
  test("login page renders the form", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(
      page.getByRole("heading", { name: "SERVIO Admin" })
    ).toBeVisible();
    await expect(
      page.getByLabel(/email or username/i)
    ).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in/i })
    ).toBeVisible();
  });

  test("forgot password page renders", async ({ page }) => {
    await page.goto("/admin/forgot-password");
    await expect(
      page.getByRole("heading", { name: /reset your password/i })
    ).toBeVisible();
  });

  test("deep link to /admin redirects to login (SPA fallback works)", async ({
    page,
  }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/admin\/login/, { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: "SERVIO Admin" })
    ).toBeVisible();
  });

  test("deep link to /admin/orders also redirects to login", async ({
    page,
  }) => {
    await page.goto("/admin/orders");
    await page.waitForURL(/\/admin\/login/, { timeout: 10_000 });
  });

  test("deep link to /admin/staff redirects to login (admin-only routes survive refresh)", async ({
    page,
  }) => {
    await page.goto("/admin/staff");
    await page.waitForURL(/\/admin\/login/, { timeout: 10_000 });
  });

  test("invalid credentials show an inline error", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel(/email or username/i).fill("nope@example.com");
    await page.getByLabel(/^password$/i).fill("definitelynotvalid");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
