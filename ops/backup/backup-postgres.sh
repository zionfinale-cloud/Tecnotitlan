#!/usr/bin/env bash
set -Eeuo pipefail

backup_dir="${TECNOTITLAN_BACKUP_DIR:-/var/backups/tecnotitlan}"
env_file="${TECNOTITLAN_BACKUP_ENV:-/etc/tecnotitlan/backup.env}"
key_file="${TECNOTITLAN_BACKUP_KEY:-/etc/tecnotitlan/backup.key}"
retention_days="${TECNOTITLAN_BACKUP_RETENTION_DAYS:-14}"

if [[ "$backup_dir" != /var/backups/tecnotitlan* ]]; then
  echo "Backup directory outside the approved location: $backup_dir" >&2
  exit 1
fi
[[ -r "$env_file" ]] || { echo "Missing $env_file" >&2; exit 1; }
[[ -r "$key_file" ]] || { echo "Missing $key_file" >&2; exit 1; }

install -d -m 0700 "$backup_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
temporary="$backup_dir/.postgres-$timestamp.dump.enc.tmp"
destination="$backup_dir/postgres-$timestamp.dump.enc"
trap 'rm -f -- "$temporary"' EXIT

docker run --rm --env-file "$env_file" postgres:17-alpine \
  sh -c 'pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL"' \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 250000 -pass "file:$key_file" -out "$temporary"

openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 -pass "file:$key_file" -in "$temporary" \
  | docker run --rm -i postgres:17-alpine pg_restore --list >/dev/null

chmod 0600 "$temporary"
mv -- "$temporary" "$destination"
sha256sum "$destination" > "$destination.sha256"
chmod 0600 "$destination.sha256"
find "$backup_dir" -maxdepth 1 -type f \( -name 'postgres-*.dump.enc' -o -name 'postgres-*.dump.enc.sha256' \) -mtime "+$retention_days" -delete
echo "Verified encrypted backup created: $destination"
