#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

for command in docker curl npm dd; do
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
curl --fail --silent --show-error --dump-header "$test_dir/app.headers" \
  "$base_url/elements/direct-route" --output "$test_dir/app.html"
grep -q '<div id="root"></div>' "$test_dir/app.html"
grep -Fqi "content-security-policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" "$test_dir/app.headers"
grep -Fqi 'permissions-policy: camera=(), geolocation=(), microphone=()' "$test_dir/app.headers"
grep -Fqi 'referrer-policy: no-referrer' "$test_dir/app.headers"
grep -Fqi 'strict-transport-security: max-age=31536000' "$test_dir/app.headers"
grep -Fqi 'x-content-type-options: nosniff' "$test_dir/app.headers"
grep -Fqi 'x-frame-options: DENY' "$test_dir/app.headers"

for hidden_route in /actuator/health /v3/api-docs /swagger-ui.html; do
  curl --fail --silent --show-error "$base_url$hidden_route" --output "$test_dir/hidden.html"
  grep -q '<div id="root"></div>' "$test_dir/hidden.html" || {
    echo "$hidden_route exposed a backend response through the frontend." >&2
    exit 1
  }
done
docker exec "$frontend_container" wget -qO- http://backend:8080/actuator/health \
  | grep -q '"status":"UP"'

session_status="$(curl --silent --output "$test_dir/session.json" --write-out '%{http_code}' \
  -H 'Forwarded: for=203.0.113.5;proto=http;host=evil.example' \
  -H 'X-Forwarded-Proto: http' \
  -H 'Remote-User: attacker' \
  -H 'X-Forwarded-User: attacker' \
  -H 'Tailscale-User-Login: attacker@example.test' \
  "$base_url/api/session")"
[[ "$session_status" == 401 ]] || { echo "Anonymous session request was not rejected." >&2; exit 1; }
grep -q '"code":"authentication_required"' "$test_dir/session.json"

oauth_status="$(curl --silent --output /dev/null --dump-header "$test_dir/oauth.headers" \
  --write-out '%{http_code}' "$base_url/oauth2/authorization/github")"
[[ "$oauth_status" == 302 ]] || { echo "GitHub authorization route did not reach Spring." >&2; exit 1; }
grep -qi '^location: https://github.com/login/oauth/authorize?' "$test_dir/oauth.headers"
grep -Eqi 'redirect_uri=(https://it-useful-test\.test-tailnet\.ts\.net/login/oauth2/code/github|https%3A%2F%2Fit-useful-test\.test-tailnet\.ts\.net%2Flogin%2Foauth2%2Fcode%2Fgithub)' \
  "$test_dir/oauth.headers"
grep -Eqi '^set-cookie: IT_USEFUL_SESSION=[^;]+;.*Path=/.*Secure.*HttpOnly.*SameSite=Lax' \
  "$test_dir/oauth.headers"

logout_status="$(curl --silent --output /dev/null --write-out '%{http_code}' "$base_url/logout")"
[[ "$logout_status" == 401 ]] || { echo "Logout route was swallowed by the SPA fallback." >&2; exit 1; }

migration_rank_before="$(docker exec "$postgres_container" psql -U it_useful -d it_useful -tAc \
  'SELECT max(installed_rank) FROM flyway_schema_history WHERE success')"
./scripts/server-compose.sh "$server_env" --project-name "$project_name" restart postgres >/dev/null
for _ in {1..60}; do
  docker exec "$postgres_container" pg_isready -U it_useful -d it_useful >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$postgres_container" pg_isready -U it_useful -d it_useful >/dev/null
./scripts/server-compose.sh "$server_env" --project-name "$project_name" restart backend >/dev/null
for _ in {1..60}; do
  [[ "$(docker inspect --format '{{.State.Health.Status}}' "$backend_container")" == healthy ]] && break
  sleep 1
done
[[ "$(docker inspect --format '{{.State.Health.Status}}' "$backend_container")" == healthy ]] || {
  echo "Spring did not become healthy after its service restart." >&2
  exit 1
}
./scripts/server-compose.sh "$server_env" --project-name "$project_name" restart frontend >/dev/null
for _ in {1..60}; do
  [[ "$(docker inspect --format '{{.State.Health.Status}}' "$frontend_container")" == healthy ]] && break
  sleep 1
done
restarted_status="$(curl --silent --output /dev/null --write-out '%{http_code}' "$base_url/api/session" || true)"
[[ "${restarted_status:-}" == 401 ]] || { echo "Server routes did not recover after service restart." >&2; exit 1; }
migration_rank_after="$(docker exec "$postgres_container" psql -U it_useful -d it_useful -tAc \
  'SELECT max(installed_rank) FROM flyway_schema_history WHERE success')"
[[ "$migration_rank_after" == "$migration_rank_before" ]] || {
  echo "Database state changed unexpectedly across the service restart." >&2
  exit 1
}

cd frontend
E2E_BASE_URL="$base_url" npx playwright test --config playwright.server.config.ts
cd "$project_root"

dd if=/dev/zero of="$test_dir/oversized.bin" bs=1M count=13 status=none
oversized_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --request POST --header 'Content-Type: application/octet-stream' \
  --data-binary "@$test_dir/oversized.bin" "$base_url/api/elements")"
[[ "$oversized_status" == 413 ]] || { echo "The proxy did not reject a request above 12 MiB." >&2; exit 1; }

: > "$test_dir/rate-statuses"
for _ in {1..100}; do
  curl --silent --output /dev/null --write-out '%{http_code}\n' "$base_url/api/session" \
    >> "$test_dir/rate-statuses"
done
grep -q '^401$' "$test_dir/rate-statuses"
grep -q '^429$' "$test_dir/rate-statuses" || {
  echo "The assembled API did not enforce its request-rate limit." >&2
  exit 1
}

compose_logs="$(./scripts/server-compose.sh "$server_env" --project-name "$project_name" logs --no-color)"
unexpected_severe_logs="$(grep -E '(^|[[:space:]])(ERROR|FATAL|PANIC)([[:space:]]|:)|\[(error|crit|alert|emerg)\]' <<<"$compose_logs" \
  | grep -Eiv 'limiting requests|client intended to send too large body|terminating connection due to administrator command|the database system is starting up' || true)"
if [[ -n "$unexpected_severe_logs" ]]; then
  echo "Server Compose logs contain an unexpected severe entry." >&2
  printf '%s\n' "$unexpected_severe_logs" >&2
  exit 1
fi

echo "Assembled private-server security passed authorization boundary, browser defense, exposure, and restart checks."
