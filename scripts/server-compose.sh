#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ $# -ge 2 ]] || {
  echo "Usage: $0 /absolute/path/to/server.env <docker compose arguments>" >&2
  exit 2
}

server_env="$1"
shift
"${project_root}/scripts/validate-server-config.sh" "$server_env" >/dev/null

command -v docker >/dev/null || {
  echo "Missing prerequisite: docker" >&2
  exit 1
}
compose_version="$(docker compose version --short 2>/dev/null | sed 's/^v//')"
minimum_version="2.24.4"
[[ -n "$compose_version" ]] || {
  echo "Docker Compose 2.24.4 or newer is required." >&2
  exit 1
}
if [[ "$(printf '%s\n%s\n' "$minimum_version" "$compose_version" | sort -V | head -n 1)" != "$minimum_version" ]]; then
  echo "Docker Compose 2.24.4 or newer is required; found $compose_version." >&2
  exit 1
fi

(
  unset APP_PUBLIC_BASE_URL APP_OWNER_GITHUB_ID GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET
  unset DB_NAME DB_USER DB_PASSWORD FRONTEND_PORT
  cd "$project_root"
  exec docker compose \
    --env-file "$server_env" \
    -f compose.yaml \
    -f compose.server.yaml \
    "$@"
)
