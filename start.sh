#!/usr/bin/env bash

set -eu

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
backend_pid=""
frontend_pid=""

if ! command -v node >/dev/null 2>&1; then
  printf 'Error: Node.js 20 or newer is required.\n' >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  printf 'Error: npm is required.\n' >&2
  exit 1
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "$node_major" -lt 20 ]; then
  printf 'Error: Node.js 20 or newer is required (found %s).\n' "$(node --version)" >&2
  exit 1
fi

for project in backend frontend; do
  if [ ! -d "$ROOT_DIR/$project/node_modules" ]; then
    printf 'Installing %s dependencies...\n' "$project"
    (cd "$ROOT_DIR/$project" && npm ci)
  fi
done

stop_service() {
  local pid="$1"
  [ -n "$pid" ] || return 0

  if [ -n "${MSYSTEM:-}" ] && command -v taskkill.exe >/dev/null 2>&1; then
    MSYS_NO_PATHCONV=1 taskkill.exe /PID "$pid" /T /F >/dev/null 2>&1 || true
  else
    kill "$pid" 2>/dev/null || true
  fi
}

cleanup() {
  trap - INT TERM EXIT
  stop_service "$backend_pid"
  stop_service "$frontend_pid"
  for pid in "$backend_pid" "$frontend_pid"; do
    if [ -n "$pid" ]; then
      wait "$pid" 2>/dev/null || true
    fi
  done
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

npm --prefix "$ROOT_DIR/backend" run dev &
backend_pid=$!
npm --prefix "$ROOT_DIR/frontend" run dev &
frontend_pid=$!

printf 'F1 dashboard started.\n'
printf 'Frontend: http://localhost:5173\n'
printf 'Backend:  http://localhost:3001\n'
printf 'Press Ctrl+C to stop both services.\n'

while :; do
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    if wait "$backend_pid"; then
      status=0
    else
      status=$?
    fi
    printf 'Backend process exited with status %s; stopping frontend.\n' "$status" >&2
    exit "$status"
  fi

  if ! kill -0 "$frontend_pid" 2>/dev/null; then
    if wait "$frontend_pid"; then
      status=0
    else
      status=$?
    fi
    printf 'Frontend process exited with status %s; stopping backend.\n' "$status" >&2
    exit "$status"
  fi

  sleep 1
done
