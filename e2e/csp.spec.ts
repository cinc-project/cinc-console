import { expect, test, type Page } from "@playwright/test";
import { ADMIN, ORG, login } from "./helpers";

// The CSP nonce only works if every page renders dynamically (see proxy.ts and
// app/layout.tsx). A prerendered page ships scripts without the nonce, the
// browser refuses them, and the page silently stops hydrating. Unit tests can't
// see that; a real browser reports it as a securitypolicyviolation event and a
// console error.

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}

/** Record console errors, uncaught exceptions, and CSP violations on a page. */
function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(`console: ${msg.text()} (${page.url()})`);
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message} (${page.url()})`));
  return problems;
}

async function cspViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__cspViolations ?? []);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__cspViolations!.push(`${e.violatedDirective} blocked ${e.blockedURI}`);
    });
  });
});

const pages = [
  "/orgs",
  `/orgs/${ORG}`,
  `/orgs/${ORG}/nodes`,
  `/orgs/${ORG}/nodes/seed-web01`,
  `/orgs/${ORG}/roles`,
  `/orgs/${ORG}/roles/base`,
  `/orgs/${ORG}/environments`,
  `/orgs/${ORG}/data_bags`,
  `/orgs/${ORG}/clients`,
  `/orgs/${ORG}/cookbooks`,
  `/orgs/${ORG}/policies`,
  `/orgs/${ORG}/members`,
  "/profile",
];

test("main pages load with no CSP violations or console errors", async ({ page }) => {
  const problems = watch(page);

  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  // The page must actually hydrate under the CSP: a client-side check that the
  // controlled input accepts typing is only meaningful once React is running.
  await page.waitForLoadState("networkidle");
  problems.push(...(await cspViolations(page)).map((v) => `csp: ${v} (/login)`));

  await login(page, ADMIN);

  for (const path of pages) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    await page.waitForLoadState("networkidle");
    problems.push(...(await cspViolations(page)).map((v) => `csp: ${v} (${path})`));
  }

  expect(problems).toEqual([]);
});

test("every page response carries a nonce CSP", async ({ page }) => {
  const res = await page.goto("/login");
  const csp = res?.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).not.toContain("unsafe-eval");

  // The nonce in the header is the one stamped on the page's scripts, and it
  // changes per request.
  const nonce = /'nonce-([^']+)'/.exec(csp)![1];
  const scriptNonces = await page.locator("script[nonce]").evaluateAll((els) =>
    els.map((el) => (el as HTMLScriptElement).nonce),
  );
  expect(scriptNonces.length).toBeGreaterThan(0);
  expect(new Set(scriptNonces)).toEqual(new Set([nonce]));

  const again = await page.goto("/login");
  expect(again?.headers()["content-security-policy"]).not.toContain(nonce);
});
