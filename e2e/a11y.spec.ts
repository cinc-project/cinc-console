import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, ORG, login } from "./helpers";

// WCAG 2.2 AA is a hard requirement (CLAUDE.md). axe can only judge rendered
// pages with real computed styles, so color-contrast is checked here rather
// than in jsdom.
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  // Fail with the rule ids and offending selectors, not just a count.
  const summary = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
  expect(summary).toEqual([]);
}

// The console ships a single (dark) theme, so one pass covers it.
test("login page has no WCAG AA violations", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await scan(page);
});

test("nodes list has no WCAG AA violations", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto(`/orgs/${ORG}/nodes`);
  await expect(page.getByRole("link", { name: "seed-web01" })).toBeVisible();
  await scan(page);
});
