import { expect, test } from "@playwright/test";
import { ADMIN, ORG, login } from "./helpers";
import { scan } from "./axe";

// The console ships a single (dark) theme, so one pass covers it.
test("login page has no WCAG AA violations", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await scan(page);
});

test("nodes list has no WCAG AA violations", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto(`/orgs/${ORG}/nodes`);
  await expect(page.getByRole("link", { name: "seed-web01" })).toBeVisible();
  await scan(page);
});

test("members page has no WCAG AA violations", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto(`/orgs/${ORG}/members`);
  await expect(page.getByRole("heading", { name: "Pending invitations" })).toBeVisible();
  await scan(page);
});
