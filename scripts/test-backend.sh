#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

if ! docker info >/dev/null 2>&1; then
  echo "Docker is required for integration tests. Start Docker with WSL integration enabled." >&2
  exit 1
fi

(
  cd backend
  ./mvnw verify "$@"
)
