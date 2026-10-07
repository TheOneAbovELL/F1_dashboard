#!/usr/bin/env bash
#
# Convenience wrapper. The launcher itself is scripts/dev.mjs, which runs on any
# platform; this script exists so `./start.sh` keeps working for anyone used to it.
# `npm run dev` does exactly the same thing.

set -eu

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  printf 'Error: Node.js 22 or newer is required.\n' >&2
  exit 1
fi

exec node "$ROOT_DIR/scripts/dev.mjs"
