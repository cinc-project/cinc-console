# cinc-console

A web console for a [Cinc](https://cinc.sh/) / Chef Infra Server. Browse and
edit the objects in your organizations — nodes, roles, environments, data bags,
members — from the browser, with the server enforcing each user's real
permissions.

## How it works

cinc-console uses the classic **webui-key impersonation** model. The console
holds the server's `webui_priv.pem`. Users log in with their server username and
password; every request the console then makes to the cinc server is signed with
the webui key while carrying the logged-in user's identity
(`X-Ops-Userid` + `X-Ops-Request-Source: web`). The server applies that user's
ACLs, so the console never decides permissions — a `403` from the server is what
gates editing in the UI, exactly as it would for `knife`.

- **Single Next.js app.** The webui key and all request signing run server-side
  only; the browser never sees the key or talks to the cinc server directly.
- **Stateless sessions.** The session is an encrypted cookie holding only the
  username, so the console scales to N replicas with no Redis or database.
- **v1.3 signing.** The signing module is a faithful port of the Go
  [`cinc-api`](https://github.com/tas50/cinc-api) implementation, pinned by a
  byte-for-byte conformance test.

## Object scope

| Objects | Capability |
| --- | --- |
| Nodes, Roles, Environments, Data bags (+ items), Members & groups | View + create / edit / delete (ACL-gated) |
| Clients | View + create + delete (ACL-gated) |
| Cookbooks, Policies | View + delete a single version/revision or the whole object (ACL-gated) |

Editing cookbook or policy content, and uploading cookbooks, remain out of scope
for this version. Clients can be created and deleted but not edited (a client's
private key is shown once at creation and is never retrievable again).

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `CINC_SERVER_URL` | yes | Base URL of the Cinc/Chef server, e.g. `https://chef.example.com` |
| `CINC_WEBUI_KEY` | conditional | Inline contents of `webui_priv.pem` (PEM). Required when `CINC_WEBUI_KEY_FILE` is not set. |
| `CINC_WEBUI_KEY_FILE` | conditional | Path to `webui_priv.pem`. Required when `CINC_WEBUI_KEY` is not set. |
| `SESSION_SECRET` | yes | 32+ char secret used to encrypt the session cookie |
| `CINC_CA_CERT` | no | Inline CA bundle (PEM) to trust a self-signed server |
| `CINC_CA_CERT_FILE` | no | Path to a CA bundle (PEM) to trust a self-signed server |
| `CINC_SSL_NO_VERIFY` | no | `true` to skip TLS verification (dev only) |
| `SESSION_TTL_SECONDS` | no | Session lifetime, default `28800` (8h) |
| `CHEF_VERSION` | no | API version header sent to the server, default `16.0.0` |
| `CINC_AUTH_ACTOR` | no | Globally-privileged actor (for example `pivotal`) used for `POST /authenticate_user` on servers that require global create permissions |

The app validates these at boot and exits with a clear message if a required
value is missing. For local development, copy `.env.example` to `.env.local`
and fill in your environment-specific values.

## Deploy to Kubernetes

```bash
helm install cinc-console ./deploy/helm/cinc-console \
  --set cincServerUrl=https://chef.example.com \
  --set-file webuiKey=/etc/opscode/webui_priv.pem
```

`SESSION_SECRET` is generated automatically and preserved across upgrades. See
`deploy/helm/cinc-console/values.yaml` for all options (ingress, resources,
`existingSecret`, etc.) and `values-example.yaml` for a minimal config.

For developer-specific overrides, use a local values file layered last:

```bash
cp deploy/helm/cinc-console/values-local.example.yaml \
  deploy/helm/cinc-console/values-local.yaml

helm upgrade --install cinc-console deploy/helm/cinc-console \
  -f deploy/helm/cinc-console/values-local.yaml \
  --set cincServerUrl=https://chef.example.com \
  --set-file webuiKey=/etc/opscode/webui_priv.pem
```

`values-local.yaml` is gitignored so you can keep local dev settings (for
example `imagePullSecrets` or `nodeEnv`) without changing shared defaults.

## Building images

Official images are published to GitHub Container Registry as
`ghcr.io/tas50/cinc-console` via the project's automated build/release
workflows. In most cases, use those images directly.

Build your own image when you need environment-specific behavior, such as:

- private npm registry access during build (`.npmrc` + token auth)
- custom code changes or local testing before release
- internal compliance requirements (for example org-specific scanning/signing)
- a specific platform strategy not covered by your current deployment flow

For standard builds with access to the public npm registry:

```bash
docker build -t cinc-console:local .
```

If your environment must use a private npm registry, create a local `.npmrc`
from `.npmrc.template` and set your registry/token before running `docker build`.
This repository's Dockerfile reads npm registry settings from `.npmrc` during
the dependency stage.

For complete build instructions (public vs private registry, token auth, and
cross-platform `buildx` examples), see [BUILD.md](BUILD.md).

To cut a release, see [RELEASING.md](RELEASING.md) — `make release-pr VERSION=0.5.0`
opens a PR that bumps every version reference, and merging it tags the release and
publishes the signed multi-arch image.

## Development

```bash
pnpm install
cp .env.example .env.local   # fill in the variables above
pnpm dev                     # http://localhost:3000
pnpm test                    # unit tests (vitest)
pnpm build                   # production build
```

## Security

- The webui key is a powerful credential — it can act as any user. Keep it in a
  Kubernetes Secret (or `existingSecret`), never in the image or client bundle.
- Serve the console over TLS; the session cookie is `HttpOnly` + `Secure` in
  production.
- Authorization is always the cinc server's. The console pre-disables some
  controls as a convenience but never substitutes its own permission decisions.
