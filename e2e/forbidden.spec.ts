import { expect, test } from "@playwright/test";
import { MEMBER, ORG, alert, login } from "./helpers";

// bob is a plain member of acme (the `users` group). Under the server's default
// ACLs that group may read clients but not create them, so the server answers
// 403 and the console must say so rather than error out. The console makes no
// permission decision of its own here; the denial comes from cinc-server-ng.
test("a member without create permission sees the forbidden message", async ({
  page,
}) => {
  await login(page, MEMBER);
  // bob belongs to a single org, so login skips the picker.
  await expect(page).toHaveURL(new RegExp(`/orgs/${ORG}$`));

  // Reads are allowed...
  await page.goto(`/orgs/${ORG}/clients`);
  await expect(page.getByRole("link", { name: `${ORG}-validator` })).toBeVisible();

  // ...the create is not.
  await page.goto(`/orgs/${ORG}/clients/new`);
  await page.getByLabel("Name").fill(`e2e-denied-${Date.now()}`);
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(
    alert(page, "You don't have permission to create clients in this organization."),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/orgs/${ORG}/clients/new$`));
});
