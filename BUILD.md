# Building Cinc Console Images

Manual Docker build instructions for local or alternate environments. This
repository also includes workflows for automated build and release.

## Public npm Registry

Default build path for open-source dependencies:

```bash
docker build -t cinc-console:local .
```

## Private npm Registry (Token Auth)

This path is only required when the machine running `docker build` cannot use
the public npm registry (`https://registry.npmjs.org`).

Use this section when your build environment is restricted, for example:

- Network policy or firewall blocks outbound access to public npm.
- The environment is air-gapped and must use an internal mirror.
- Company policy requires dependency downloads through an approved private
  registry.

If your machine can access public npm normally, use the Public npm Registry
section instead. You do not need `.npmrc` for that case.

1. Create `.npmrc` from `.npmrc.template`.

```bash
cp .npmrc.template .npmrc
```

1. Configure `.npmrc` with your registry and token.

```ini
registry=https://registry.example.com/artifactory/api/npm/npm-virtual/
//registry.example.com/artifactory/api/npm/npm-virtual/:_authToken=REPLACE_WITH_TOKEN
```

1. Build the image.

```bash
docker build -t cinc-console:local .
```

Optional: inject the token from an environment variable before build.

```bash
NPM_TOKEN=replace_with_token
cat > .npmrc <<EOF
registry=https://registry.example.com/artifactory/api/npm/npm-virtual/
//registry.example.com/artifactory/api/npm/npm-virtual/:_authToken=${NPM_TOKEN}
EOF
```

The Dockerfile reads `registry=` and `//...:_authToken=` values from `.npmrc`.

## Cross-Platform Build (amd64 on arm64)

`--platform` tells Docker which CPU architecture to build for, independent of
the architecture of the machine running the build.

This is required when your build host and runtime target differ. For example,
when building on a Mac ARM64 host but deploying to a Kubernetes environment
that only runs AMD64 nodes, you must build an `linux/amd64` image. Without this,
Docker will usually produce an ARM64 image on Apple Silicon, which can fail to
start in an AMD64-only cluster (for example with `exec format error`).

For that case, use Docker Buildx:

```bash
docker buildx build \
  --platform linux/amd64 \
  -t cinc-console:local \
  .
```

To push directly during build. Set `VERSION` to the release you are building
(`export VERSION=0.5.0`); these examples stay unpinned so they cannot go stale:

```bash
docker buildx build \
  --platform linux/amd64 \
  -t registry.example.com/cinc/cinc-console:$VERSION \
  --push \
  .
```

## Multi-Platform Build (amd64 + arm64)

You can publish a single image tag that includes multiple CPU architectures.
This is useful when some environments run AMD64 nodes and others run ARM64.

Use Docker Buildx with a comma-separated platform list:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t registry.example.com/cinc/cinc-console:$VERSION \
  --push \
  .
```

Notes:

- Multi-platform builds require a registry push (`--push`) to publish the
  manifest list.
- `--load` imports only a single-platform image into the local Docker daemon;
  for local testing, build one platform at a time.

## Security

- `.npmrc` is used only during the `deps` stage and is not copied into the
  runtime image.
- `.npmrc` should remain gitignored and never committed.
- `.npmrc.template` is safe to commit because it contains no credentials.
- Prefer short-lived registry tokens when possible.
