import { expect, test } from "@playwright/test";
import { ADMIN, alert, login } from "./helpers";

test("an admin signs in and lands on the org list", async ({ page }) => {
  await login(page, ADMIN);

  await expect(page).toHaveURL(/\/orgs$/);
  await expect(page.getByRole("heading", { name: "Your organizations" })).toBeVisible();
  // anna belongs to both seeded orgs, so the picker is shown instead of a redirect.
  await expect(page.getByRole("link", { name: /acme/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /beta/ })).toBeVisible();

  // The session is a real cookie: a fresh navigation stays signed in.
  await page.goto("/orgs/acme/nodes");
  await expect(page).toHaveURL(/\/orgs\/acme\/nodes$/);
  await expect(page.getByRole("link", { name: "seed-web01" })).toBeVisible();
});

test("a wrong password shows an alert and stays on /login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(ADMIN.username);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(alert(page, "invalid username or password")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("signing out clears the session", async ({ page }) => {
  await login(page, ADMIN);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/orgs");
  await expect(page).toHaveURL(/\/login/);
});
