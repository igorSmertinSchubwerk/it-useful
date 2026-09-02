#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

docker compose up -d --wait postgres

(
  cd backend
  SPRING_PROFILES_ACTIVE=test ./mvnw verify
)
