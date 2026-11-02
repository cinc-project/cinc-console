import { configureAxe } from "vitest-axe";

/**
 * axe-core runner shared by component tests:
 *
 *   expect(await axe(container)).toHaveNoViolations();
 *
 * `color-contrast` is disabled because jsdom does no layout or CSS cascade
 * (and Tailwind classes aren't compiled under vitest), so axe can't compute
 * real foreground/background colors — the rule would only report
 * "incomplete" or false results. Contrast has to be checked in a real browser.
 *
 * `region` is disabled because components render here in isolation, outside
 * the AppShell's <header>/<nav>/<main> landmarks, so every fragment would
 * fail "content should be contained by a landmark" (jest-axe disables it by
 * default for the same reason; vitest-axe 0.1.0 does not).
 */
export const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    region: { enabled: false },
  },
});
