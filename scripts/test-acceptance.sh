#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

for command in docker git npm curl tar; do
  command -v "$command" >/dev/null || {
    echo "Missing prerequisite: $command" >&2
    exit 1
  }
done
docker info >/dev/null 2>&1 || {
  echo "Start Docker with WSL integration enabled." >&2
  exit 1
}

checkout_dir="$(mktemp -d /tmp/it-useful-acceptance.XXXXXXXX)"
project_name="it-useful-acceptance-$$-${RANDOM}"
slug="acceptance-$$-${RANDOM}"

compose() {
  docker compose --project-directory "$checkout_dir" --project-name "$project_name" "$@"
}

wait_for_url() {
  local url="$1"
  for _ in {1..60}; do
    if curl --max-time 2 --fail --silent "$url" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  echo "URL did not recover: $url" >&2
  return 1
}

wait_for_database() {
  for _ in {1..60}; do
    if compose exec -T postgres pg_isready -U it_useful -d it_useful >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "PostgreSQL did not recover." >&2
  return 1
}

cleanup() {
  result=$?
  trap - EXIT INT TERM
  if [[ "$result" != 0 ]]; then
    compose logs --no-color >&2 || true
  fi
  compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  docker image rm "${project_name}-backend:latest" \
    "${project_name}-frontend:latest" >/dev/null 2>&1 || true
  if [[ "$(realpath "$checkout_dir")" == /tmp/it-useful-acceptance.* && -d "$checkout_dir" ]]; then
    rm -rf -- "$checkout_dir"
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

git archive --format=tar HEAD | tar -xf - -C "$checkout_dir"
cp "$checkout_dir/.env.example" "$checkout_dir/.env"
export DB_PORT=0 FRONTEND_PORT=0

echo "Building and starting a clean archived checkout."
compose up --build --detach --wait --wait-timeout 240
published="$(compose port frontend 8080)"
[[ "$published" == 127.0.0.1:* ]] || {
  echo "Frontend is not bound to loopback: $published" >&2
  exit 1
}
base_url="http://$published"
wait_for_url "$base_url/healthz"
wait_for_url "$base_url/elements/00000000-0000-0000-0000-000000000000"

run_phase() {
  ACCEPTANCE_PHASE="$1" ACCEPTANCE_SLUG="$slug" E2E_BASE_URL="$base_url" \
    npx --prefix frontend playwright test \
      --config frontend/playwright.fullstack.config.ts acceptance.spec.ts
}

run_phase seed

echo "Stopping the backend to verify the visible outage state."
compose stop --timeout 1 backend
run_phase outage

echo "Restarting the backend and waiting for dependency recovery."
compose start backend
wait_for_url "$base_url/api/elements"

echo "Restarting PostgreSQL and every application container."
compose restart postgres
wait_for_database
compose restart backend frontend
published="$(compose port frontend 8080)"
[[ "$published" == 127.0.0.1:* ]] || {
  echo "Frontend is not bound to loopback after restart: $published" >&2
  exit 1
}
base_url="http://$published"
wait_for_url "$base_url/healthz"
wait_for_url "$base_url/api/elements"

run_phase verify
echo "Acceptance passed: clean startup, workflow, failures, recovery, persistence, and deletion."
