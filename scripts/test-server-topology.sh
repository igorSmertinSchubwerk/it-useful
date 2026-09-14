#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

for command in docker curl npm; do
  command -v "$command" >/dev/null || { echo "Missing prerequisite: $command" >&2; exit 1; }
done
docker info >/dev/null 2>&1 || { echo "Start Docker with WSL integration enabled." >&2; exit 1; }

test_dir="$(mktemp -d /tmp/it-useful-server-test.XXXXXX)"
server_env="$test_dir/server.env"
project_name="it-useful-server-test-$$-${RANDOM}"
cleanup() {
  result=$?
  trap - EXIT INT TERM
  if [[ "$result" != 0 && -f "$server_env" ]]; then
    "${project_root}/scripts/server-compose.sh" "$server_env" \
      --project-name "$project_name" logs --no-color >&2 || true
  fi
  if [[ -f "$server_env" ]]; then
    "${project_root}/scripts/server-compose.sh" "$server_env" \
      --project-name "$project_name" down --volumes --remove-orphans --rmi local >/dev/null 2>&1 || true
  fi
  case "$test_dir" in
    /tmp/it-useful-server-test.*) rm -rf -- "$test_dir" ;;
    *) echo "Refusing to remove unexpected test directory: $test_dir" >&2 ;;
  esac
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

write_valid_environment() {
  printf '%s\n' \
    'APP_PUBLIC_BASE_URL=https://it-useful-test.test-tailnet.ts.net' \
    'APP_OWNER_GITHUB_ID=42' \
    'GITHUB_CLIENT_ID=Ov23liTestClientIdentifier' \
    'GITHUB_CLIENT_SECRET=0123456789abcdef0123456789abcdef01234567' \
    'DB_NAME=it_useful' \
    'DB_USER=it_useful' \
    'DB_PASSWORD=0123456789abcdef0123456789abcdef' \
    'FRONTEND_PORT=3000' > "$server_env"
  chmod 600 "$server_env"
}

write_valid_environment
chmod 644 "$server_env"
if ./scripts/validate-server-config.sh "$server_env" >/dev/null 2>&1; then
  echo "Validator accepted group-readable server secrets." >&2
  exit 1
fi

write_valid_environment
sed -i '/^GITHUB_CLIENT_SECRET=/d' "$server_env"
if ./scripts/validate-server-config.sh "$server_env" >/dev/null 2>&1; then
  echo "Validator accepted a missing OAuth secret." >&2
  exit 1
fi

write_valid_environment
sed -i 's#^DB_PASSWORD=.*#DB_PASSWORD=replace-with-a-random-password-of-at-least-24-characters#' "$server_env"
if ./scripts/validate-server-config.sh "$server_env" >/dev/null 2>&1; then
  echo "Validator accepted a placeholder database password." >&2
  exit 1
fi

write_valid_environment
./scripts/validate-server-config.sh "$server_env" >/dev/null
./scripts/server-compose.sh "$server_env" --project-name "$project_name" config --quiet
./scripts/server-compose.sh "$server_env" --project-name "$project_name" \
  up --build --detach --wait --wait-timeout 240

postgres_container="$(./scripts/server-compose.sh "$server_env" --project-name "$project_name" ps --quiet postgres)"
backend_container="$(./scripts/server-compose.sh "$server_env" --project-name "$project_name" ps --quiet backend)"
frontend_container="$(./scripts/server-compose.sh "$server_env" --project-name "$project_name" ps --quiet frontend)"

[[ -z "$(docker port "$postgres_container" 5432/tcp 2>/dev/null || true)" ]] || {
  echo "PostgreSQL must not publish a host port in the server topology." >&2
  exit 1
}
[[ -z "$(docker port "$backend_container" 8080/tcp 2>/dev/null || true)" ]] || {
  echo "Spring must not publish a host port in the server topology." >&2
  exit 1
}
published="$(docker port "$frontend_container" 8080/tcp)"
[[ "$published" == 127.0.0.1:* ]] || {
  echo "The server frontend must publish only on IPv4 loopback." >&2
  exit 1
}

nginx_configuration="$(docker exec "$frontend_container" nginx -T 2>&1)"
grep -q 'proxy_set_header X-Forwarded-For $remote_addr;' <<<"$nginx_configuration"
grep -q 'proxy_set_header X-Forwarded-Proto https;' <<<"$nginx_configuration"
grep -q 'proxy_set_header X-Forwarded-Port 443;' <<<"$nginx_configuration"
grep -q 'proxy_set_header Tailscale-User-Login "";' <<<"$nginx_configuration"

frontend_port="${published##*:}"
base_url="http://127.0.0.1:${frontend_port}"
curl --fail --silent --show-error "$base_url/healthz" >/dev/null
curl --fail --silent --show-error "$base_url/elements/direct-route" | grep -q '<div id="root"></div>'

session_status="$(curl --silent --output "$test_dir/session.json" --write-out '%{http_code}' \
  -H 'Forwarded: for=203.0.113.5;proto=http;host=evil.example' \
  -H 'X-Forwarded-Proto: http' \
  "$base_url/api/session")"
[[ "$session_status" == 401 ]] || { echo "Anonymous session request was not rejected." >&2; exit 1; }
grep -q '"code":"authentication_required"' "$test_dir/session.json"

oauth_status="$(curl --silent --output /dev/null --dump-header "$test_dir/oauth.headers" \
  --write-out '%{http_code}' "$base_url/oauth2/authorization/github")"
[[ "$oauth_status" == 302 ]] || { echo "GitHub authorization route did not reach Spring." >&2; exit 1; }
grep -qi '^location: https://github.com/login/oauth/authorize?' "$test_dir/oauth.headers"
grep -Eqi 'redirect_uri=(https://it-useful-test\.test-tailnet\.ts\.net/login/oauth2/code/github|https%3A%2F%2Fit-useful-test\.test-tailnet\.ts\.net%2Flogin%2Foauth2%2Fcode%2Fgithub)' \
  "$test_dir/oauth.headers"

logout_status="$(curl --silent --output /dev/null --write-out '%{http_code}' "$base_url/logout")"
[[ "$logout_status" == 401 ]] || { echo "Logout route was swallowed by the SPA fallback." >&2; exit 1; }

cd frontend
E2E_BASE_URL="$base_url" npx playwright test --config playwright.server.config.ts
cd "$project_root"

compose_logs="$(./scripts/server-compose.sh "$server_env" --project-name "$project_name" logs --no-color)"
if grep -Eq '(^|[[:space:]])(ERROR|FATAL|PANIC)([[:space:]]|:)' <<<"$compose_logs"; then
  echo "Server Compose logs contain an unexpected severe entry." >&2
  exit 1
fi

echo "Private server topology passed configuration, socket, proxy, and browser checks."
