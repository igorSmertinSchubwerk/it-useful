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
safety_dir="$test_dir/safety-backups"
mkdir -p "$backup_dir" "$inspection_dir" "$safety_dir"
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

docker run --rm --volume "$upload_volume:/target" postgres:18.6-alpine \
  mv "/target/$image_id.png" "/target/$image_id.missing"
if ./scripts/backup.sh "$backup_dir" >/dev/null 2>&1; then
  echo "Backup accepted a missing image referenced by the database." >&2
  exit 1
fi
docker run --rm --volume "$upload_volume:/target" postgres:18.6-alpine \
  mv "/target/$image_id.missing" "/target/$image_id.png"

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

echo "Mutating both data stores before the restore drill."
compose exec -T postgres psql -v ON_ERROR_STOP=1 -U it_useful -d it_useful \
  -c "DELETE FROM element WHERE id = '$element_id';"
mutated_image="$test_dir/mutated-image.png"
printf 'mutated-image-bytes\n' >"$mutated_image"
docker run --rm --volume "$upload_volume:/target" \
  --volume "$mutated_image:/source/image.png:ro" postgres:18.6-alpine \
  sh -ec "cp /source/image.png /target/$image_id.png; printf orphan > /target/orphan.txt"

if ./scripts/restore.sh "$archive" wrong-confirmation >/dev/null 2>&1; then
  echo "Restore accepted an incorrect confirmation phrase." >&2
  exit 1
fi

tampered_dir="$test_dir/tampered"
mkdir "$tampered_dir"
cp "$inspection_dir/manifest.json" "$inspection_dir/uploads.tar.gz" \
  "$inspection_dir/database.dump" "$tampered_dir/"
printf 'tampered\n' >>"$tampered_dir/database.dump"
tampered_archive="$test_dir/tampered-backup.tar.gz"
tar -C "$tampered_dir" -czf "$tampered_archive" manifest.json database.dump uploads.tar.gz
if IT_USEFUL_BACKUP_DIR="$safety_dir" \
  ./scripts/restore.sh "$tampered_archive" confirm-replace-data >/dev/null 2>&1; then
  echo "Restore accepted a backup with a mismatched checksum." >&2
  exit 1
fi
[[ -z "$(find "$safety_dir" -maxdepth 1 -type f -print -quit)" ]] || {
  echo "Invalid archive created an unnecessary safety backup." >&2
  exit 1
}

restore_output="$(IT_USEFUL_BACKUP_DIR="$safety_dir" \
  ./scripts/restore.sh "$archive" confirm-replace-data)"
printf '%s\n' "$restore_output"
reported_archive="$(sed -n 's/^RESTORED_ARCHIVE=//p' <<<"$restore_output")"
safety_archive="$(sed -n 's/^SAFETY_BACKUP=//p' <<<"$restore_output")"
[[ "$reported_archive" == "$archive" && -f "$safety_archive" ]] || {
  echo "Restore did not report its source and safety backup correctly." >&2
  exit 1
}

restored_slug="$(compose exec -T postgres psql -At -U it_useful -d it_useful \
  -c "SELECT slug FROM element WHERE id = '$element_id';")"
translation_count="$(compose exec -T postgres psql -At -U it_useful -d it_useful \
  -c "SELECT count(*) FROM element_translation WHERE element_id = '$element_id';")"
restored_languages="$(compose exec -T postgres psql -At -U it_useful -d it_useful \
  -c "SELECT string_agg(language_code, ',' ORDER BY language_code) FROM element_translation WHERE element_id = '$element_id';")"
restored_order="$(compose exec -T postgres psql -At -U it_useful -d it_useful \
  -c "SELECT display_order FROM element_image WHERE id = '$image_id';")"
[[ "$restored_slug" == backup-validation && "$translation_count" == 3 ]] || {
  echo "Restore did not recover the definition and all translations." >&2
  exit 1
}
[[ "$restored_languages" == DE,EN,RU && "$restored_order" == 0 ]] || {
  echo "Restore did not recover language coverage or image order." >&2
  exit 1
}

restored_files="$test_dir/restored-files"
mkdir "$restored_files"
docker run --rm --volume "$upload_volume:/source:ro" --volume "$restored_files:/target" \
  postgres:18.6-alpine cp "/source/$image_id.png" /target/restored.png
cmp "$expected_image" "$restored_files/restored.png"
if docker run --rm --volume "$upload_volume:/source:ro" postgres:18.6-alpine \
  test -e /source/orphan.txt; then
  echo "Restore left an upload that was absent from the backup." >&2
  exit 1
fi

safety_inspection="$test_dir/safety-inspection"
mkdir "$safety_inspection"
tar -xzf "$safety_archive" -C "$safety_inspection" uploads.tar.gz
mkdir "$safety_inspection/uploads"
tar -xzf "$safety_inspection/uploads.tar.gz" -C "$safety_inspection/uploads"
cmp "$mutated_image" "$safety_inspection/uploads/$image_id.png"
[[ -f "$safety_inspection/uploads/orphan.txt" ]] || {
  echo "Pre-restore safety backup did not preserve the replaced upload state." >&2
  exit 1
}

service_is_running postgres
service_is_running backend
if service_is_running frontend; then
  echo "Restore started a frontend service that was previously stopped." >&2
  exit 1
fi

echo "Verifying that a stopped stack remains stopped after backup and restore."
compose stop backend postgres >/dev/null
./scripts/backup.sh "$backup_dir" >/dev/null
if service_is_running postgres || service_is_running backend || service_is_running frontend; then
  echo "Backup restarted a service that was previously stopped." >&2
  exit 1
fi
IT_USEFUL_BACKUP_DIR="$safety_dir" \
  ./scripts/restore.sh "$archive" confirm-replace-data >/dev/null
if service_is_running postgres || service_is_running backend || service_is_running frontend; then
  echo "Restore restarted a service that was previously stopped." >&2
  exit 1
fi

echo "Backup and restore validation passed: rejection guards, safety backup, three languages, image order and bytes, and service state."
