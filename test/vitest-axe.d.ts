// vitest-axe 0.1.0 ships its matcher types on the pre-1.0 global `Vi`
// namespace, which vitest 4 no longer reads. Augment vitest's own interfaces so
// `expect(results).toHaveNoViolations()` type-checks.
import "vitest";
import type { AxeMatchers } from "vitest-axe/matchers";

declare module "vitest" {
  // `T` must match vitest's own declaration for the interfaces to merge.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  interface Assertion<T = any> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
