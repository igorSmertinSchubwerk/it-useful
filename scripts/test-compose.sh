#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

for command in docker npm curl; do
  command -v "$command" >/dev/null || { echo "Missing prerequisite: $command" >&2; exit 1; }
done
docker info >/dev/null 2>&1 || { echo "Start Docker with WSL integration enabled." >&2; exit 1; }

project_name="it-useful-compose-test-$$-${RANDOM}"
cleanup() {
  result=$?
  trap - EXIT INT TERM
  if [[ "$result" != 0 ]]; then
    docker compose --project-name "$project_name" logs --no-color >&2 || true
  fi
  docker compose --project-name "$project_name" down --volumes --remove-orphans --rmi local >/dev/null 2>&1 || true
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

export DB_PORT=0
export FRONTEND_PORT=0
docker compose --project-name "$project_name" up --build --detach --wait --wait-timeout 240

published="$(docker compose --project-name "$project_name" port frontend 8080)"
frontend_port="${published##*:}"
base_url="http://127.0.0.1:${frontend_port}"

[[ "$published" == 127.0.0.1:* ]] || { echo "Frontend is not loopback-only." >&2; exit 1; }
backend_container="$(docker compose --project-name "$project_name" ps --quiet backend)"
frontend_container="$(docker compose --project-name "$project_name" ps --quiet frontend)"
backend_published="$(docker port "$backend_container" 8080/tcp 2>/dev/null || true)"
if [[ -n "$backend_published" ]]; then
  echo "Backend must not publish a host port." >&2
  exit 1
fi
[[ "$(docker inspect --format '{{.Config.User}}' "$backend_container")" == app ]] || {
  echo "Backend image is not running as the app user." >&2
  exit 1
}
[[ "$(docker inspect --format '{{.Config.User}}' "$frontend_container")" == 101 ]] || {
  echo "Frontend image is not running as user 101." >&2
  exit 1
}

curl --fail --silent --show-error "$base_url/healthz" >/dev/null
curl --fail --silent --show-error "$base_url/elements/direct-route" | grep -q '<div id="root"></div>'

echo "Running against disposable Compose stack $base_url."
cd frontend
E2E_BASE_URL="$base_url" npx playwright test --config playwright.fullstack.config.ts "$@"

cd "$project_root"
compose_logs="$(docker compose --project-name "$project_name" logs --no-color)"
if grep -Eq '(^|[[:space:]])(ERROR|FATAL|PANIC)([[:space:]]|:)' <<<"$compose_logs"; then
  echo "Compose service logs contain an unexpected severe entry." >&2
  exit 1
fi
echo "Compose logs contain no ERROR, FATAL, or PANIC entries."
