import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test/axe";
import type { BootstrapTemplate } from "@/lib/bootstrap/templates";
import { BootstrapFlow, type BootstrapFlowProps } from "./bootstrap-flow";

const TEMPLATES: BootstrapTemplate[] = [
  {
    node: "seed-policy01",
    settings: { mode: "policy", policyGroup: "production", policyName: "web-app" },
    summary: "web-app from group production",
  },
  {
    node: "seed-web01",
    settings: { mode: "roles", environment: "_default", runList: ["role[base]"] },
    summary: "role[base] in _default",
  },
];

let props: BootstrapFlowProps;

beforeEach(() => {
  props = {
    org: "acme",
    serverUrl: "https://cinc.example.test/organizations/acme",
    templates: TEMPLATES,
    existingNodes: ["seed-web01", "seed-policy01"],
    existingClients: ["ci"],
    environments: ["production"],
    roles: ["base", "web"],
    policyGroups: [{ name: "production", policies: ["web-app"] }],
    onCreate: vi.fn(async () => ({ ok: true as const, privateKey: "-----BEGIN RSA PRIVATE KEY-----\nKEYDATA\n-----END RSA PRIVATE KEY-----\n" })),
    onDiscard: vi.fn(async () => ({ ok: true as const })),
    onCheckIn: vi.fn(async () => ({ state: "waiting" as const })),
  };
});

async function pick(path: "I can SSH to it" | "I'm on the machine") {
  await userEvent.click(screen.getByRole("button", { name: new RegExp(path) }));
}

async function typeName(name: string) {
  const input = screen.getByLabelText("Name");
  await userEvent.clear(input);
  await userEvent.type(input, name);
}

describe("BootstrapFlow", () => {
  it("shows only the two path cards until one is picked", async () => {
    render(<BootstrapFlow {...props} />);
    const ssh = screen.getByRole("button", { name: /I can SSH to it/ });
    expect(ssh).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByLabelText("Name")).toBeNull();
    await pick("I can SSH to it");
    expect(ssh).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("builds the Cinc CLI command from the chosen template", async () => {
    render(<BootstrapFlow {...props} />);
    await pick("I can SSH to it");
    await typeName("web02");
    await userEvent.selectOptions(screen.getByLabelText("Set it up like"), "seed-web01");
    const cmd = screen.getByLabelText("Bootstrap command");
    expect(cmd).toHaveTextContent("--node-name web02");
    expect(cmd).toHaveTextContent("--environment _default --run-list 'role[base]'");

    await userEvent.selectOptions(screen.getByLabelText("Set it up like"), "seed-policy01");
    expect(cmd).toHaveTextContent("--policy-group production --policy-name web-app");
    expect(cmd).not.toHaveTextContent("--environment");
  });

  it("creates the client and shows the paste script, then discards it", async () => {
    render(<BootstrapFlow {...props} />);
    await pick("I'm on the machine");
    await typeName("web02");
    await userEvent.click(screen.getByRole("button", { name: "Create client and show script" }));
    expect(props.onCreate).toHaveBeenCalledWith("web02");
    const script = await screen.findByLabelText("Bootstrap script");
    expect(script).toHaveTextContent("node_name 'web02'");
    expect(script).toHaveTextContent("KEYDATA");
    expect(screen.getByRole("note")).toHaveTextContent("shown only once");

    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(props.onDiscard).toHaveBeenCalledWith("web02");
    expect(await screen.findByRole("button", { name: "Create client and show script" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Bootstrap script")).toBeNull();
  });

  it("explains a forbidden create", async () => {
    props.onCreate = vi.fn(async () => ({ error: "forbidden" }));
    render(<BootstrapFlow {...props} />);
    await pick("I'm on the machine");
    await typeName("web02");
    await userEvent.click(screen.getByRole("button", { name: "Create client and show script" }));
    expect(
      await screen.findByText("You don't have permission to create clients in this organization."),
    ).toBeInTheDocument();
  });

  it("rejects a name that can't be a client", async () => {
    render(<BootstrapFlow {...props} />);
    await pick("I'm on the machine");
    await typeName("a:b");
    expect(screen.getByText(/also the client/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create client and show script" })).toBeDisabled();
  });

  it("flags a name that is already taken", async () => {
    render(<BootstrapFlow {...props} />);
    await pick("I'm on the machine");
    await typeName("ci");
    expect(screen.getByRole("alert")).toHaveTextContent("A client named ci already exists.");
    expect(screen.getByRole("link", { name: "ci" })).toHaveAttribute("href", "/orgs/acme/clients/ci");
    expect(screen.getByRole("button", { name: "Create client and show script" })).toBeDisabled();
  });

  it("explains when no policy is pinned to a group", async () => {
    props.policyGroups = [];
    render(<BootstrapFlow {...props} />);
    await pick("I can SSH to it");
    await userEvent.selectOptions(screen.getByLabelText("Set it up like"), "manual");
    await userEvent.click(screen.getByRole("button", { name: "Policyfile" }));
    expect(screen.getByText(/No policy is pinned to a policy group yet/)).toBeInTheDocument();
    expect(screen.getByLabelText("Policy group")).toBeInTheDocument();
  });

  it("falls back to a text field when environments couldn't load", async () => {
    props.environments = null;
    render(<BootstrapFlow {...props} />);
    await pick("I can SSH to it");
    await userEvent.selectOptions(screen.getByLabelText("Set it up like"), "manual");
    expect(screen.getByLabelText("Environment").tagName).toBe("INPUT");
  });

  it("links to the node once it checks in and hides Discard", async () => {
    props.onCheckIn = vi.fn(async () => ({
      state: "checked-in" as const,
      ohaiTime: 1,
      platform: "ubuntu 24.04",
    }));
    render(<BootstrapFlow {...props} />);
    await pick("I'm on the machine");
    await typeName("web02");
    await userEvent.click(screen.getByRole("button", { name: "Create client and show script" }));
    const link = await screen.findByRole("link", { name: "Open node" });
    expect(link).toHaveAttribute("href", "/orgs/acme/nodes/web02");
    expect(within(screen.getAllByRole("status").at(-1)!).getByText(/ubuntu 24.04/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  it("has no axe violations once the script is shown", async () => {
    const { container } = render(<BootstrapFlow {...props} />);
    await pick("I'm on the machine");
    await typeName("web02");
    await userEvent.click(screen.getByRole("button", { name: "Create client and show script" }));
    await screen.findByLabelText("Bootstrap script");
    expect(await axe(container)).toHaveNoViolations();
  });
});
