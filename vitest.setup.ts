import "@testing-library/jest-dom/vitest";
import { expect, vi } from "vitest";
import * as axeMatchers from "vitest-axe/matchers";

// expect(await axe(container)).toHaveNoViolations() — the shared runner is in
// test/axe.ts, the matcher's types in test/vitest-axe.d.ts.
expect.extend(axeMatchers);

// revalidatePath/revalidateTag need a Next request/static-generation scope that
// doesn't exist under vitest; stub them so server actions can be unit-tested.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// The App Router navigation hooks throw without a mounted router context. A
// default no-op mock lets client components that read the URL (e.g. the useSort
// hook) render under vitest; tests that assert navigation re-mock as needed.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
