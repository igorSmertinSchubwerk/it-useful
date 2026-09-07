#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

command -v git >/dev/null || {
  echo "Missing prerequisite: git" >&2
  exit 1
}
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "Run this command from an IT Useful Git checkout." >&2
  exit 1
}

failed=false
tracked_count=0

reject() {
  echo "FAIL: $1" >&2
  failed=true
}

while IFS= read -r -d '' path; do
  tracked_count=$((tracked_count + 1))
  case "$path" in
    .env|*/.env|.env.*|*/.env.*)
      [[ "$path" == *.env.example || "$path" == .env.example ]] || \
        reject "local environment file is tracked: $path"
      ;;
  esac
  case "$path" in
    node_modules/*|*/node_modules/*|target/*|*/target/*|dist/*|*/dist/*|\
    build/*|*/build/*|coverage/*|*/coverage/*|test-results/*|*/test-results/*|\
    playwright-report/*|*/playwright-report/*|.idea/*|*/.idea/*|\
    .vscode/*|*/.vscode/*|.cache/*|*/.cache/*|data/*|*/data/*|\
    logs/*|*/logs/*|uploads/*|*/uploads/*)
      [[ "$path" == uploads/.gitkeep ]] || reject "generated/runtime path is tracked: $path"
      ;;
  esac
  case "$path" in
    *.class|*.jar|*.war|*.log|*.db|*.sqlite|*.sqlite3|*.pid|*.pem|*.p12|*.pfx|*.key|\
    *.iml|*/.DS_Store|*/Thumbs.db)
      reject "generated, secret, or machine-specific file is tracked: $path"
      ;;
  esac
  if [[ -f "$path" ]]; then
    size="$(stat -c %s -- "$path")"
    ((size <= 5 * 1024 * 1024)) || reject "tracked file exceeds 5 MiB: $path"
  fi
done < <(git ls-files -z)

while read -r mode _ _ path; do
  case "$mode:$path" in
    100644:*|100755:backend/mvnw|100755:scripts/*.sh) ;;
    *) reject "unexpected tracked file mode $mode: $path" ;;
  esac
done < <(git ls-files -s)

secret_pattern='-----BEGIN (RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|github_pat_[A-Za-z0-9_]{50,}|gh[pousr]_[A-Za-z0-9]{36,}|glpat-[A-Za-z0-9_-]{20,}|sk-(proj-)?[A-Za-z0-9_-]{32,}'
secret_files="$(git grep --cached -IlE -- "$secret_pattern" -- . || true)"
[[ -z "$secret_files" ]] || reject "high-confidence credential signature found in: $secret_files"

conflict_files="$(git grep --cached -IlE '^(<<<<<<< |=======|>>>>>>> )' -- . || true)"
[[ -z "$conflict_files" ]] || reject "merge conflict marker found in: $conflict_files"

git diff --check
git diff --cached --check

if [[ "$failed" == true ]]; then
  echo "Release content audit failed." >&2
  exit 1
fi

echo "Release content audit passed for $tracked_count tracked files."
