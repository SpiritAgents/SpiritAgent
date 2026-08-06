#!/usr/bin/env bash
# Idempotent Cloud Agent install script. Runs during each Build snapshot.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

export PATH="/usr/local/cargo/bin:/usr/bin:/usr/local/bin:${HOME}/.cargo/bin:${PATH}"

corepack enable 2>/dev/null || true
corepack prepare pnpm@10.33.0 --activate 2>/dev/null || true

if command -v rustup >/dev/null 2>&1; then
  rustup default stable >/dev/null 2>&1 || true
  rustup component add clippy >/dev/null 2>&1 || true
fi

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$node_major" -lt 24 ]; then
  echo "Node.js 24+ required (got $(node -v))" >&2
  exit 1
fi

pnpm install --frozen-lockfile

# Shared TS packages + CLI (always safe without secrets)
pnpm turbo run build \
  --filter='@spiritagent/agent-core' \
  --filter='@spiritagent/host-internal' \
  --filter='@spiritagent/server' \
  --filter='@spiritagent/acp-server'

cargo fetch -p spirit-agent
cargo build -p spirit-agent

# Desktop build needs SPIRIT_GITHUB_OAUTH_CLIENT_ID (add as Build Secret in dashboard)
if [ -n "${SPIRIT_GITHUB_OAUTH_CLIENT_ID:-}" ]; then
  pnpm turbo run build --filter='@spiritagent/desktop'
fi
