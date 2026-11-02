import { expect, test } from "@playwright/test";
import { ADMIN, ORG, alert, login } from "./helpers";

// Every step is a webui-signed request impersonating anna, verified and
// ACL-checked by the real server: create (POST), edit (PUT), delete (DELETE).
test("an admin creates, edits, and deletes a node", async ({ page }) => {
  const name = `e2e-node-${Date.now()}`;
  await login(page, ADMIN);

  // Create
  await page.goto(`/orgs/${ORG}/nodes`);
  await page.getByRole("link", { name: "New" }).click();
  await expect(page.getByRole("heading", { name: "New node" })).toBeVisible();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(new RegExp(`/orgs/${ORG}/nodes/${name}$`));
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // Edit: change the node's normal attributes through the JSON editor.
  await page.getByRole("button", { name: "Edit JSON" }).click();
  const editor = page.getByRole("textbox", { name: "JSON editor" });
  const current = JSON.parse(await editor.inputValue());
  current.normal = { e2e: { marker: "edited" } };
  await editor.fill(JSON.stringify(current, null, 2));
  await page.getByRole("button", { name: "Save" }).click();
  const confirm = page.getByRole("dialog", { name: "Apply changes?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Apply" }).click();
  await expect(alert(page, "Saved.")).toBeVisible();

  // The edit round-tripped through the server, not just local state.
  await page.reload();
  await page.getByRole("button", { name: "Edit JSON" }).click();
  const saved = JSON.parse(
    await page.getByRole("textbox", { name: "JSON editor" }).inputValue(),
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
