#!/usr/bin/env bash
# Prints a single-use invitation link for the first admin of the server stack.
# Only the token's SHA-256 hash enters the database, and the insert succeeds only
# while no account exists, so the command cannot add a second unconfirmed admin.
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ $# -eq 2 ]] || {
  echo "Usage: $0 /absolute/path/to/server.env first.admin@example.com" >&2
  exit 2
}

server_env="$1"
email="${2,,}"
[[ "$email" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ && ${#email} -le 254 ]] || {
  echo "Expected a valid email address, received: $2" >&2
  exit 2
}

compose() {
  "${project_root}/scripts/server-compose.sh" "$server_env" "$@"
}

public_url="$(grep -E '^APP_PUBLIC_BASE_URL=' "$server_env" | cut -d= -f2-)"
db_name="$(compose exec -T postgres printenv POSTGRES_DB)"
db_user="$(compose exec -T postgres printenv POSTGRES_USER)"
token="$(head -c 32 /dev/urandom | base64 -w0 | tr '+/' '-_' | tr -d '=')"
token_hash="$(printf '%s' "$token" | sha256sum | cut -d' ' -f1)"

invitation_id="$(compose exec -T postgres psql -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 \
  --quiet --tuples-only --no-align -v email="$email" -v token_hash="$token_hash" <<'SQL'
INSERT INTO invitation (id, email, role, token_hash, created_by, created_at, expires_at)
SELECT gen_random_uuid(), :'email', 'ADMIN', :'token_hash', NULL, now(), now() + interval '7 days'
WHERE NOT EXISTS (SELECT 1 FROM account)
RETURNING id;
SQL
)"

[[ -n "$invitation_id" ]] || {
  echo "An account already exists. An admin must invite new people from the Accounts page." >&2
  exit 1
}

printf '%s/accept-invitation#%s\n' "$public_url" "$token"
