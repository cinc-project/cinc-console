import { expect, test, type Page } from "@playwright/test";
import { ADMIN, MEMBER, ORG, alert, login } from "./helpers";
import { scan } from "./axe";

const row = (page: Page, perm: string) =>
  page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: new RegExp(`^${perm}`) }) });

test("an admin creates a group and protects the built-in ones", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto(`/orgs/${ORG}/members`);
  await page.getByRole("button", { name: "New group" }).click();
  await page.getByLabel("Group name").fill("ops");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(new RegExp(`/orgs/${ORG}/members/groups/ops$`));

  await page.goto(`/orgs/${ORG}/members/groups/admins`);
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(alert(page, "Every organization needs this group, so it can't be deleted.")).toBeVisible();
});

test("an admin grants and revokes create on a container", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto(`/orgs/${ORG}`);
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Permissions" }).click();
  await page.getByRole("link", { name: "nodes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Permissions: Container nodes" })).toBeVisible();
  await scan(page);

  // Grant create to ops.
  await page.getByRole("button", { name: "Edit create" }).click();
  await page.getByLabel("Add to groups (create)").fill("ops");
  await page.getByLabel("Add to groups (create)").press("Enter");
  await scan(page);
  await page.getByRole("button", { name: "Save create" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved create.");
  await expect(row(page, "create")).toContainText("ops");

  // A group that doesn't exist is rejected by the server.
  await page.getByRole("button", { name: "Edit create" }).click();
  await page.getByLabel("Add to groups (create)").fill("no-such-group");
  await page.getByRole("button", { name: "Add" }).nth(1).click();
  await page.getByRole("button", { name: "Save create" }).click();
  await expect(alert(page, "The server rejected this")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // Revoke it again.
  await page.getByRole("button", { name: "Edit create" }).click();
  await page.getByRole("button", { name: "Remove ops from create" }).click();
  await page.getByRole("button", { name: "Save create" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved create.");
  await expect(row(page, "create")).not.toContainText("ops");

  // Only the superuser may take admins out of grant.
  await page.getByRole("button", { name: "Edit grant" }).click();
  await page.getByRole("button", { name: "Remove admins from grant" }).click();
  await page.getByRole("button", { name: "Save grant" }).click();
  await expect(alert(page, "Only the superuser can take the admins group out of grant.")).toBeVisible();
});

test("an object's page links to its permissions", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto(`/orgs/${ORG}/nodes/seed-web01`);
  await page.getByRole("link", { name: "Permissions" }).last().click();
  await expect(page.getByRole("heading", { name: "Permissions: Node seed-web01" })).toBeVisible();
  await expect(row(page, "read")).toContainText("admins");
});

test("a member without grant is told why they can't see permissions", async ({ page }) => {
  await login(page, MEMBER);
  await page.goto(`/orgs/${ORG}/permissions/organization`);
  await expect(page.getByText("You need grant permission here to see these permissions.")).toBeVisible();
});
