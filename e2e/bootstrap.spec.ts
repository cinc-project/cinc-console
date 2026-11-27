import { expect, test, type Page } from "@playwright/test";
import { ADMIN, MEMBER, ORG, alert, login } from "./helpers";

async function openBootstrap(page: Page) {
  await page.goto(`/orgs/${ORG}/nodes`);
  await page.getByRole("link", { name: "Bootstrap a node" }).click();
  await expect(page.getByRole("heading", { name: "Bootstrap a node" })).toBeVisible();
}

// The paste path creates only the client (the machine's first run makes the
// node), embeds its key in the script, and Discard removes it again.
test("an admin creates a client for a paste-in Policyfile bootstrap", async ({
  page,
}) => {
  const name = `e2e-boot-${Date.now()}`;
  await login(page, ADMIN);
  await openBootstrap(page);

  await page.getByRole("button", { name: /I'm on the machine/ }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Set it up like").selectOption("seed-policy01");
  await page.getByRole("button", { name: "Create client and show script" }).click();

  const script = page.getByLabel("Bootstrap script");
  await expect(script).toContainText(`node_name '${name}'`);
  await expect(script).toContainText(`"policy_group": "production"`);
  await expect(script).toContainText(`"policy_name": "web-app"`);
  await expect(script).toContainText("BEGIN");
  await expect(script).not.toContainText("chef_environment");
  await expect(page.getByRole("status").filter({ hasText: "Watching for" })).toBeVisible();

  await page.goto(`/orgs/${ORG}/clients`);
  await expect(page.getByRole("link", { name })).toBeVisible();
});

test("Discard removes the client created for a paste-in bootstrap", async ({ page }) => {
  const name = `e2e-discard-${Date.now()}`;
  await login(page, ADMIN);
  await openBootstrap(page);
  await page.getByRole("button", { name: /I'm on the machine/ }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create client and show script" }).click();
  await expect(page.getByLabel("Bootstrap script")).toBeVisible();

  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create client and show script" })).toBeVisible();

  await page.goto(`/orgs/${ORG}/clients`);
  await expect(page.getByRole("link", { name })).toHaveCount(0);
});

// The Cinc CLI creates the client itself, so the SSH path must not.
test("the SSH path shows the Cinc CLI command and creates nothing", async ({ page }) => {
  const name = `e2e-ssh-${Date.now()}`;
  await login(page, ADMIN);
  await openBootstrap(page);

  await page.getByRole("button", { name: /I can SSH to it/ }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Host or IP").fill("10.0.0.5");
  await page.getByLabel("Set it up like").selectOption("seed-web01");
  const cmd = page.getByLabel("Bootstrap command");
  await expect(cmd).toContainText(`cinc node bootstrap 10.0.0.5 --ssh-user USER --node-name ${name}`);
  await expect(cmd).toContainText("--environment _default --run-list 'role[base]'");
  await expect(cmd).not.toContainText("knife");

  await page.goto(`/orgs/${ORG}/clients`);
  await expect(page.getByRole("link", { name })).toHaveCount(0);
});

test("a member without client-create permission is told so", async ({ page }) => {
  await login(page, MEMBER);
  await openBootstrap(page);
  await page.getByRole("button", { name: /I'm on the machine/ }).click();
  await page.getByLabel("Name").fill(`e2e-member-${Date.now()}`);
  await page.getByRole("button", { name: "Create client and show script" }).click();
  await expect(
    alert(page, "You don't have permission to create clients in this organization."),
  ).toBeVisible();
});
