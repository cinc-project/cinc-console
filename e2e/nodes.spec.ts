import { expect, test } from "@playwright/test";
import { ADMIN, ORG, login } from "./helpers";

// Every step is a webui-signed request impersonating anna, verified and
// ACL-checked by the real server: create (POST), edit (PUT), delete (DELETE).
test("an admin creates, edits, and deletes a node", async ({ page }) => {
  const name = `e2e-node-${Date.now()}`;
  await login(page, ADMIN);

  // Create
  await page.goto(`/orgs/${ORG}/nodes`);
  await page.getByRole("button", { name: "More ways to add a node" }).click();
  await page.getByRole("button", { name: /Create node only/ }).click();
  await expect(page.getByRole("heading", { name: "New node" })).toBeVisible();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(new RegExp(`/orgs/${ORG}/nodes/${name}$`));
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // The tabs are routes; the overview lands first.
  await expect(
    page.getByRole("link", { name: "Overview" }),
  ).toHaveAttribute("aria-current", "page");

  // Edit: change the node's normal attributes on the Raw JSON tab.
  await page.getByRole("link", { name: "Raw JSON" }).click();
  await expect(page).toHaveURL(new RegExp(`/orgs/${ORG}/nodes/${name}/json$`));
  await page.getByRole("button", { name: "Edit" }).click();
  const editor = page.getByRole("textbox", { name: "JSON editor" });
  const current = JSON.parse(await editor.inputValue());
  current.normal = { e2e: { marker: "edited" } };
  await editor.fill(JSON.stringify(current, null, 2));
  await page.getByRole("button", { name: "Save" }).click();
  const confirm = page.getByRole("dialog", { name: "Apply changes?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  // The edit round-tripped through the server, not just local state.
  await page.reload();
  const saved = JSON.parse(
    await page.getByRole("textbox", { name: "JSON (read-only)" }).inputValue(),
  );
  expect(saved.normal).toEqual({ e2e: { marker: "edited" } });

  // Delete
  await page.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog", { name: `Delete ${name}?` });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(new RegExp(`/orgs/${ORG}/nodes$`));
  await expect(page.getByRole("link", { name: "seed-web01" })).toBeVisible();
  await expect(page.getByRole("link", { name })).toHaveCount(0);

  // And the server agrees it is gone.
  await page.goto(`/orgs/${ORG}/nodes/${name}`);
  await expect(
    page.getByText("This no longer exists, or you don't have access to it."),
  ).toBeVisible();
});

// Decommissioning: the node's client of the same name goes with it, so its
// key stops authenticating.
test("deleting a node can also delete its client", async ({ page }) => {
  const name = `e2e-decom-${Date.now()}`;
  await login(page, ADMIN);

  await page.goto(`/orgs/${ORG}/clients/new`);
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page.getByLabel(`Private key for ${name}`)).toBeVisible();

  await page.goto(`/orgs/${ORG}/nodes/new`);
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(new RegExp(`/orgs/${ORG}/nodes/${name}$`));

  await page.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog", { name: `Delete ${name}?` });
  await expect(dialog.getByRole("checkbox", { name: `Also delete client ${name}` })).toBeChecked();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(new RegExp(`/orgs/${ORG}/nodes$`));

  await page.goto(`/orgs/${ORG}/clients/${name}`);
  await expect(
    page.getByText("This no longer exists, or you don't have access to it."),
  ).toBeVisible();
});
