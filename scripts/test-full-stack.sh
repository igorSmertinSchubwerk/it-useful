#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
for command in docker java npm curl; do
  command -v "$command" >/dev/null || { echo "Missing prerequisite: $command" >&2; exit 1; }
done
docker info >/dev/null 2>&1 || { echo "Start Docker with WSL integration enabled." >&2; exit 1; }
run_dir="$(mktemp -d /tmp/it-useful-e2e.XXXXXXXX)"
container_id=''
backend_pid=''
cleanup() {
  result=$?
  trap - EXIT INT TERM
  if [[ -n "$backend_pid" ]]; then
    kill "$backend_pid" 2>/dev/null || true
    for _ in {1..10}; do
      kill -0 "$backend_pid" 2>/dev/null || break
      sleep 1
    done
    kill -KILL "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  fi
  if [[ -n "$container_id" ]]; then docker rm -f "$container_id" >/dev/null || true; fi
  if [[ "$result" != 0 ]]; then
    echo "Full-stack test failed. Backend log:" >&2
    tail -80 "$run_dir/backend.log" 2>/dev/null || true
  fi
  # Only remove the exact temporary directory created by this invocation.
  if [[ "$(realpath "$run_dir")" == /tmp/it-useful-e2e.* && -d "$run_dir" ]]; then
    rm -rf -- "$run_dir"
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

(cd backend && ./mvnw -B -DskipTests package)
container_id="$(docker run -d --rm --label it-useful.test=full-stack \
  --tmpfs /var/lib/postgresql -p 127.0.0.1::5432 \
  -e POSTGRES_DB=it_useful_e2e -e POSTGRES_USER=e2e -e POSTGRES_PASSWORD=e2e_test_only \
  postgres:18.6-alpine)"
db_port="$(docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' "$container_id")"
ready=false
for _ in {1..60}; do
  if docker exec "$container_id" pg_isready -U e2e -d it_useful_e2e >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { echo "Test PostgreSQL did not become ready." >&2; exit 1; }
java -jar backend/target/it-useful-backend-0.0.1-SNAPSHOT.jar \
  --spring.profiles.active=e2e --spring.docker.compose.enabled=false \
  --server.address=127.0.0.1 --server.port=0 \
  --spring.datasource.url="jdbc:postgresql://127.0.0.1:$db_port/it_useful_e2e" \
  --spring.datasource.username=e2e --spring.datasource.password=e2e_test_only \
  --app.storage.directory="$run_dir/uploads" \
  >"$run_dir/backend.log" 2>&1 &
backend_pid=$!
backend_port=''
ready=false
for _ in {1..90}; do
  kill -0 "$backend_pid" 2>/dev/null || { echo "Test backend exited." >&2; exit 1; }
  backend_port="$(sed -n 's/.*Tomcat started on port \([0-9]*\).*/\1/p' "$run_dir/backend.log" | tail -1)"
  if [[ -n "$backend_port" ]] && curl --max-time 2 --fail --silent "http://127.0.0.1:$backend_port/actuator/health" >/dev/null; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { echo "Test backend did not become ready." >&2; exit 1; }
export E2E_BACKEND_ORIGIN="http://127.0.0.1:$backend_port"
export VITE_API_BASE_URL=/api
echo "Running against disposable backend $E2E_BACKEND_ORIGIN (not the development database)."
cd frontend
npx playwright test --config playwright.fullstack.config.ts "$@"
