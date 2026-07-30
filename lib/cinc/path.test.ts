// @vitest-environment node
import { describe, expect, test } from "vitest";
import { assertSafePath, assertSafeSegment, isUnsafePathError } from "./path";

function rejects(fn: () => void): boolean {
  try {
    fn();
    return false;
  } catch (e) {
    return isUnsafePathError(e);
  }
}

describe("assertSafePath", () => {
  test("accepts the paths the resource modules build", () => {
    for (const p of [
      "/organizations/acme/nodes",
      "/organizations/acme/nodes/web01",
      "/organizations/acme/data/creds/db_prod",
      "/organizations/acme/cookbooks/nginx/1.2.3",
      "/organizations/acme/policies/base/revisions/a1b2c3",
      "/organizations/acme/nodes/web01/_acl",
      "/organizations/acme/search/node",
      "/users/anna/organizations",
      "/authenticate_user",
    ]) {
      expect(() => assertSafePath(p)).not.toThrow();
    }
  });

  test("accepts names that are odd but structurally harmless", () => {
    // These survive the round trip unchanged (fetch percent-encodes, the server
    // decodes back to the same bytes it canonicalizes), so they still work.
    expect(() => assertSafePath("/organizations/acme/nodes/web 01")).not.toThrow();
    expect(() => assertSafePath("/organizations/acme/nodes/web01:8080")).not.toThrow();
    expect(() => assertSafePath("/organizations/acme/nodes/wéb01")).not.toThrow();
  });

  test("rejects a name that escapes its segment", () => {
    // /orgs/acme/nodes/web01%2F_acl arrives from Next as the name "web01/_acl":
    // signed and sent identically, so without this guard the console would sign a
    // request for the ACL endpoint it never exposes.
    expect(rejects(() => assertSafePath("/organizations/acme/nodes/web01/_acl/"))).toBe(
      true,
    );
    expect(rejects(() => assertSafePath("/organizations/acme/nodes/"))).toBe(true);
  });

  test("rejects traversal, escapes, and query/fragment truncation", () => {
    for (const p of [
      "/organizations/acme/nodes/../../users/pivotal",
      "/organizations/acme/nodes/..",
      "/organizations/acme/nodes/%2e%2e%2fusers",
      "/organizations/acme/nodes/web01%2F_acl",
      "/organizations/acme/nodes/web01?a=b",
      "/organizations/acme/nodes/web01#frag",
      "/organizations/acme/nodes/web01\\_acl",
      "/organizations//nodes/web01",
    ]) {
      expect(rejects(() => assertSafePath(p)), p).toBe(true);
    }
  });

  test("rejects a non-absolute path", () => {
    expect(rejects(() => assertSafePath("organizations/acme/nodes"))).toBe(true);
  });
});

describe("assertSafeSegment", () => {
  test("accepts ordinary chef names", () => {
    for (const n of ["web01", "anna", "my-role", "my_role", "1.2.3", "host:8080"]) {
      expect(() => assertSafeSegment(n, "name")).not.toThrow();
    }
  });

  test("rejects empty, relative, and control-character names", () => {
    expect(rejects(() => assertSafeSegment("", "name"))).toBe(true);
    expect(rejects(() => assertSafeSegment(".", "name"))).toBe(true);
    expect(rejects(() => assertSafeSegment("..", "name"))).toBe(true);
    // CRLF here would mean header injection: the user id is also a request header.
    expect(rejects(() => assertSafeSegment("anna\r\nX-Ops-UserId: pivotal", "user"))).toBe(
      true,
    );
    expect(rejects(() => assertSafeSegment("anna\tpivotal", "user"))).toBe(true);
  });
});
