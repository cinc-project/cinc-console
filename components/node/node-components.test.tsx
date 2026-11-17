import { describe, expect, it, test, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test/axe";
import { nodeFacts } from "@/lib/cinc/node-facts";
import { NodeSidebar } from "./node-sidebar";
import { NodeTabs } from "./node-tabs";
import { NodeHardware } from "./node-hardware";
import { NodeOverview } from "./node-overview";
import { AttributesView } from "./attributes-view";
import { NodeJsonPanel } from "./node-json-panel";
import { EnvironmentPicker } from "./environment-picker";
import { AppliedRunList } from "./applied-run-list";

const segment = vi.fn<() => string | null>(() => null);
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useSelectedLayoutSegment: () => segment(),
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

const NOW = 1_800_000_000_000;
const NODE = {
  name: "timnas",
  chef_environment: "_default",
  run_list: [],
  normal: { tags: [] },
  default: { audit: { reporter: "json-file", quiet: false } },
  override: { audit: { reporter: "cli" } },
  automatic: {
    platform: "debian",
    platform_version: "13",
    kernel: { name: "Linux", release: "6.12.48-amd64", machine: "x86_64" },
    fqdn: "timnas.localdomain",
    ipaddress: "172.16.1.50",
    uptime_seconds: 1533389,
    ohai_time: NOW / 1000 - 840,
    chef_packages: { chef: { version: "18.8.54" } },
    cpu: { "0": { model_name: "Intel(R) N100" }, total: 4, real: 1, cores: 4 },
    memory: { total: "16000000kB", available: "8000000kB" },
    filesystem: {
      by_mountpoint: {
        "/": { kb_size: "1000", kb_used: "960", percent_used: "96%", fs_type: "ext4", devices: ["/dev/sda1"] },
      },
    },
    network: {
      default_interface: "eth0",
      interfaces: { eth0: { state: "up", addresses: { "172.16.1.50": { family: "inet", prefixlen: "24" } } } },
    },
  },
};
const facts = nodeFacts(NODE);
const BASE = "/orgs/home/nodes/timnas";

beforeEach(() => {
  segment.mockReturnValue(null);
  refresh.mockClear();
});

describe("NodeSidebar", () => {
  const sidebar = (overrides: Partial<Parameters<typeof NodeSidebar>[0]> = {}) => (
    <NodeSidebar
      org="home"
      name="timnas"
      base={BASE}
      facts={facts}
      now={NOW}
      clientStatus="major-behind"
      latestMajor={19}
      os={{ status: "supported", until: "2030-06-30" }}
      deleteButton={<button type="button">Delete</button>}
      {...overrides}
    />
  );

  it("answers the four health questions in text", () => {
    render(sidebar());
    const health = within(screen.getByRole("list", { name: "Health" }));
    expect(health.getByText("Checked in 14m ago")).toBeInTheDocument();
    expect(health.getByText("Client 18.8.54, one major behind")).toBeInTheDocument();
    expect(health.getByText("No run list, in _default")).toBeInTheDocument();
    expect(health.getByText("OS supported until Jun 2030")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "timnas" })).toBeInTheDocument();
    expect(screen.getByText("Debian 13 · x86_64")).toBeInTheDocument();
  });

  it("offers Set run list for a node with nothing to run", () => {
    render(sidebar());
    expect(screen.getByRole("link", { name: "Set run list" })).toHaveAttribute("href", `${BASE}/run-list`);
  });

  it("omits the OS line when support is unknown", () => {
    render(sidebar({ os: { status: "unknown" } }));
    expect(within(screen.getByRole("list", { name: "Health" })).getAllByRole("listitem")).toHaveLength(3);
  });

  it("has no axe violations", async () => {
    const { container } = render(sidebar());
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("NodeTabs", () => {
  it("marks the active route's tab as the current page", () => {
    segment.mockReturnValue("hardware");
    render(<NodeTabs base={BASE} />);
    expect(screen.getByRole("link", { name: "Hardware" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", BASE);
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("marks Overview on the index route", () => {
    render(<NodeTabs base={BASE} />);
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });
});

describe("NodeOverview", () => {
  const overview = () => (
    <NodeOverview
      org="home"
      base={BASE}
      facts={facts}
      now={NOW}
      clientStatus="major-behind"
      lifecycle={{ latestMajor: 19, latestVersion: "19.3.15", eolMajors: [] }}
    />
  );

  it("explains why the node is unmanaged and what's newer", () => {
    render(overview());
    expect(screen.getByRole("note")).toHaveTextContent(/registered but not fully managed/);
    expect(screen.getByText("19.3.15 available")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(overview());
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("NodeHardware", () => {
  it("lists filesystems with a meter that says when it's full", () => {
    render(<NodeHardware base={BASE} facts={facts} />);
    const meter = screen.getByRole("meter", { name: "/ used" });
    expect(meter).toHaveAttribute("aria-valuetext", "96% used, full");
    expect(screen.getByText("full")).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /eth0/ })).toHaveTextContent("default route");
  });

  it("says when Ohai hasn't reported yet", () => {
    render(<NodeHardware base={BASE} facts={nodeFacts({ name: "fresh" })} />);
    expect(screen.getByText(/hasn't reported hardware yet/)).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<NodeHardware base={BASE} facts={facts} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("AppliedRunList", () => {
  it("shows each recipe with its cookbook version", () => {
    render(
      <AppliedRunList
        facts={nodeFacts({
          automatic: { ohai_time: 1, recipes: ["ntp::default"], roles: ["base"], cookbooks: { ntp: { version: "5.2.0" } } },
        })}
      />,
    );
    expect(screen.getByText("ntp::default")).toBeInTheDocument();
    expect(screen.getByText("ntp 5.2.0")).toBeInTheDocument();
  });
});

describe("AttributesView", () => {
  const levels = { default: NODE.default, normal: NODE.normal, override: NODE.override, automatic: NODE.automatic };

  it("shows the winning value, its level, and what it replaced", async () => {
    const user = userEvent.setup();
    render(<AttributesView levels={levels} />);
    await user.click(screen.getByRole("button", { name: /audit/ }));
    const row = screen.getByText("reporter").closest("li")!;
    expect(row).toHaveTextContent("cli");
    expect(row).toHaveTextContent("set by override");
    expect(row).toHaveTextContent('replaces json-file from default');
  });

  it("folds Ohai-only keys into one collapsed group", async () => {
    const user = userEvent.setup();
    render(<AttributesView levels={levels} />);
    expect(screen.queryByText("fqdn")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Reported by Ohai/ }));
    expect(screen.getByText("fqdn")).toBeInTheDocument();
  });

  it("filters to matching paths across levels", async () => {
    const user = userEvent.setup();
    render(<AttributesView levels={levels} />);
    await user.type(screen.getByRole("searchbox", { name: /filter attributes/i }), "kernel.rel");
    expect(screen.getByText("kernel.release")).toBeInTheDocument();
    expect(screen.getByText("1 matching attribute")).toBeInTheDocument();
  });

  it("browses one level alone without the Set by column", async () => {
    const user = userEvent.setup();
    render(<AttributesView levels={levels} />);
    await user.click(screen.getByRole("button", { name: /^Default/ }));
    expect(screen.getByRole("button", { name: /^Default/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /audit/ }));
    expect(screen.getByText("reporter").closest("li")).toHaveTextContent("json-file");
    expect(screen.queryByText("Set by")).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<AttributesView levels={levels} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("NodeJsonPanel", () => {
  const json = JSON.stringify({ name: "timnas", normal: {} }, null, 2);

  test("is read-only until Edit, then saves after confirming the diff", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ ok: true as const }));
    render(<NodeJsonPanel name="timnas" initialJson={json} onSave={onSave} />);
    expect(screen.getByRole("textbox", { name: "JSON (read-only)" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const editor = screen.getByRole("textbox", { name: "JSON editor" });
    await user.clear(editor);
    await user.click(editor);
    await user.paste(JSON.stringify({ name: "timnas", normal: { a: 1 } }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onSave).toHaveBeenCalledWith(JSON.stringify({ name: "timnas", normal: { a: 1 } }));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
    expect(refresh).toHaveBeenCalled();
  });

  test("Cancel discards the draft", async () => {
    const user = userEvent.setup();
    render(<NodeJsonPanel name="timnas" initialJson={json} onSave={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByRole("textbox", { name: "JSON editor" }), "x");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("textbox", { name: "JSON (read-only)" })).toHaveValue(json);
  });
});

describe("EnvironmentPicker", () => {
  it("moves the node to the chosen environment", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ ok: true as const }));
    render(<EnvironmentPicker current="_default" options={["_default", "production"]} onSave={onSave} />);
    expect(screen.getByRole("button", { name: "Move node" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Environment"), "production");
    await user.click(screen.getByRole("button", { name: "Move node" }));
    expect(onSave).toHaveBeenCalledWith("production");
    expect(await screen.findByRole("status")).toHaveTextContent("Moved to production.");
  });

  it("explains a forbidden move", async () => {
    const user = userEvent.setup();
    render(
      <EnvironmentPicker
        current="_default"
        options={["_default", "production"]}
        onSave={vi.fn(async () => ({ error: "forbidden" }))}
      />,
    );
    await user.selectOptions(screen.getByLabelText("Environment"), "production");
    await user.click(screen.getByRole("button", { name: "Move node" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("permission");
  });

  it("shows the environment read-only when environments can't be listed", () => {
    render(<EnvironmentPicker current="prod" options={null} onSave={vi.fn()} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("prod")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <EnvironmentPicker current="_default" options={["_default", "production"]} onSave={vi.fn()} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
