import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// WCAG 2.2 AA is a hard requirement (CLAUDE.md). axe can only judge rendered
// pages with real computed styles, so color-contrast is checked here rather
// than in jsdom.
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  // Fail with the rule ids and offending selectors, not just a count.
  const summary = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
  expect(summary).toEqual([]);
}
