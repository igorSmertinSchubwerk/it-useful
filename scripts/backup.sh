#!/usr/bin/env bash
set -euo pipefail
umask 077

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

for command in docker realpath mktemp df awk sed sha256sum tar gzip date stat; do
  command -v "$command" >/dev/null || {
    echo "Missing prerequisite: $command" >&2
    exit 1
  }
done
docker info >/dev/null 2>&1 || {
  echo "Start Docker with WSL integration enabled." >&2
  exit 1
}

destination_input="${1:-$project_root/../it-useful-backups}"
destination="$(realpath -m -- "$destination_input")"
repository="$(realpath -- "$project_root")"

case "$destination" in
  /|"$repository"|"$repository"/*)
    echo "Backup destination must be outside the repository: $repository" >&2
    exit 2
    ;;
esac
mkdir -p -- "$destination"
destination="$(realpath -- "$destination")"
[[ -d "$destination" && -w "$destination" ]] || {
  echo "Backup destination is not a writable directory: $destination" >&2
  exit 2
}

compose() {
  docker compose --project-directory "$project_root" "$@"
}

service_is_running() {
  local container
  container="$(compose ps --quiet "$1")"
  [[ -n "$container" ]] &&
    [[ "$(docker inspect --format '{{.State.Running}}' "$container")" == true ]]
}

postgres_was_running=false
backend_was_running=false
frontend_was_running=false
service_is_running postgres && postgres_was_running=true
service_is_running backend && backend_was_running=true
service_is_running frontend && frontend_was_running=true

staging_dir=""
temporary_archive=""
services_quiesced=false

cleanup() {
  local result=$?
  trap - EXIT INT TERM
  set +e

  if [[ -n "$staging_dir" && -d "$staging_dir" ]]; then
    case "$(realpath -- "$staging_dir")" in
      "$destination"/.it-useful-backup.*) rm -rf -- "$staging_dir" ;;
      *) echo "Refusing to remove unexpected staging path: $staging_dir" >&2 ;;
    esac
  fi
  if [[ -n "$temporary_archive" && -f "$temporary_archive" ]]; then
    case "$(realpath -- "$temporary_archive")" in
      "$destination"/it-useful-backup-*.tar.gz.partial) rm -f -- "$temporary_archive" ;;
      *) echo "Refusing to remove unexpected partial archive: $temporary_archive" >&2 ;;
    esac
  fi

  if [[ "$services_quiesced" == true ]]; then
    resume_services=()
    [[ "$backend_was_running" == true ]] && resume_services+=(backend)
    [[ "$frontend_was_running" == true ]] && resume_services+=(frontend)
    if ((${#resume_services[@]} > 0)); then
      compose up --detach --wait --wait-timeout 180 "${resume_services[@]}" >/dev/null || {
        echo "Warning: backup finished, but application services did not resume cleanly." >&2
        result=1
      }
    fi
    if [[ "$postgres_was_running" == false && "$backend_was_running" == false && "$frontend_was_running" == false ]]; then
      compose stop postgres >/dev/null 2>&1 || true
    fi
  fi

  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "Quiescing application writes while PostgreSQL and uploads are captured."
services_quiesced=true
compose stop --timeout 30 frontend backend >/dev/null
compose up --detach --wait --wait-timeout 120 postgres >/dev/null

# Ensure the upload volume and its backend mount exist, even before the first full start.
if [[ -z "$(compose ps --all --quiet backend)" ]]; then
  compose create backend >/dev/null
fi
backend_container="$(compose ps --all --quiet backend)"
upload_volume="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}' "$backend_container")"
[[ -n "$upload_volume" ]] || {
  echo "Could not resolve the Compose upload volume." >&2
  exit 1
}

db_name="$(compose exec -T postgres printenv POSTGRES_DB)"
db_user="$(compose exec -T postgres printenv POSTGRES_USER)"
database_bytes="$(compose exec -T postgres psql -At -U "$db_user" -d "$db_name" -c \
  "SELECT pg_database_size(current_database());")"
flyway_version="$(compose exec -T postgres psql -At -U "$db_user" -d "$db_name" -c \
  "SELECT COALESCE((SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1), 'none');" 2>/dev/null || printf 'none')"
upload_kib="$(docker run --rm --volume "$upload_volume:/source:ro" postgres:18.6-alpine \
  sh -c "du -sk /source | awk '{print \$1}'")"

required_kib=$((database_bytes / 1024 + upload_kib + 51200))
available_kib="$(df -Pk "$destination" | awk 'NR == 2 {print $4}')"
if ((available_kib < required_kib)); then
  echo "Insufficient free space in $destination." >&2
  echo "Required approximately ${required_kib} KiB; available ${available_kib} KiB." >&2
  exit 1
fi

created_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
application_version="$(git describe --tags --always 2>/dev/null || printf 'unknown')"
archive="$destination/it-useful-backup-$timestamp-$$.tar.gz"
temporary_archive="$archive.partial"
staging_dir="$(mktemp -d "$destination/.it-useful-backup.XXXXXXXX")"

echo "Dumping PostgreSQL database $db_name."
compose exec -T postgres pg_dump --format=custom --compress=9 --no-owner --no-acl \
  -U "$db_user" -d "$db_name" >"$staging_dir/database.dump"

echo "Archiving uploaded image bytes."
docker run --rm --volume "$upload_volume:/source:ro" postgres:18.6-alpine \
  tar -C /source -czf - . >"$staging_dir/uploads.tar.gz"

database_dump_bytes="$(stat -c %s -- "$staging_dir/database.dump")"
uploads_archive_bytes="$(stat -c %s -- "$staging_dir/uploads.tar.gz")"
database_sha256="$(sha256sum "$staging_dir/database.dump" | awk '{print $1}')"
uploads_sha256="$(sha256sum "$staging_dir/uploads.tar.gz" | awk '{print $1}')"

json_escape() {
  sed 's/\\/\\\\/g; s/"/\\"/g' <<<"$1"
}

printf '{\n' >"$staging_dir/manifest.json"
printf '  "format": "it-useful-backup",\n' >>"$staging_dir/manifest.json"
printf '  "version": 1,\n' >>"$staging_dir/manifest.json"
printf '  "createdAt": "%s",\n' "$(json_escape "$created_at")" >>"$staging_dir/manifest.json"
printf '  "applicationVersion": "%s",\n' "$(json_escape "$application_version")" >>"$staging_dir/manifest.json"
printf '  "database": {\n' >>"$staging_dir/manifest.json"
printf '    "name": "%s",\n' "$(json_escape "$db_name")" >>"$staging_dir/manifest.json"
printf '    "flywaySchemaVersion": "%s",\n' "$(json_escape "$flyway_version")" >>"$staging_dir/manifest.json"
printf '    "file": "database.dump",\n' >>"$staging_dir/manifest.json"
printf '    "bytes": %s,\n' "$database_dump_bytes" >>"$staging_dir/manifest.json"
printf '    "sha256": "%s"\n' "$database_sha256" >>"$staging_dir/manifest.json"
printf '  },\n' >>"$staging_dir/manifest.json"
printf '  "uploads": {\n' >>"$staging_dir/manifest.json"
printf '    "file": "uploads.tar.gz",\n' >>"$staging_dir/manifest.json"
printf '    "bytes": %s,\n' "$uploads_archive_bytes" >>"$staging_dir/manifest.json"
printf '    "sha256": "%s"\n' "$uploads_sha256" >>"$staging_dir/manifest.json"
printf '  }\n' >>"$staging_dir/manifest.json"
printf '}\n' >>"$staging_dir/manifest.json"

tar -C "$staging_dir" -czf "$temporary_archive" manifest.json database.dump uploads.tar.gz
gzip --test "$temporary_archive"
members="$(tar -tzf "$temporary_archive" | LC_ALL=C sort)"
expected_members=$'database.dump\nmanifest.json\nuploads.tar.gz'
[[ "$members" == "$expected_members" ]] || {
  echo "Backup archive contains unexpected members." >&2
  exit 1
}
mv -- "$temporary_archive" "$archive"
chmod 600 "$archive"

echo "Backup completed and verified."
echo "BACKUP_ARCHIVE=$archive"
