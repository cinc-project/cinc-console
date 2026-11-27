import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bootstrapCliCommand, bootstrapScript } from "./script";
import type { BootstrapSettings } from "./validate";

// Golden output from cinc-cli's cli/remote.BootstrapCommand (cinc-cli 154aad5)
// with Sudo true and the inputs below. The paste script must be what
// `cinc node bootstrap` runs on a target, byte for byte.
const fixture = (name: string) =>
  readFileSync(join(__dirname, "__fixtures__", `${name}.sh`), "utf8");

const KEY =
  "-----BEGIN RSA PRIVATE KEY-----\nTESTKEYLINE1\nTESTKEYLINE2\n-----END RSA PRIVATE KEY-----";
const BASE = {
  nodeName: "web01",
  serverUrl: "https://cinc.example.test/organizations/acme",
  clientKeyPem: KEY,
};

describe("bootstrapScript matches cinc-cli", () => {
  it("roles + environment", () => {
    expect(
      bootstrapScript({
        ...BASE,
        settings: {
          mode: "roles",
          environment: "production",
          runList: ["role[base]", "recipe[apt@1.2.3]"],
        },
      }),
    ).toBe(fixture("roles"));
  });

  it("policyfile", () => {
    expect(
      bootstrapScript({
        ...BASE,
        settings: { mode: "policy", policyGroup: "prod", policyName: "media" },
      }),
    ).toBe(fixture("policy"));
  });

  it("empty run list in _default", () => {
    expect(
      bootstrapScript({
        ...BASE,
        settings: { mode: "roles", environment: "_default", runList: [] },
      }),
    ).toBe(fixture("empty"));
  });
});

describe("bootstrapScript", () => {
  const roles: BootstrapSettings = { mode: "roles", environment: "_default", runList: [] };

  it("writes a server key's trailing newline verbatim, as cinc-cli does", () => {
    const out = bootstrapScript({ ...BASE, clientKeyPem: `${KEY}\n`, settings: roles });
    expect(out).toContain("-----END RSA PRIVATE KEY-----\n\nCINC_EOF");
  });

  it("never sets an environment for a policy node", () => {
    const out = bootstrapScript({
      ...BASE,
      settings: { mode: "policy", policyGroup: "prod", policyName: "media" },
    });
    expect(out).not.toContain("chef_environment");
  });

  it("refuses a name that can't be a client", () => {
    expect(() => bootstrapScript({ ...BASE, nodeName: "a:b", settings: roles })).toThrow();
  });

  it("refuses a server URL with a newline", () => {
    expect(() =>
      bootstrapScript({ ...BASE, serverUrl: "https://x\nrm -rf /", settings: roles }),
    ).toThrow();
  });

  it("refuses content that would end a heredoc early", () => {
    expect(() =>
      bootstrapScript({ ...BASE, clientKeyPem: `${KEY}\nCINC_EOF\nid`, settings: roles }),
    ).toThrow();
  });

  it("refuses invalid settings", () => {
    expect(() =>
      bootstrapScript({
        ...BASE,
        settings: { mode: "roles", environment: "_default", runList: ["role[x]'; id; '"] },
      }),
    ).toThrow();
  });
});

describe("bootstrapCliCommand", () => {
  it("roles + environment", () => {
    expect(
      bootstrapCliCommand({
        host: "10.0.0.5",
        nodeName: "web01",
        settings: { mode: "roles", environment: "production", runList: ["role[base]", "recipe[apt]"] },
      }),
    ).toEqual([
      "cinc node bootstrap 10.0.0.5 --ssh-user USER --node-name web01",
      "  --environment production --run-list 'role[base],recipe[apt]'",
    ]);
  });

  it("policyfile, with no environment", () => {
    expect(
      bootstrapCliCommand({
        host: "10.0.0.5",
        nodeName: "web01",
        settings: { mode: "policy", policyGroup: "prod", policyName: "media" },
      })[1],
    ).toBe("  --policy-group prod --policy-name media");
  });

  it("an empty run list passes only the environment", () => {
    expect(
      bootstrapCliCommand({
        host: "h",
        nodeName: "web01",
        settings: { mode: "roles", environment: "_default", runList: [] },
      })[1],
    ).toBe("  --environment _default");
  });

  it("uses a HOST placeholder when no host is given", () => {
    expect(
      bootstrapCliCommand({
        host: "",
        nodeName: "web01",
        settings: { mode: "roles", environment: "_default", runList: [] },
      })[0],
    ).toMatch(/^cinc node bootstrap HOST /);
  });
});
