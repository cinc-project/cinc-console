#!/usr/bin/env bash
# End-to-end run: boot a throwaway cinc-server-ng (the Go successor to
# cinc-zero) from the e2e/fixtures/state seed, point the console at it, and run
# the Playwright suite. Extra arguments go to `playwright test`.
#
#   bash scripts/e2e.sh                 # whole suite
#   bash scripts/e2e.sh e2e/login.spec.ts --headed
#
# The server binary comes from CINC_SERVER_NG_BIN, else the pinned release
# below (downloaded once into .cache/e2e/ and checksum-verified).
set -euo pipefail

cd "$(dirname "$0")/.."

CINC_SERVER_NG_VERSION="v0.17.0"
CINC_PORT="${E2E_CINC_PORT:-8899}"

# SHA256SUMS from the cinc-project/cinc-server-ng $CINC_SERVER_NG_VERSION release.
sha_for() {
  case "$1" in
    darwin_amd64) echo d8ee70cbfffd4c8d37140664e9e7e8c4e6ec8d6f9cd89e86ad0e6377c486b8dd ;;
    darwin_arm64) echo 929c1bbd26df6707c3166dce843749db4472d284121ebf35f51200e3c02002c3 ;;
    linux_amd64) echo 030238955d69de260523d85f3c774023c3b0c034d7ab10aca9d9c7a613267ba6 ;;
    linux_arm64) echo 8fa0375aa4611fd6257dfcc6a03fa24a0cda64682e606c6533f0074381269737 ;;
    *) echo "unsupported platform: $1" >&2; return 1 ;;
  esac
}

sha256() {
  if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1
}

install_server() {
  local os arch platform dir tarball url want
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  case "$(uname -m)" in
    x86_64 | amd64) arch=amd64 ;;
    arm64 | aarch64) arch=arm64 ;;
    *) echo "unsupported arch: $(uname -m)" >&2; return 1 ;;
  esac
  platform="${os}_${arch}"
  dir=".cache/e2e/cinc-server-ng_${CINC_SERVER_NG_VERSION}_${platform}"
  if [[ -x "$dir/cinc-server-ng" ]]; then
    echo "$dir/cinc-server-ng"
    return
  fi
  want="$(sha_for "$platform")"
  tarball="cinc-server-ng_${CINC_SERVER_NG_VERSION}_${platform}.tar.gz"
  url="https://github.com/cinc-project/cinc-server-ng/releases/download/${CINC_SERVER_NG_VERSION}/${tarball}"
  mkdir -p .cache/e2e
  echo "==> downloading $url" >&2
  curl -fsSL -o ".cache/e2e/$tarball" "$url"
  if [[ "$(sha256 ".cache/e2e/$tarball")" != "$want" ]]; then
    echo "checksum mismatch for $tarball" >&2
    rm -f ".cache/e2e/$tarball"
    return 1
  fi
  tar -xzf ".cache/e2e/$tarball" -C .cache/e2e
  rm -f ".cache/e2e/$tarball"
  echo "$dir/cinc-server-ng"
}

if [[ "${1:-}" == "--install-only" ]]; then
  install_server
  exit 0
fi

bin="${CINC_SERVER_NG_BIN:-$(install_server)}"

tmp="$(mktemp -d)"
server_pid=""
cleanup() {
  if [[ -n "$server_pid" ]]; then kill "$server_pid" 2>/dev/null || true; fi
  rm -rf "$tmp"
}
trap cleanup EXIT

# A private copy of the seed, so nothing the server does touches the fixture.
cp -R e2e/fixtures/state "$tmp/state"

echo "==> starting $bin on 127.0.0.1:$CINC_PORT"
# ACLs are enforced by default; the admin key it writes doubles as the webui key.
"$bin" --addr "127.0.0.1:$CINC_PORT" --state "$tmp/state" --key-out "$tmp/webui.pem" \
  >"$tmp/server.log" 2>&1 &
server_pid=$!

for _ in $(seq 1 50); do
  if [[ -s "$tmp/webui.pem" ]] && curl -fs "http://127.0.0.1:$CINC_PORT/_status" >/dev/null; then
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "cinc-server-ng exited early:" >&2
    cat "$tmp/server.log" >&2
    exit 1
  fi
  sleep 0.2
done
if ! curl -fs "http://127.0.0.1:$CINC_PORT/_status" >/dev/null; then
  echo "cinc-server-ng did not come up:" >&2
  cat "$tmp/server.log" >&2
  exit 1
fi

export CINC_SERVER_URL="http://127.0.0.1:$CINC_PORT"
CINC_WEBUI_KEY="$(cat "$tmp/webui.pem")"
export CINC_WEBUI_KEY
SESSION_SECRET="$(openssl rand -hex 32)"
export SESSION_SECRET

status=0
pnpm exec playwright test "$@" || status=$?
if [[ $status -ne 0 ]]; then
  echo "==> cinc-server-ng log (tail)" >&2
  tail -n 50 "$tmp/server.log" >&2 || true
fi
exit $status
