import { bootstrapNameError, settingsError, type BootstrapSettings } from "./validate";

/**
 * A port of cinc-cli's `cli/remote.BootstrapCommand` (Sudo on, the default
 * install URL, no version pin): the script `cinc node bootstrap` runs on a
 * target over SSH. The paste-in path hands the same script to the user, so the
 * two bootstrap paths can't drift; `script.test.ts` pins it byte for byte to
 * cinc-cli's own output. Keep any change here in step with cinc-cli.
 *
 * Pure and client-safe: the bootstrap page rebuilds it in the browser, which
 * already holds the one-time key.
 */

const DEFAULT_BOOTSTRAP_URL = "https://omnitruck.cinc.sh/install.sh";

// Terminates every heredoc the script writes. A content line equal to it would
// end the heredoc early and run the rest as shell, so writeFile refuses it.
const HEREDOC = "CINC_EOF";

export function shellQuote(s: string): string {
  if (s === "") return "''";
  return `'${s.replaceAll("'", `'"'"'`)}'`;
}

/** A single-quoted Ruby literal: no #{} interpolation; only \ and ' escaped. */
function rubyQuote(s: string): string {
  return `'${s.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

function writeFile(path: string, content: string): string {
  for (const line of content.split("\n")) {
    if (line.replace(/\r+$/, "") === HEREDOC) {
      throw new Error(`refusing to write ${path}: its content contains a ${HEREDOC} line`);
    }
  }
  return `cat <<'${HEREDOC}' | sudo tee ${shellQuote(path)} >/dev/null\n${content}\n${HEREDOC}`;
}

/** first-boot.json, keys in alphabetical order as Go's map marshalling emits them. */
function firstBoot(settings: BootstrapSettings): string {
  const doc: Record<string, unknown> = {};
  if (settings.mode === "roles") {
    doc.chef_environment = settings.environment;
    if (settings.runList.length > 0) doc.run_list = settings.runList;
  } else {
    doc.policy_group = settings.policyGroup;
    doc.policy_name = settings.policyName;
  }
  return JSON.stringify(doc, null, 2);
}

function validate(nodeName: string, settings: BootstrapSettings): void {
  const name = nodeName === nodeName.trim() ? bootstrapNameError(nodeName) : "surrounding spaces";
  if (name) throw new Error(`invalid node name: ${name}`);
  const s = settingsError(settings);
  if (s) throw new Error(`invalid settings: ${s}`);
}

export function bootstrapScript(o: {
  nodeName: string;
  /** `<server>/organizations/<org>`, as cinc-cli's FormatServerURL builds it. */
  serverUrl: string;
  clientKeyPem: string;
  settings: BootstrapSettings;
}): string {
  validate(o.nodeName, o.settings);
  if (/[\r\n]/.test(o.serverUrl)) throw new Error("refusing a server URL containing a newline");
  const clientRb =
    `chef_server_url ${rubyQuote(o.serverUrl)}\n` +
    `node_name ${rubyQuote(o.nodeName)}\n` +
    `client_key ${rubyQuote("/etc/cinc/client.pem")}\n`;
  return [
    "set -e",
    `CINC_INSTALLER="$(mktemp)"`,
    `trap 'rm -f "$CINC_INSTALLER"' EXIT`,
    `curl -fsSL ${shellQuote(DEFAULT_BOOTSTRAP_URL)} -o "$CINC_INSTALLER"`,
    `sudo bash "$CINC_INSTALLER"`,
    "sudo mkdir -p /etc/cinc",
    "sudo install -m 0600 /dev/null /etc/cinc/client.pem",
    writeFile("/etc/cinc/client.pem", o.clientKeyPem),
    "sudo chmod 0600 /etc/cinc/client.pem",
    writeFile("/etc/cinc/client.rb", clientRb),
    writeFile("/etc/cinc/first-boot.json", firstBoot(o.settings)),
    "sudo cinc-client -j /etc/cinc/first-boot.json",
  ].join("\n");
}

const PLAIN_HOST = /^[A-Za-z0-9._:@\[\]-]+$/;

/**
 * The `cinc node bootstrap` command for the SSH path, as display lines (the
 * second indented). `USER` is a placeholder for the user to fill in; an empty
 * host becomes the `HOST` placeholder.
 */
export function bootstrapCliCommand(o: {
  host: string;
  nodeName: string;
  settings: BootstrapSettings;
}): string[] {
  validate(o.nodeName, o.settings);
  const raw = o.host.trim();
  const host = raw === "" ? "HOST" : PLAIN_HOST.test(raw) ? raw : shellQuote(raw);
  const first = `cinc node bootstrap ${host} --ssh-user USER --node-name ${o.nodeName}`;
  const s = o.settings;
  const second =
    s.mode === "policy"
      ? `  --policy-group ${s.policyGroup} --policy-name ${s.policyName}`
      : `  --environment ${s.environment}` +
        (s.runList.length ? ` --run-list ${shellQuote(s.runList.join(","))}` : "");
  return [first, second];
}
