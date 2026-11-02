import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "@/test/axe";
import userEvent from "@testing-library/user-event";
import { NodeDetails } from "./node-details";
import { RoleDetails } from "./role-details";
import { EnvironmentDetails } from "./environment-details";
import { GroupDetails } from "./group-details";
import { ClientDetails } from "./client-details";
import { DataBagItemDetails } from "./data-bag-item-details";
import { AttributeTree } from "./attribute-tree";

describe("NodeDetails", () => {
  const node = {
    chef_environment: "production",
    run_list: ["recipe[apache2::default]", "role[web]"],
    normal: { tags: ["frontend"], foo: "bar" },
    automatic: {
      platform: "ubuntu",
      platform_version: "22.04",
      fqdn: "web01",
      chef_packages: { chef: { version: "18.4.12" } },
    },
  };

  it("renders the environment, platform, client version, run list and tags", () => {
    render(<NodeDetails data={node} />);
    expect(screen.getByText("production")).toBeInTheDocument();
    expect(screen.getByText("ubuntu 22.04")).toBeInTheDocument();
    expect(screen.getByText("18.4.12")).toBeInTheDocument();
    expect(screen.getByText("recipe[apache2::default]")).toBeInTheDocument();
    expect(screen.getByText("role[web]")).toBeInTheDocument();
    // appears as a tag chip and again inside the normal-attributes tree
    expect(screen.getAllByText("frontend").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the run list as an ordered list in run order", () => {
    render(<NodeDetails data={node} />);
    const ordered = screen
      .getAllByRole("list")
      .find((el) => el.tagName === "OL");
    expect(ordered).toBeDefined();
    const text = ordered!.textContent ?? "";
    // run_list entries appear in order, apache2 before role[web]
    expect(text.indexOf("apache2")).toBeLessThan(text.indexOf("role[web]"));
  });

  it("does not throw on a malformed object", () => {
    expect(() => render(<NodeDetails data={"oops"} />)).not.toThrow();
    expect(screen.getByText("No run list.")).toBeInTheDocument();
  });

  it("warns next to the version when the client is a major release behind", () => {
    render(<NodeDetails data={node} clientStatus="major-behind" />);
    expect(screen.getByText("major release behind")).toBeInTheDocument();
    expect(screen.queryByText("EOL")).not.toBeInTheDocument();
  });

  it("warns next to the version when the client is EOL", () => {
    render(<NodeDetails data={node} clientStatus="eol" />);
    expect(screen.getByLabelText("End-of-life release")).toBeInTheDocument();
    expect(screen.getByText("EOL")).toBeInTheDocument();
  });

  it("shows no version warning for a current client", () => {
    render(<NodeDetails data={node} clientStatus="current" />);
    expect(screen.queryByText("EOL")).not.toBeInTheDocument();
    expect(screen.queryByText("major release behind")).not.toBeInTheDocument();
  });
});

describe("RoleDetails", () => {
  it("renders per-environment run lists", () => {
    render(
      <RoleDetails
        data={{
          run_list: ["recipe[base]"],
          env_run_lists: { production: ["recipe[prod]"] },
        }}
      />,
    );
    expect(screen.getByText("production")).toBeInTheDocument();
    expect(screen.getByText("recipe[prod]")).toBeInTheDocument();
  });
});

describe("EnvironmentDetails", () => {
  it("renders cookbook version constraints", () => {
    render(
      <EnvironmentDetails
        data={{ cookbook_versions: { apache2: ">= 1.0.0" } }}
      />,
    );
    expect(screen.getByText("apache2")).toBeInTheDocument();
    expect(screen.getByText(">= 1.0.0")).toBeInTheDocument();
  });
});

describe("GroupDetails", () => {
  it("lists users and reports empties", () => {
    render(<GroupDetails data={{ users: ["anna"], clients: [] }} />);
    expect(screen.getByText("anna")).toBeInTheDocument();
    expect(screen.getByText("No clients.")).toBeInTheDocument();
  });
});

describe("ClientDetails", () => {
  it("renders validator/admin as yes/no", () => {
    render(<ClientDetails data={{ name: "node1", validator: true, admin: false }} />);
    expect(screen.getByText("node1")).toBeInTheDocument();
    expect(screen.getByText("yes")).toBeInTheDocument();
    expect(screen.getByText("no")).toBeInTheDocument();
  });
});

describe("DataBagItemDetails", () => {
  it("shows the contents without repeating the id (already the page title)", () => {
    render(<DataBagItemDetails data={{ id: "secret", password: "p@ss" }} />);
    expect(screen.getByText("p@ss")).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });
});

describe("AttributeTree", () => {
  it("expands a nested object on click", async () => {
    const user = userEvent.setup();
    render(<AttributeTree data={{ outer: { inner: { leaf: "value" } } }} />);
    // top level is open by default; nested levels start collapsed
    expect(screen.queryByText("value")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /inner/i }));
    expect(screen.getByText("value")).toBeInTheDocument();
  });
});

describe("details views", () => {
  it.each([
    ["NodeDetails", () => (
      <NodeDetails
        data={{
          chef_environment: "production",
          run_list: ["recipe[a]"],
          normal: { tags: ["frontend"] },
          automatic: { platform: "ubuntu", platform_version: "22.04" },
        }}
        clientStatus="eol"
      />
    )],
    ["RoleDetails", () => (
      <RoleDetails
        data={{ run_list: ["recipe[base]"], env_run_lists: { production: ["recipe[prod]"] } }}
      />
    )],
    ["EnvironmentDetails", () => (
      <EnvironmentDetails data={{ cookbook_versions: { apache2: ">= 1.0.0" } }} />
    )],
    ["GroupDetails", () => <GroupDetails data={{ users: ["anna"], clients: [] }} />],
    ["ClientDetails", () => (
      <ClientDetails data={{ name: "node1", validator: true, admin: false }} />
    )],
    ["DataBagItemDetails", () => (
      <DataBagItemDetails data={{ id: "secret", password: "p@ss" }} />
    )],
    ["AttributeTree", () => <AttributeTree data={{ outer: { inner: { leaf: "v" } } }} />],
  ])("%s has no axe violations", async (_name, ui) => {
    const { container } = render(ui());
    expect(await axe(container)).toHaveNoViolations();
  });
});
