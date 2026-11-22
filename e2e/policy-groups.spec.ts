import { expect, test } from "@playwright/test";
import { ADMIN, ORG, login } from "./helpers";
import { scan } from "./axe";

// Seeded by e2e/fixtures/state: web-app 1.0.0 pinned in production (where
// seed-policy01 runs) and web-app 2.0.0 pinned in staging.
test("an admin sees which revision is live where, then unpins and deletes", async ({
  page,
}) => {
  await login(page, ADMIN);

  await page.goto(`/orgs/${ORG}/policy_groups`);
  const prod = page.getByRole("row", { name: /production/ });
  await expect(prod.getByRole("link", { name: "web-app revision 1.0.0" })).toBeVisible();
  await scan(page);

  // Group detail: its pin and the node running it.
  await prod.getByRole("link", { name: "production" }).click();
  await expect(page.getByRole("heading", { name: "production" })).toBeVisible();
  await expect(page.getByRole("link", { name: "seed-policy01" })).toBeVisible();
  await expect(page.locator("#main-content").getByRole("link", { name: "Permissions" })).toHaveAttribute(
    "href",
    `/orgs/${ORG}/permissions/policy_groups/production`,
  );

  // Reverse view on the policy page.
  await page.getByRole("link", { name: "web-app revision 1.0.0" }).click();
  await expect(page).toHaveURL(new RegExp(`/orgs/${ORG}/policies/web-app#revision-1\\.0\\.0$`));
  await expect(page.locator("#revision-2\\.0\\.0").getByRole("link", { name: "staging" })).toBeVisible();

  // Unpin web-app from staging, then delete the (now empty) group.
  await page.goto(`/orgs/${ORG}/policy_groups/staging`);
  await page.getByRole("button", { name: "Remove web-app from staging" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove from group" }).click();
  await expect(page.getByText("No policies are pinned in this group.", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Delete group" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete group" }).click();
  await expect(page).toHaveURL(new RegExp(`/orgs/${ORG}/policy_groups$`));
  await expect(page.getByRole("link", { name: "staging", exact: true })).toHaveCount(0);
  // The policy and its revisions are kept.
  await page.goto(`/orgs/${ORG}/policies/web-app`);
  await expect(page.getByText("2 revisions")).toBeVisible();
});
