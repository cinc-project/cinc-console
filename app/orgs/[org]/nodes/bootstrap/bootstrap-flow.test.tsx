import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
    cookbooks: ["apt"],
    policyGroups: [{ name: "production", policies: [{ name: "web-app", revision: "1.0.0" }] }],
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

  it("starts from an empty run list in _default, not a copied node", async () => {
    render(<BootstrapFlow {...props} />);
    await pick("I can SSH to it");
    await typeName("web02");
    expect(screen.getByRole("radio", { name: /Roles \+ environment/ })).toBeChecked();
    const cmd = screen.getByLabelText("Bootstrap command");
    expect(cmd).toHaveTextContent("--environment _default");
    expect(cmd).not.toHaveTextContent("--run-list");
  });

  it("copies a node's settings into the fields, which stay editable", async () => {
    render(<BootstrapFlow {...props} />);
    await pick("I can SSH to it");
    await typeName("web02");
    await userEvent.selectOptions(screen.getByLabelText("Copy from a node"), "seed-web01");
    expect(screen.getByRole("status")).toHaveTextContent("Copied from seed-web01.");
    const cmd = screen.getByLabelText("Bootstrap command");
    expect(cmd).toHaveTextContent("--environment _default --run-list 'role[base]'");

    await userEvent.type(screen.getByLabelText("Add a role or recipe"), "web{Enter}");
    expect(cmd).toHaveTextContent("--run-list 'role[base],role[web]'");

    await userEvent.selectOptions(screen.getByLabelText("Copy from a node"), "seed-policy01");
    expect(screen.getByRole("radio", { name: /Policyfile/ })).toBeChecked();
    expect(cmd).toHaveTextContent("--policy-group production --policy-name web-app");
    expect(cmd).not.toHaveTextContent("--environment");
  });

  it("always shows the mode choice, and lists pinned policies with their revisions", async () => {
    render(<BootstrapFlow {...props} />);
    await pick("I can SSH to it");
    await typeName("web02");
    await userEvent.click(screen.getByRole("radio", { name: /Policyfile/ }));
    const policy = screen.getByRole("radio", { name: /web-app/ });
    expect(policy).toBeChecked();
    expect(policy.closest("label")).toHaveTextContent("1.0.0");
    expect(screen.queryByLabelText("Environment")).toBeNull();
    expect(screen.getByLabelText("Bootstrap command")).toHaveTextContent(
      "--policy-group production --policy-name web-app",
    );
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
    expect(screen.getByRole("alert", { name: /shown only once/ })).toBeInTheDocument();

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
    await userEvent.click(screen.getByRole("radio", { name: /Policyfile/ }));
    expect(screen.getByText(/No policy is pinned to a policy group yet/)).toBeInTheDocument();
    expect(screen.getByLabelText("Policy group")).toBeInTheDocument();
  });

  it("falls back to a text field when environments couldn't load", async () => {
    props.environments = null;
    render(<BootstrapFlow {...props} />);
    await pick("I can SSH to it");
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

  it("says which server and org the Cinc CLI profile must point at", async () => {
    render(<BootstrapFlow {...props} />);
    await pick("I can SSH to it");
    await typeName("web02");
    expect(screen.getByText(/https:\/\/cinc\.example\.test\/organizations\/acme/)).toBeInTheDocument();
  });

  it("targets the node name when the host is left empty", async () => {
    render(<BootstrapFlow {...props} />);
    await pick("I can SSH to it");
    await typeName("web02");
    expect(screen.getByLabelText("Bootstrap command")).toHaveTextContent(
      "cinc node bootstrap web02 --ssh-user USER",
    );
  });

  it("announces a settings problem as an error, not as the summary", async () => {
    props.policyGroups = [];
    render(<BootstrapFlow {...props} />);
    await pick("I can SSH to it");
    await typeName("web02");
    await userEvent.click(screen.getByRole("radio", { name: /Policyfile/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a policy group.");
    expect(screen.queryByText(/Gets/)).toBeNull();
    expect(screen.getByText("Fix the settings above to see the command.")).toBeInTheDocument();
  });

  it("describes the name field with its hint", async () => {
    render(<BootstrapFlow {...props} />);
    await pick("I can SSH to it");
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription(/hostname/);
  });

  it("moves focus to the one-time warning after Create, and back after Discard", async () => {
    render(<BootstrapFlow {...props} />);
    await pick("I'm on the machine");
    await typeName("web02");
    await userEvent.click(screen.getByRole("button", { name: "Create client and show script" }));
    await screen.findByLabelText("Bootstrap script");
    expect(screen.getByRole("alert", { name: /shown only once/ })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(await screen.findByRole("button", { name: "Create client and show script" })).toHaveFocus();
  });

  it("keeps the page and the script when an action throws", async () => {
    props.onDiscard = vi.fn(async () => {
      throw new Error("network down");
    });
    render(<BootstrapFlow {...props} />);
    await pick("I'm on the machine");
    await typeName("web02");
    await userEvent.click(screen.getByRole("button", { name: "Create client and show script" }));
    await screen.findByLabelText("Bootstrap script");
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(await screen.findByText(/Couldn't reach the console/)).toBeInTheDocument();
    expect(screen.getByLabelText("Bootstrap script")).toBeInTheDocument();
  });

  it("shows a create error when the action throws", async () => {
    props.onCreate = vi.fn(async () => {
      throw new Error("network down");
    });
    render(<BootstrapFlow {...props} />);
    await pick("I'm on the machine");
    await typeName("web02");
    await userEvent.click(screen.getByRole("button", { name: "Create client and show script" }));
    expect(await screen.findByText(/Couldn't reach the console/)).toBeInTheDocument();
  });

  it("defers revoking the download URL so browsers can start the download", async () => {
    const revoke = vi.fn();
    const create = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    render(<BootstrapFlow {...props} />);
    await pick("I'm on the machine");
    await typeName("web02");
    await userEvent.click(screen.getByRole("button", { name: "Create client and show script" }));
    await screen.findByLabelText("Bootstrap script");
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: /Download bootstrap-web02\.sh/ }));
      expect(create).toHaveBeenCalled();
      expect(revoke).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(revoke).toHaveBeenCalledWith("blob:x");
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops the previous check-in result when the name changes", async () => {
    // The poll for the edited name never answers, so only a reset clears it.
    props.onCheckIn = vi.fn((n: string) =>
      n === "web02"
        ? Promise.resolve({ state: "checked-in" as const, ohaiTime: 1, platform: null })
        : new Promise<never>(() => {}),
    );
    render(<BootstrapFlow {...props} />);
    await pick("I can SSH to it");
    await typeName("web02");
    await userEvent.click(screen.getByRole("button", { name: "I've run it" }));
    await screen.findByRole("link", { name: "Open node" });
    await userEvent.type(screen.getByLabelText("Name"), "x");
    expect(screen.queryByRole("link", { name: "Open node" })).toBeNull();
  });

  it("moves focus to the watch status after I've run it", async () => {
    render(<BootstrapFlow {...props} />);
    await pick("I can SSH to it");
    await typeName("web02");
    await userEvent.click(screen.getByRole("button", { name: "I've run it" }));
    expect(await screen.findByText(/Watching for/)).toBeInTheDocument();
    expect(screen.getByText(/Watching for/).closest("[role=status]")).toHaveFocus();
  });

  it("doesn't pull focus out of the name field while it's edited during a watch", async () => {
    render(<BootstrapFlow {...props} />);
    await pick("I can SSH to it");
    await typeName("web02");
    await userEvent.click(screen.getByRole("button", { name: "I've run it" }));
    await screen.findByText(/Watching for/);
    await userEvent.type(screen.getByLabelText("Name"), "x");
    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(screen.getByLabelText("Name")).toHaveValue("web02x");
  });

  it("animates the SSH connection, except for reduced motion", () => {
    render(<BootstrapFlow {...props} />);
    const ssh = screen.getByRole("button", { name: /I can SSH to it/ });
    // motion-safe: only, so prefers-reduced-motion gets a still line.
    const flow = ssh.querySelector("svg [data-part=flow]");
    expect(flow).toHaveClass("motion-safe:animate-[dash-flow_1.2s_linear_infinite]");
    expect(ssh.querySelector("svg text")).toHaveTextContent("ssh");
  });

  it("draws the paste card as a terminal handing a key-bearing script to the machine", () => {
    render(<BootstrapFlow {...props} />);
    const paste = screen.getByRole("button", { name: /I'm on the machine/ });
    // Window dots on the terminal, the key, and the connector to the script.
    expect(paste.querySelectorAll("svg [data-part=window-dot]")).toHaveLength(3);
    expect(paste.querySelector("svg [data-part=key]")).not.toBeNull();
    expect(paste.querySelector("svg [data-part=connector]")).not.toBeNull();
  });
});
