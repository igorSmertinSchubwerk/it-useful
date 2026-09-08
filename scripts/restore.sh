#!/usr/bin/env bash
set -euo pipefail
umask 077

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

archive_input="${1:-}"
confirmation="${2:-}"
if [[ -z "$archive_input" || "$confirmation" != confirm-replace-data ]]; then
  echo "Restore replaces the Compose database and every uploaded image." >&2
  echo "Usage: ./scripts/project.sh restore <backup.tar.gz> confirm-replace-data" >&2
  exit 2
fi

for command in docker realpath mktemp df awk sed sha256sum tar gzip stat grep; do
  command -v "$command" >/dev/null || {
    echo "Missing prerequisite: $command" >&2
    exit 1
  }
done
docker info >/dev/null 2>&1 || {
  echo "Start Docker with WSL integration enabled." >&2
  exit 1
}

[[ -f "$archive_input" ]] || {
  echo "Backup archive does not exist: $archive_input" >&2
  exit 2
}
archive="$(realpath -- "$archive_input")"
repository="$(realpath -- "$project_root")"
case "$archive" in
  "$repository"|"$repository"/*)
    echo "Restore archives must be stored outside the repository." >&2
    exit 2
    ;;
esac

restore_dir="$(mktemp -d /tmp/it-useful-restore.XXXXXXXX)"
safety_backup=""
services_quiesced=false
mutation_started=false
restore_succeeded=false
postgres_was_running=false
backend_was_running=false
frontend_was_running=false

compose() {
  docker compose --project-directory "$project_root" "$@"
}

service_is_running() {
  local container
  container="$(compose ps --quiet "$1")"
  [[ -n "$container" ]] &&
    [[ "$(docker inspect --format '{{.State.Running}}' "$container")" == true ]]
}

resume_previous_state() {
  local result=0
  local resume_services=()
  [[ "$backend_was_running" == true ]] && resume_services+=(backend)
  [[ "$frontend_was_running" == true ]] && resume_services+=(frontend)
  if ((${#resume_services[@]} > 0)); then
    compose up --detach --wait --wait-timeout 180 "${resume_services[@]}" >/dev/null || result=1
  fi
  if [[ "$postgres_was_running" == false && "$backend_was_running" == false && "$frontend_was_running" == false ]]; then
    compose stop postgres >/dev/null 2>&1 || true
  fi
  return "$result"
}

cleanup() {
  local result=$?
  trap - EXIT INT TERM
  set +e

  if [[ -d "$restore_dir" ]]; then
    case "$(realpath -- "$restore_dir")" in
      /tmp/it-useful-restore.*) rm -rf -- "$restore_dir" ;;
      *) echo "Refusing to remove unexpected restore path: $restore_dir" >&2 ;;
    esac
  fi

  if [[ "$services_quiesced" == true ]]; then
    if [[ "$result" == 0 && "$restore_succeeded" == true ]]; then
      resume_previous_state || {
        echo "Warning: data was restored, but application services did not resume cleanly." >&2
        result=1
      }
    elif [[ "$mutation_started" == false ]]; then
      resume_previous_state || result=1
    else
      echo "Restore failed after live data replacement began." >&2
      echo "Frontend and backend remain stopped to avoid serving inconsistent data." >&2
      [[ -n "$safety_backup" ]] && echo "Safety backup: $safety_backup" >&2
    fi
  fi

  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "Validating backup archive before accessing live data."
gzip --test "$archive"
members="$(tar -tzf "$archive" | LC_ALL=C sort)"
expected_members=$'database.dump\nmanifest.json\nuploads.tar.gz'
[[ "$members" == "$expected_members" ]] || {
  echo "Backup archive must contain exactly manifest.json, database.dump, and uploads.tar.gz." >&2
  exit 1
}
if tar -tvzf "$archive" | awk 'substr($1, 1, 1) != "-" { bad = 1 } END { exit bad }'; then
  :
else
  echo "Backup archive members must be regular files." >&2
  exit 1
fi

tar -xOzf "$archive" manifest.json >"$restore_dir/manifest.json"
grep -qx '  "format": "it-useful-backup",' "$restore_dir/manifest.json" || {
  echo "Unsupported backup format." >&2
  exit 1
}
grep -qx '  "version": 1,' "$restore_dir/manifest.json" || {
  echo "Unsupported backup manifest version." >&2
  exit 1
}

section_value() {
  local section="$1"
  local key="$2"
  awk -v section="$section" -v key="$key" '
    $0 ~ "\"" section "\": \\{" { inside = 1; next }
    inside && /^  }/ { exit }
    inside && $0 ~ "\"" key "\":" {
      value = $0
      sub(/^.*: /, "", value)
      sub(/,$/, "", value)
      sub(/^"/, "", value)
      sub(/"$/, "", value)
      print value
      exit
    }
  ' "$restore_dir/manifest.json"
}

manifest_db_name="$(section_value database name)"
manifest_flyway_version="$(section_value database flywaySchemaVersion)"
manifest_database_bytes="$(section_value database bytes)"
manifest_database_sha256="$(section_value database sha256)"
manifest_uploads_bytes="$(section_value uploads bytes)"
manifest_uploads_sha256="$(section_value uploads sha256)"

[[ -n "$manifest_db_name" && -n "$manifest_flyway_version" ]] || {
  echo "Backup manifest is missing database metadata." >&2
  exit 1
}
[[ "$manifest_db_name" =~ ^[A-Za-z0-9_.-]+$ ]] || {
  echo "Backup manifest contains an unsupported database name." >&2
  exit 1
}
[[ "$manifest_database_bytes" =~ ^[0-9]+$ && "$manifest_uploads_bytes" =~ ^[0-9]+$ ]] || {
  echo "Backup manifest contains invalid file sizes." >&2
  exit 1
}
[[ "$manifest_database_sha256" =~ ^[0-9a-f]{64}$ && "$manifest_uploads_sha256" =~ ^[0-9a-f]{64}$ ]] || {
  echo "Backup manifest contains invalid SHA-256 checksums." >&2
  exit 1
}

outer_database_bytes="$(tar -tvzf "$archive" | awk '$NF == "database.dump" { print $3 }')"
outer_uploads_bytes="$(tar -tvzf "$archive" | awk '$NF == "uploads.tar.gz" { print $3 }')"
outer_manifest_bytes="$(tar -tvzf "$archive" | awk '$NF == "manifest.json" { print $3 }')"
[[ "$outer_database_bytes" == "$manifest_database_bytes" && "$outer_uploads_bytes" == "$manifest_uploads_bytes" ]] || {
  echo "Archive member sizes do not match the manifest." >&2
  exit 1
}
[[ "$outer_manifest_bytes" =~ ^[0-9]+$ ]] && ((outer_manifest_bytes <= 65536)) || {
  echo "Backup manifest exceeds the 64 KiB safety limit." >&2
  exit 1
}
[[ "$manifest_flyway_version" != none ]] &&
  compgen -G "backend/src/main/resources/db/migration/V${manifest_flyway_version}__*.sql" >/dev/null || {
    echo "Backup Flyway schema version is not supported by this checkout: $manifest_flyway_version" >&2
    exit 1
  }

available_kib="$(df -Pk "$restore_dir" | awk 'NR == 2 {print $4}')"
required_kib=$(((manifest_database_bytes + manifest_uploads_bytes) / 1024 + 51200))
if ((available_kib < required_kib)); then
  echo "Insufficient temporary disk space to validate the restore." >&2
  echo "Required approximately ${required_kib} KiB; available ${available_kib} KiB." >&2
  exit 1
fi

tar -xzf "$archive" -C "$restore_dir" database.dump uploads.tar.gz
[[ "$(stat -c %s -- "$restore_dir/database.dump")" == "$manifest_database_bytes" ]] || {
  echo "Database dump size does not match the manifest." >&2
  exit 1
}
[[ "$(stat -c %s -- "$restore_dir/uploads.tar.gz")" == "$manifest_uploads_bytes" ]] || {
  echo "Upload archive size does not match the manifest." >&2
  exit 1
}
[[ "$(sha256sum "$restore_dir/database.dump" | awk '{print $1}')" == "$manifest_database_sha256" ]] || {
  echo "Database dump checksum does not match the manifest." >&2
  exit 1
}
[[ "$(sha256sum "$restore_dir/uploads.tar.gz" | awk '{print $1}')" == "$manifest_uploads_sha256" ]] || {
  echo "Upload archive checksum does not match the manifest." >&2
  exit 1
}

gzip --test "$restore_dir/uploads.tar.gz"
while IFS= read -r member; do
  case "$member" in
    /*|../*|*/../*|*/..)
      echo "Upload archive contains an unsafe path: $member" >&2
      exit 1
      ;;
  esac
done < <(tar -tzf "$restore_dir/uploads.tar.gz")
if tar -tvzf "$restore_dir/uploads.tar.gz" | awk 'substr($1, 1, 1) !~ /[-d]/ { bad = 1 } END { exit bad }'; then
  :
else
  echo "Upload archive contains a link or unsupported filesystem entry." >&2
  exit 1
fi

docker run --rm --volume "$restore_dir:/backup:ro" postgres:18.6-alpine \
  pg_restore --list /backup/database.dump >/dev/null

service_is_running postgres && postgres_was_running=true
service_is_running backend && backend_was_running=true
service_is_running frontend && frontend_was_running=true

safety_destination="${IT_USEFUL_BACKUP_DIR:-$project_root/../it-useful-backups}"
echo "Creating a pre-restore safety backup."
safety_output="$(./scripts/backup.sh "$safety_destination")"
printf '%s\n' "$safety_output"
safety_backup="$(sed -n 's/^BACKUP_ARCHIVE=//p' <<<"$safety_output")"
[[ -f "$safety_backup" ]] || {
  echo "Pre-restore safety backup was not created." >&2
  exit 1
}

echo "Stopping application services for restore."
services_quiesced=true
compose stop --timeout 30 frontend backend >/dev/null
compose up --detach --wait --wait-timeout 120 postgres >/dev/null

db_name="$(compose exec -T postgres printenv POSTGRES_DB)"
db_user="$(compose exec -T postgres printenv POSTGRES_USER)"
[[ "$manifest_db_name" == "$db_name" ]] || {
  echo "Backup database '$manifest_db_name' does not match configured database '$db_name'." >&2
  exit 1
}

if [[ -z "$(compose ps --all --quiet backend)" ]]; then
  compose create backend >/dev/null
fi
backend_container="$(compose ps --all --quiet backend)"
upload_volume="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}' "$backend_container")"
[[ -n "$upload_volume" ]] || {
  echo "Could not resolve the Compose upload volume." >&2
  exit 1
}

mutation_started=true
echo "Replacing PostgreSQL database $db_name."
compose exec -T postgres dropdb --if-exists --force --username "$db_user" "$db_name"
compose exec -T postgres createdb --username "$db_user" "$db_name"
compose exec -T postgres pg_restore --exit-on-error --no-owner --no-acl \
  --username "$db_user" --dbname "$db_name" <"$restore_dir/database.dump"

echo "Replacing uploaded image bytes."
docker run --rm --volume "$upload_volume:/target" --volume "$restore_dir:/backup:ro" \
  postgres:18.6-alpine sh -ec \
  'find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; tar -xzf /backup/uploads.tar.gz -C /target'

restored_flyway_version="$(compose exec -T postgres psql -At -U "$db_user" -d "$db_name" -c \
  "SELECT COALESCE((SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1), 'none');")"
[[ "$restored_flyway_version" == "$manifest_flyway_version" ]] || {
  echo "Restored Flyway version does not match the backup manifest." >&2
  exit 1
}

while IFS= read -r storage_path; do
  [[ -z "$storage_path" ]] && continue
  case "$storage_path" in
    /*|../*|*/../*|*/..)
      echo "Restored database contains an unsafe upload path: $storage_path" >&2
      exit 1
      ;;
  esac
  docker run --rm --volume "$upload_volume:/source:ro" postgres:18.6-alpine \
    test -f "/source/$storage_path" || {
    echo "Restored upload is missing: $storage_path" >&2
    exit 1
  }
done < <(compose exec -T postgres psql -At -U "$db_user" -d "$db_name" -c \
  "SELECT storage_path FROM element_image ORDER BY id;")

restore_succeeded=true
echo "Restore completed and verified."
echo "RESTORED_ARCHIVE=$archive"
echo "SAFETY_BACKUP=$safety_backup"
