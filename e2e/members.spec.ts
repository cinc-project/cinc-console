import { expect, test } from "@playwright/test";
import { ADMIN, INVITEE, ORG, alert, login } from "./helpers";
import { scan } from "./axe";

// Tests in this file share one server and run in order. carol starts in no org
// and is used only here, so the other specs' assumptions about anna and bob
// hold. anna is acme's only admin.

test("an admin cancels an invitation", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto(`/orgs/${ORG}/members`);
  await page.getByLabel("Username to invite").fill(INVITEE.username);
  await page.getByRole("button", { name: "Invite" }).click();
  await page.getByRole("button", { name: `Cancel invitation for ${INVITEE.username}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel invitation" }).click();
  await expect(page.getByText("No pending invitations.")).toBeVisible();
});

test("an admin invites a user, who accepts and joins the org", async ({ page, context }) => {
  await login(page, ADMIN);
  await page.goto(`/orgs/${ORG}/members`);

  const invite = async (name: string) => {
    await page.getByLabel("Username to invite").fill(name);
    await page.getByRole("button", { name: "Invite" }).click();
  };

  await invite("no-such-user");
  await expect(alert(page, "There's no user named no-such-user on this server.")).toBeVisible();

  await invite(INVITEE.username);
  await expect(
    page.getByRole("status").filter({ hasText: `Invited ${INVITEE.username}.` }),
  ).toBeVisible();
  const invites = page.getByRole("table", { name: "Pending invitations" });
  await expect(invites.getByRole("cell", { name: INVITEE.username, exact: true })).toBeVisible();
  await scan(page);

  await invite(INVITEE.username);
  await expect(
    alert(page, `${INVITEE.username} is already a member or already has a pending invitation.`),
  ).toBeVisible();

  // carol answers it from the org picker; once she's in one org it goes straight in.
  await context.clearCookies();
  await login(page, INVITEE);
  await expect(page.getByText(`You're invited to ${ORG}`)).toBeVisible();
  await scan(page);
  await page.getByRole("button", { name: `Accept the invitation to ${ORG}` }).click();
  await expect(page).toHaveURL(new RegExp(`/orgs/${ORG}$`));

  // Back as anna: carol is a member now, and the invitation is gone.
  await context.clearCookies();
  await login(page, ADMIN);
  await page.goto(`/orgs/${ORG}/members`);
  const users = page.getByRole("table", { name: "Users, sortable by username" });
  await expect(users.getByRole("row", { name: new RegExp(`^${INVITEE.username}\\s+Member`) })).toBeVisible();
  await expect(page.getByText("No pending invitations.")).toBeVisible();
});

test("removing the org's only admin is refused with an explanation", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto(`/orgs/${ORG}/members`);
  const row = page.getByRole("row", { name: new RegExp(`^${ADMIN.username}\\s+Admin`) });
  await row.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(
    alert(page, `${ADMIN.username} is the organization's only admin. Make someone else an admin first.`),
  ).toBeVisible();
  await expect(row).toBeVisible();
});
