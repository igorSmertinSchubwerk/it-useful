#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

for command in docker git tar sha256sum grep cmp; do
  command -v "$command" >/dev/null || {
    echo "Missing prerequisite: $command" >&2
    exit 1
  }
done
docker info >/dev/null 2>&1 || {
  echo "Start Docker with WSL integration enabled." >&2
  exit 1
}

project_name="it-useful-backup-test-$$-${RANDOM}"
test_dir="$(mktemp -d /tmp/it-useful-backup-test.XXXXXXXX)"
backup_dir="$test_dir/backups"
inspection_dir="$test_dir/inspection"
mkdir -p "$backup_dir" "$inspection_dir"
export COMPOSE_PROJECT_NAME="$project_name" DB_PORT=0 FRONTEND_PORT=0

compose() {
  docker compose --project-directory "$project_root" "$@"
}

cleanup() {
  local result=$?
  trap - EXIT INT TERM
  set +e
  if [[ "$result" != 0 ]]; then
    compose logs --no-color >&2 || true
  fi
  compose down --volumes --remove-orphans --rmi local >/dev/null 2>&1 || true
  case "$(realpath -- "$test_dir")" in
    /tmp/it-useful-backup-test.*) rm -rf -- "$test_dir" ;;
    *) echo "Refusing to remove unexpected test path: $test_dir" >&2 ;;
  esac
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

unsafe_destination="$project_root/.backup-test-should-not-exist"
if ./scripts/backup.sh "$unsafe_destination" >/dev/null 2>&1; then
  echo "Backup accepted a destination inside the repository." >&2
  exit 1
fi
[[ ! -e "$unsafe_destination" ]] || {
  echo "Rejected backup destination was created inside the repository." >&2
  exit 1
}

echo "Starting an isolated database and backend to initialize the schema."
compose up --build --detach --wait --wait-timeout 240 postgres backend

element_id="10000000-0000-0000-0000-000000000001"
image_id="20000000-0000-0000-0000-000000000001"
compose exec -T postgres psql -v ON_ERROR_STOP=1 -U it_useful -d it_useful <<SQL
INSERT INTO element (id, slug) VALUES ('$element_id', 'backup-validation');
INSERT INTO element_translation (id, element_id, language_code, title, content, examples) VALUES
  ('30000000-0000-0000-0000-000000000001', '$element_id', 'EN', 'Backup validation', 'English content', 'English example'),
  ('30000000-0000-0000-0000-000000000002', '$element_id', 'DE', 'Backup-Prüfung', 'Deutscher Inhalt', 'Deutsches Beispiel'),
  ('30000000-0000-0000-0000-000000000003', '$element_id', 'RU', 'Проверка резервной копии', 'Русский текст', 'Русский пример');
INSERT INTO element_image (id, element_id, file_name, storage_path, content_type, alt_text, display_order)
VALUES ('$image_id', '$element_id', 'backup-image.png', '$image_id.png', 'image/png', 'Backup validation image', 0);
SQL

backend_container="$(compose ps --all --quiet backend)"
upload_volume="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}' "$backend_container")"
expected_image="$test_dir/expected-image.png"
printf 'it-useful-backup-image-bytes\n' >"$expected_image"
docker run --rm --volume "$upload_volume:/target" --volume "$expected_image:/source/image.png:ro" \
  postgres:18.6-alpine cp /source/image.png "/target/$image_id.png"

output="$(./scripts/backup.sh "$backup_dir")"
printf '%s\n' "$output"
archive="$(sed -n 's/^BACKUP_ARCHIVE=//p' <<<"$output")"
[[ -f "$archive" ]] || {
  echo "Backup command did not produce its reported archive." >&2
  exit 1
}
[[ "$(stat -c %a -- "$archive")" == 600 ]] || {
  echo "Backup archive permissions are not owner-only." >&2
  exit 1
}

tar -xzf "$archive" -C "$inspection_dir"
grep -q '"format": "it-useful-backup"' "$inspection_dir/manifest.json"
grep -q '"version": 1' "$inspection_dir/manifest.json"
grep -q '"flywaySchemaVersion": "1"' "$inspection_dir/manifest.json"

database_sha256="$(sha256sum "$inspection_dir/database.dump" | awk '{print $1}')"
uploads_sha256="$(sha256sum "$inspection_dir/uploads.tar.gz" | awk '{print $1}')"
grep -q "\"sha256\": \"$database_sha256\"" "$inspection_dir/manifest.json"
grep -q "\"sha256\": \"$uploads_sha256\"" "$inspection_dir/manifest.json"

pg_restore_output="$(compose exec -T postgres pg_restore --data-only --file=- <"$inspection_dir/database.dump")"
grep -q 'backup-validation' <<<"$pg_restore_output"
grep -q 'English content' <<<"$pg_restore_output"
grep -q 'Deutscher Inhalt' <<<"$pg_restore_output"
grep -q 'Русский текст' <<<"$pg_restore_output"
grep -q 'Backup validation image' <<<"$pg_restore_output"

mkdir "$inspection_dir/uploads"
tar -xzf "$inspection_dir/uploads.tar.gz" -C "$inspection_dir/uploads"
cmp "$expected_image" "$inspection_dir/uploads/$image_id.png"

service_is_running() {
  local container
  container="$(compose ps --quiet "$1")"
  [[ -n "$container" ]] && [[ "$(docker inspect --format '{{.State.Running}}' "$container")" == true ]]
}
service_is_running postgres
service_is_running backend
if service_is_running frontend; then
  echo "Backup started a frontend service that was previously stopped." >&2
  exit 1
fi

echo "Verifying that a stopped stack remains stopped after backup."
compose stop backend postgres >/dev/null
./scripts/backup.sh "$backup_dir" >/dev/null
if service_is_running postgres || service_is_running backend || service_is_running frontend; then
  echo "Backup restarted a service that was previously stopped." >&2
  exit 1
fi

echo "Backup validation passed: manifest, checksums, database content, image bytes, and service state."
