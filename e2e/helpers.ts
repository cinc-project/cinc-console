import { expect, type Locator, type Page } from "@playwright/test";

/** Users seeded by e2e/fixtures/state (see scripts/e2e.sh). */
export const ADMIN = { username: "anna", password: "anna123" } as const; // acme + beta admin
export const MEMBER = { username: "bob", password: "bob123" } as const; // acme `users` group only

export const ORG = "acme";

/** Sign in through the real form; waits until the app has left /login. */
export async function login(
  page: Page,
  user: { username: string; password: string },
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * The app's alert carrying `text`. Next.js keeps its own empty role="alert"
 * route announcer on every page, so a bare getByRole("alert") is ambiguous.
 */
export function alert(page: Page, text: string): Locator {
  return page.getByRole("alert").filter({ hasText: text });
}
