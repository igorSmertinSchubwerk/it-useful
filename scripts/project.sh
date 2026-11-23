#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

show_help() {
  cat <<'EOF'
Usage: ./scripts/project.sh <command>

Application commands:
  start             Build and start the complete Compose application
  stop              Stop containers and preserve application data
  status            Show Compose service status
  logs [service]    Follow all logs or one service's logs
  build             Build the backend and frontend container images
  server-validate <absolute-env-file>
                    Validate private-server secrets and the Compose model
  server-start <absolute-env-file>
                    Build and start the loopback-only private-server stack
  server-stop <absolute-env-file>
                    Stop the private-server stack and preserve its data
  server-status <absolute-env-file>
                    Show private-server service status

Verification commands:
  test              Run backend and frontend checks
  test-backend      Run Maven unit and PostgreSQL integration tests
  test-frontend     Run frontend checks and mocked browser tests
  test-full-stack   Run the real browser workflow against local processes
  test-compose      Run the real browser workflow against built images
  test-acceptance   Run release acceptance from a clean archived checkout
  test-backup       Validate backup and restore against isolated Compose data
  test-server-topology
                    Compatibility alias for test-server-security
  test-server-security
                    Verify the assembled private-server security boundary
  audit-release     Check tracked files for release-blocking content

Data commands:
  backup [directory]
                    Back up PostgreSQL and uploads together (default: ../it-useful-backups)
  restore <archive> confirm-replace-data
                    Replace Compose data from a verified backup
  reset-data delete-local-data
                    Permanently delete the Compose database and uploads
EOF
}

ensure_environment() {
  if [[ ! -f .env ]]; then
    cp .env.example .env
    echo "Created .env from .env.example"
  fi
}

select_node() {
  if command -v node >/dev/null 2>&1 && [[ "$(node --version)" == v24.* ]]; then
    return
  fi

  if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    source "${HOME}/.nvm/nvm.sh"
    nvm use --silent
  fi

  if ! command -v node >/dev/null 2>&1 || [[ "$(node --version)" != v24.* ]]; then
    echo "Node.js 24 is required. Run: nvm install && nvm use" >&2
    exit 1
  fi
}

command_name="${1:-help}"
shift || true

case "${command_name}" in
  help|-h|--help)
    show_help
    ;;
  start)
    ensure_environment
    docker compose up --build --detach --wait
    frontend_endpoint="$(docker compose port frontend 8080)"
    echo "IT Useful is available at http://${frontend_endpoint}"
    ;;
  stop)
    docker compose down
    ;;
  status)
    docker compose ps
    ;;
  logs)
    docker compose logs --follow "$@"
    ;;
  build)
    docker compose build
    ;;
  server-validate)
    [[ $# -eq 1 ]] || { echo "Usage: ./scripts/project.sh server-validate /absolute/path/to/server.env" >&2; exit 2; }
    "${project_root}/scripts/validate-server-config.sh" "$1"
    "${project_root}/scripts/server-compose.sh" "$1" config --quiet
    echo "Private server Compose configuration passed validation."
    ;;
  server-start)
    [[ $# -eq 1 ]] || { echo "Usage: ./scripts/project.sh server-start /absolute/path/to/server.env" >&2; exit 2; }
    "${project_root}/scripts/server-compose.sh" "$1" up --build --detach --wait
    frontend_endpoint="$("${project_root}/scripts/server-compose.sh" "$1" port frontend 8080)"
    echo "Private server origin is available to the local Tailscale edge at http://${frontend_endpoint}"
    ;;
  server-stop)
    [[ $# -eq 1 ]] || { echo "Usage: ./scripts/project.sh server-stop /absolute/path/to/server.env" >&2; exit 2; }
    "${project_root}/scripts/server-compose.sh" "$1" down
    ;;
  server-status)
    [[ $# -eq 1 ]] || { echo "Usage: ./scripts/project.sh server-status /absolute/path/to/server.env" >&2; exit 2; }
    "${project_root}/scripts/server-compose.sh" "$1" ps
    ;;
  test)
    "${project_root}/scripts/test-backend.sh"
    select_node
    (
      cd frontend
      npm ci
      npm run check
      npm run test:e2e
    )
    ;;
  test-backend)
    "${project_root}/scripts/test-backend.sh" "$@"
    ;;
  test-frontend)
    select_node
    (
      cd frontend
      npm ci
      npm run check
      npm run test:e2e -- "$@"
    )
    ;;
  test-full-stack)
    select_node
    "${project_root}/scripts/test-full-stack.sh" "$@"
    ;;
  test-compose)
    select_node
    "${project_root}/scripts/test-compose.sh" "$@"
    ;;
  test-acceptance)
    select_node
    "${project_root}/scripts/test-acceptance.sh" "$@"
    ;;
  test-backup)
    "${project_root}/scripts/test-backup.sh" "$@"
    ;;
  test-server-topology)
    select_node
    "${project_root}/scripts/test-server-topology.sh" "$@"
    ;;
  test-server-security)
    select_node
    "${project_root}/scripts/test-server-topology.sh" "$@"
    ;;
  audit-release)
    "${project_root}/scripts/audit-release.sh" "$@"
    ;;
  backup)
    "${project_root}/scripts/backup.sh" "$@"
    ;;
  restore)
    "${project_root}/scripts/restore.sh" "$@"
    ;;
  reset-data)
    if [[ "${1:-}" != "delete-local-data" ]]; then
      echo "Refusing to delete data without explicit confirmation." >&2
      echo "Run: ./scripts/project.sh reset-data delete-local-data" >&2
      exit 2
    fi
    docker compose down --volumes
    echo "Deleted the Compose PostgreSQL and upload volumes. This cannot be undone."
    ;;
  *)
    echo "Unknown command: ${command_name}" >&2
    show_help >&2
    exit 2
    ;;
esac
