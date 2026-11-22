import { expect, test, type Page } from "@playwright/test";
import { ADMIN, ORG, alert, login } from "./helpers";
import { scan } from "./axe";

// A public key nobody signs with (bob's fixture key), for the "paste" path.
const PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvAfNDJSrTODDUF9JzMow\n7Is6fNN+dOs5vb2zT7lo5xE9wYoWQRmTAHZ4NafZlbOgiVZw6mRY8VfZyVrYQnh6\nYT6qjKQxD5xiGuX4qI0M8s4QkXUFsv59VPS2q966HnkmWD4e1jBhsdjxzV2l0UZo\n3AGixo3foq2uWewrESlHMNYW1xvYC2BMFelq7yljwCPjyX1gxk4KCmpF+A+IGl6j\nYymQA8Ic0kAOnlGVls49KkQNSnY2rqkk26KIAw0qJFtKHCRC3a/7gbuqMvn6Vy2e\n7/EZjIh+1h/lb3UTkty/1cXp9pZGmSiuR8SC2zUSjO3cEpJN8BAicZkUlyWS749n\nbwIDAQAB\n-----END PUBLIC KEY-----";

const keyRow = (page: Page, name: string) =>
  page.getByRole("table", { name: "Keys" }).getByRole("row").filter({
    has: page.getByRole("cell", { name, exact: true }),
  });

async function addKey(page: Page, name: string, publicKey?: string) {
  await page.getByLabel("Name", { exact: true }).fill(name);
  if (publicKey) {
    await page.getByLabel(/Use my own public key/).check();
    await page.getByLabel("Public key (PEM)").fill(publicKey);
  }
  await page.getByRole("button", { name: "Add key" }).click();
}

test("a user manages their own keys on the profile page", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/profile");
  await expect(keyRow(page, "default")).toContainText("Active");

  // Generate: the private key is shown once.
  await addKey(page, "e2e-gen");
  const shown = page.getByLabel(`Private key e2e-gen for ${ADMIN.username}`);
  await expect(shown).toHaveValue(/BEGIN (RSA )?PRIVATE KEY/);
  await scan(page);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(keyRow(page, "e2e-gen")).toContainText("Never");

  // Rename it and give it a past expiry.
  await page.getByRole("button", { name: "Edit key e2e-gen" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("e2e-old");
  await dialog.getByLabel("Never expires").uncheck();
  await dialog.getByLabel("Expires on (00:00 UTC)").fill("2020-01-01");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(keyRow(page, "e2e-old")).toContainText("2020-01-01");
  await expect(keyRow(page, "e2e-old")).toContainText("Expired");
  await expect(keyRow(page, "e2e-gen")).toHaveCount(0);

  // Regenerate in place.
  await page.getByRole("button", { name: "Regenerate key e2e-old" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Regenerate" }).click();
  await expect(page.getByLabel(`Private key e2e-old for ${ADMIN.username}`)).toHaveValue(/PRIVATE KEY/);
  await page.getByRole("button", { name: "Done" }).click();

  // Delete it.
  await page.getByRole("button", { name: "Delete key e2e-old" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(keyRow(page, "e2e-old")).toHaveCount(0);

  // default is now anna's only valid key: deleting it would lock her out.
  await page.getByRole("button", { name: "Delete key default" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(alert(page, "This is the user's last valid key.")).toBeVisible();
  await expect(keyRow(page, "default")).toBeVisible();
});

test("an admin adds and regenerates a client's keys", async ({ page }) => {
  const client = `e2e-keys-${Date.now()}`;
  await login(page, ADMIN);
  await page.goto(`/orgs/${ORG}/clients/new`);
  await page.getByLabel("Name").fill(client);
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page.getByLabel(`Private key for ${client}`)).toBeVisible();

  await page.goto(`/orgs/${ORG}/clients/${client}`);
  await expect(keyRow(page, "default")).toBeVisible();

  // A pasted public key returns no private key.
  await addKey(page, "spare", PUBLIC_KEY);
  await expect(keyRow(page, "spare")).toContainText("Active");
  await expect(page.getByText("Save this private key now.")).toHaveCount(0);

  // Re-registering is regenerating default.
  await page.getByRole("button", { name: "Regenerate key default" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Regenerate" }).click();
  await expect(page.getByLabel(`Private key default for ${client}`)).toHaveValue(/PRIVATE KEY/);
});
