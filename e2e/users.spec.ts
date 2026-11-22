import { expect, test } from "@playwright/test";
import { ADMIN, MEMBER, ORG, SUPERUSER, alert, login } from "./helpers";
import { scan } from "./axe";

const NEW_USER = { username: "dave", password: "davepass1" };

test("the superuser creates a user, manages them, and deletes them", async ({ page, context }) => {
  await login(page, SUPERUSER);
  await page.goto(`/orgs/${ORG}/members`);
  await page.getByRole("link", { name: "New user" }).click();
  await scan(page);

  await page.getByLabel("Username").fill(NEW_USER.username);
  await page.getByLabel("Display name").fill("Dave New");
  await page.getByLabel("Email").fill("dave@example.com");
  await page.getByLabel("Password").fill("initial1");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByRole("status")).toHaveText(`${NEW_USER.username} is a member of ${ORG}.`);
  await expect(page.getByLabel(`Private key for ${NEW_USER.username}`)).toHaveValue(/PRIVATE KEY/);
  await page.getByRole("button", { name: "View user" }).click();
  await expect(page.getByRole("heading", { name: "Dave New" })).toBeVisible();
  await scan(page);

  // Make admin, then take it back.
  const role = page.getByRole("region", { name: "Role" });
  await role.getByRole("button", { name: "Make admin" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Make admin" }).click();
  await expect(role).toContainText("in the admins group");
  await role.getByRole("button", { name: "Remove admin" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove admin" }).click();
  await expect(role).toContainText("in the users group");

  // Edit the profile in place.
  const profile = page.getByRole("region", { name: "Profile" });
  await profile.getByRole("button", { name: "Edit" }).click();
  await profile.getByLabel("Last name").fill("New");
  await profile.getByRole("button", { name: "Save" }).click();
  await expect(profile.getByRole("status")).toHaveText("Saved.");
  await expect(profile).toContainText("New");

  // Set a password, then sign in with it.
  await page.getByRole("button", { name: "Set password…" }).click();
  const pwDialog = page.getByRole("dialog", { name: "Set password" });
  await scan(page);
  await pwDialog.getByLabel("New password").fill(NEW_USER.password);
  await pwDialog.getByLabel("Confirm password").fill(NEW_USER.password);
  await pwDialog.getByRole("button", { name: "Set password" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Password set." })).toBeVisible();
  await context.clearCookies();
  await login(page, NEW_USER);
  await expect(page).toHaveURL(new RegExp(`/orgs/${ORG}$`));

  // Delete dave from the server; the name must be typed out.
  await context.clearCookies();
  await login(page, SUPERUSER);
  await page.goto(`/orgs/${ORG}/members/users/${NEW_USER.username}`);
  await page.getByRole("button", { name: `More actions for ${NEW_USER.username}` }).click();
  await page.getByRole("button", { name: /^Delete user from server/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("nope");
  await dialog.getByRole("button", { name: "Delete user" }).click();
  await expect(alert(page, `Type ${NEW_USER.username} exactly to confirm.`)).toBeVisible();
  await dialog.getByRole("textbox").fill(NEW_USER.username);
  await dialog.getByRole("button", { name: "Delete user" }).click();
  await expect(page).toHaveURL(new RegExp(`/orgs/${ORG}/members$`));
  await expect(page.getByRole("link", { name: NEW_USER.username, exact: true })).toHaveCount(0);
});

test("an org admin can't create users or edit another user's record", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto(`/orgs/${ORG}/members/new-user`);
  await page.getByLabel("Username").fill("erin");
  await page.getByLabel("Display name").fill("Erin");
  await page.getByLabel("Email").fill("erin@example.com");
  await page.getByLabel("Password").fill("erinpass");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(
    alert(page, "Only the superuser or a server administrator can create users."),
  ).toBeVisible();

  // anna can see bob through the org, but not change his profile or keys.
  await page.goto(`/orgs/${ORG}/members`);
  await page.getByRole("link", { name: MEMBER.username, exact: true }).click();
  await expect(page.getByText(`Only ${MEMBER.username}, the superuser or a server administrator`)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Keys" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Role" })).toContainText("in the users group");
  await scan(page);
});
