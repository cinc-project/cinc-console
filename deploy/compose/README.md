# Deploy with Docker Compose

A single-host alternative to the Helm chart in [`../helm/cinc-console`](../helm/cinc-console),
with the same defaults and hardening:

| Helm chart | Compose |
| --- | --- |
| Deployment + Service | `cinc-console` service (non-root uid 1000, read-only root filesystem, all capabilities dropped, same CPU/memory limits) |
| ConfigMap | `cinc-console.env` |
| Secret | `./secrets/*`, mounted as Compose secrets |
| Ingress | optional `caddy` service (`proxy` profile) terminating TLS |

Requires Docker Engine with the Compose v2 plugin. All commands below run from
this directory.

## 1. Configure

```bash
cp cinc-console.env.example cinc-console.env   # set CINC_SERVER_URL at least
cp .env.example .env                            # optional: bind address, Caddy hostname
```

Comment out a setting you don't need instead of leaving it empty: the app
validates its configuration at boot, and an empty value is not the same as an
unset one (`CINC_AUTH_ACTOR=` signs logins as an empty user,
`SESSION_COOKIE_SECURE=` prevents startup).

## 2. Provide the secrets

```bash
mkdir -p secrets

# webui key from the Cinc server
scp root@cinc-server:/etc/opscode/webui_priv.pem secrets/webui_priv.pem

# Session cookie encryption secret: 32+ characters. Keep it stable —
# regenerating it signs everyone out.
openssl rand -base64 48 | tr -d '\n' > secrets/session_secret

# The container runs as uid 1000, like the chart's securityContext
sudo chown 1000:1000 secrets/*
sudo chmod 400 secrets/*
```

The Helm chart generates `SESSION_SECRET` for you; here you create it once.
`secrets/`, `certs/` and `cinc-console.env` are gitignored.

The webui key lets the console act as any user on the Cinc server, so keep the
console off untrusted networks: by default it is published on `127.0.0.1:3000`
only.

## 3. Start

```bash
docker compose up -d --build
docker compose ps        # wait for "healthy"
```

This builds the image from this checkout. To run a published release instead,
edit `compose.yaml`: delete the `build` key and set
`image: ghcr.io/cinc-project/cinc-console:<version>`.

## TLS

The session cookie carries the `Secure` flag in production, so browsers must
reach the console over HTTPS. For a quick test, an SSH tunnel to
`http://localhost:3000` works too, since browsers treat `localhost` as secure.

**With the bundled Caddy:** put your certificate in `certs/fullchain.pem` and
`certs/privkey.pem` (or edit `Caddyfile` to use ACME), set `CINC_CONSOLE_HOST`
in `.env`, then:

```bash
# Caddy runs as root with every capability dropped, so it can only read
# files root owns. The console (uid 1000) also reads any CA you put here.
sudo chown -R root:root certs
sudo chmod 755 certs && sudo chmod 644 certs/*.pem
sudo chmod 600 certs/privkey.pem

docker compose --profile proxy up -d --build
```

**With your own reverse proxy:** pass the public hostname through in `Host`
or `X-Forwarded-Host`. When a browser sends no `Sec-Fetch-Site` header, the
login CSRF check compares its `Origin` with those two headers. With nginx:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
```

## Private CA and LDAP

- **Cinc server with a self-signed or private-CA certificate:** put the CA in
  `certs/cinc-ca.pem` (readable by uid 1000, for example mode 644) and
  uncomment `CINC_CA_CERT_FILE` and the matching `volumes` entry in
  `compose.yaml`.
- **`AUTH_MODE=ldap`:** set the `LDAP_*` values in `cinc-console.env`. For a
  service-account bind, create the password file without a trailing newline
  (it is read verbatim), then uncomment `LDAP_BIND_PASSWORD_FILE` and the
  `ldap_bind_password` secret in `compose.yaml`:

  ```bash
  printf '%s' 'the-password' > secrets/ldap_bind_password
  ```

## Differences from the chart

- One instance instead of two replicas. The app is stateless, so more
  instances work as long as they share the same `session_secret`.
- Docker never restarts an unhealthy container on its own. To match the
  chart's livenessProbe, the healthcheck kills the server after three
  consecutive failures, and the restart policy starts a fresh container.
- No NetworkPolicy equivalent. To restrict egress to the Cinc server and the
  directory, use firewall rules (for example the `DOCKER-USER` iptables chain).
- `SESSION_SECRET` has no `_FILE` variant, so the entrypoint reads it from the
  Compose secret at startup, which keeps it out of `docker inspect`.
