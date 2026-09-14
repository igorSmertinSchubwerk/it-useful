#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "Server configuration is invalid: $1" >&2
  exit 1
}

[[ $# -eq 1 ]] || fail "usage: $0 /absolute/path/to/server.env"

config_path="$1"
[[ "$config_path" == /* ]] || fail "use an absolute environment-file path"
[[ ! -L "$config_path" ]] || fail "the environment file must not be a symbolic link"
[[ -f "$config_path" ]] || fail "the environment file does not exist or is not a regular file"
[[ -r "$config_path" ]] || fail "the environment file is not readable"

file_mode="$(stat -c '%a' -- "$config_path")"
case "$file_mode" in
  400|600) ;;
  *) fail "permissions must be 400 or 600, not $file_mode" ;;
esac

file_owner="$(stat -c '%u' -- "$config_path")"
current_user="$(id -u)"
[[ "$file_owner" == 0 || "$file_owner" == "$current_user" ]] || \
  fail "the environment file must be owned by root or the current user"

declare -A values=()
declare -A seen=()
line_number=0
while IFS= read -r line || [[ -n "$line" ]]; do
  line_number=$((line_number + 1))
  line="${line%$'\r'}"
  [[ -z "$line" || "$line" == \#* ]] && continue
  [[ "$line" =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]] || \
    fail "line $line_number must use KEY=value without spaces around '='"
  key="${BASH_REMATCH[1]}"
  value="${BASH_REMATCH[2]}"
  [[ -z "${seen[$key]:-}" ]] || fail "duplicate setting $key"
  case "$key" in
    APP_PUBLIC_BASE_URL|APP_OWNER_GITHUB_ID|GITHUB_CLIENT_ID|GITHUB_CLIENT_SECRET|\
    DB_NAME|DB_USER|DB_PASSWORD|FRONTEND_PORT) ;;
    *) fail "unsupported setting $key" ;;
  esac
  [[ -n "$value" ]] || fail "$key must not be empty"
  [[ "$value" != *[[:space:]]* ]] || fail "$key must not contain whitespace"
  values[$key]="$value"
  seen[$key]=1
done < "$config_path"

required=(
  APP_PUBLIC_BASE_URL
  APP_OWNER_GITHUB_ID
  GITHUB_CLIENT_ID
  GITHUB_CLIENT_SECRET
  DB_NAME
  DB_USER
  DB_PASSWORD
)
for key in "${required[@]}"; do
  [[ -n "${values[$key]:-}" ]] || fail "missing $key"
done

public_url="${values[APP_PUBLIC_BASE_URL]}"
[[ "$public_url" =~ ^https://[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+\.ts\.net$ ]] || \
  fail "APP_PUBLIC_BASE_URL must be an exact https:// device.tailnet.ts.net origin"
[[ "$public_url" != *tailnet-name* && "$public_url" != *example* ]] || \
  fail "APP_PUBLIC_BASE_URL still contains a placeholder"

[[ "${values[APP_OWNER_GITHUB_ID]}" =~ ^[1-9][0-9]{0,18}$ ]] || \
  fail "APP_OWNER_GITHUB_ID must be a positive numeric GitHub user ID"
[[ "${values[GITHUB_CLIENT_ID]}" =~ ^[A-Za-z0-9._-]{10,100}$ ]] || \
  fail "GITHUB_CLIENT_ID has an unexpected format"
[[ "${values[GITHUB_CLIENT_ID]}" != replace-* ]] || \
  fail "GITHUB_CLIENT_ID still contains a placeholder"
[[ "${values[GITHUB_CLIENT_SECRET]}" =~ ^[A-Za-z0-9_-]{20,200}$ ]] || \
  fail "GITHUB_CLIENT_SECRET has an unexpected format"
[[ "${values[GITHUB_CLIENT_SECRET]}" != replace-* ]] || \
  fail "GITHUB_CLIENT_SECRET still contains a placeholder"
[[ "${values[DB_NAME]}" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]] || \
  fail "DB_NAME must be a PostgreSQL identifier"
[[ "${values[DB_USER]}" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]] || \
  fail "DB_USER must be a PostgreSQL identifier"
[[ "${values[DB_PASSWORD]}" =~ ^[A-Za-z0-9._~!@%+=:-]{24,200}$ ]] || \
  fail "DB_PASSWORD must contain 24-200 supported non-whitespace characters"
[[ "${values[DB_PASSWORD]}" != replace-* && "${values[DB_PASSWORD]}" != it_useful_local ]] || \
  fail "DB_PASSWORD still contains an unsafe default or placeholder"

if [[ -n "${values[FRONTEND_PORT]:-}" ]]; then
  frontend_port="${values[FRONTEND_PORT]}"
  [[ "$frontend_port" =~ ^[0-9]{1,5}$ ]] || fail "FRONTEND_PORT must be numeric"
  ((frontend_port >= 1 && frontend_port <= 65535)) || \
    fail "FRONTEND_PORT must be between 1 and 65535"
fi

echo "Server environment file passed validation."
