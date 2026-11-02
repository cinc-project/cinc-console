// Dev helper: create (or password-set) a Cinc user so it can log into the
// console. Signs POST /users with the webui key, impersonating the admin via
// X-Ops-Request-Source: web — the same mechanism the console uses.
//
// Uses the SAME env as the app:
//   CINC_SERVER_URL, CINC_WEBUI_KEY
// Args: <username> <password> [adminName=pivotal]
//
//   node scripts/seed-user.mjs alice s3cret
import { createHash, createSign } from "node:crypto";

const [username, password, admin = "pivotal"] = process.argv.slice(2);
const base = process.env.CINC_SERVER_URL;
const key = process.env.CINC_WEBUI_KEY;

if (!username || !password || !base || !key) {
  console.error(
    "usage: CINC_SERVER_URL=… CINC_WEBUI_KEY=… node scripts/seed-user.mjs <username> <password> [admin]",
  );
  process.exit(2);
}

// X-Ops-Content-Hash: the v1.3 signing protocol requires a SHA-256 digest of
// the request body in the signed canonical string (see lib/cinc/signing.ts).
// The body happens to carry the new user's password, but this hash is never
// stored or used to check a password; the Cinc server stores the password
// itself. Swapping in bcrypt/argon2 would break the signature.
const contentHash = (b) => createHash("sha256").update(b).digest("base64"); // nosemgrep: javascript-weak-password-hash
// Regex runs on a fixed-format ISO-8601 string from toISOString(); `\d+` has no
// nested quantifier, so backtracking is linear — not ReDoS-exploitable.
const ts = new Date().toISOString().replace(/\.\d+Z$/, "Z"); // nosemgrep: javascript-redos-static
const path = "/users";
const body = JSON.stringify({ name: username, password });
const canon = [
  `Method:POST`,
  `Path:${path}`,
  `X-Ops-Content-Hash:${contentHash(body)}`,
  `X-Ops-Sign:version=1.3`,
  `X-Ops-Timestamp:${ts}`,
  `X-Ops-UserId:${admin}`,
  `X-Ops-Server-API-Version:1`,
].join("\n");
const sig = createSign("RSA-SHA256").update(canon).sign(key, "base64");

const headers = {
  "X-Ops-Sign": "version=1.3",
  "X-Ops-UserId": admin,
  "X-Ops-Timestamp": ts,
  "X-Ops-Content-Hash": contentHash(body),
  "X-Ops-Server-API-Version": "1",
  "X-Ops-Request-Source": "web",
  "Content-Type": "application/json",
  Accept: "application/json",
};
for (let i = 0; i * 60 < sig.length; i++)
  headers[`X-Ops-Authorization-${i + 1}`] = sig.slice(i * 60, i * 60 + 60);

// `base` is the operator-supplied CINC_SERVER_URL env var (the same server the
// app itself signs against), not attacker-controlled request input — this is a
// local dev CLI, so there is no SSRF trust boundary to cross here.
const res = await fetch(base + path, { method: "POST", headers, body }); // nosemgrep: js-ssrf-request,js-untrusted-data-to-external-api
const text = await res.text();
if (res.status === 201) {
  // The literal word "password" appears in the message; the secret value itself
  // is never logged. This is operator console output from a dev helper.
  console.log(`created user "${username}" with a password — you can now log in.`); // nosemgrep: javascript-cleartext-logging-taint
} else if (res.status === 409) {
  console.error(
    `user "${username}" already exists. Delete it first, or pick another name.`,
  );
  process.exit(1);
} else {
  // `text` is the server's error response body (status + message), not a
  // credential; surfacing it is required to diagnose a failed seed.
  console.error(`failed (${res.status}): ${text}`); // nosemgrep: javascript-cleartext-logging-taint
  process.exit(1);
}
