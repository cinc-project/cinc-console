import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "@/test/axe";
import userEvent from "@testing-library/user-event";
import { RoleDetails } from "./role-details";
import { EnvironmentDetails } from "./environment-details";
import { GroupDetails } from "./group-details";
import { ClientDetails } from "./client-details";
import { DataBagItemDetails } from "./data-bag-item-details";
import { AttributeTree } from "./attribute-tree";

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
  it("names a validator and explains what it can do", () => {
    render(<ClientDetails data={{ name: "node1", validator: true, admin: false }} />);
    expect(screen.getByText("Validator")).toBeInTheDocument();
    expect(screen.getByText(/can only register new clients/)).toBeInTheDocument();
  });

  it("marks an admin client", () => {
    render(<ClientDetails data={{ name: "ci", validator: false, admin: true }} />);
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("folds the public key away behind a disclosure", () => {
    render(<ClientDetails data={{ name: "node1", public_key: "-----BEGIN PUBLIC KEY-----" }} />);
    expect(screen.getByText("Show public key")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy public key" })).toBeInTheDocument();
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
