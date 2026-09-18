#!/usr/bin/env bash
#
# Migrate Aperture's bundled PostgreSQL database from 16 to 17.
#
# A PostgreSQL container will not start on a data directory created by a
# different major version, so the upgrade is a dump/restore onto a fresh
# volume. This script does that in the safe order and refuses to destroy
# anything until the dump has been verified.
#
#   1. Verify the database is healthy and running PostgreSQL 16
#   2. Record row counts and dump the database (archive 1.15)
#   3. Verify the dump: size, PGDMP header, pg_restore --list parses
#   4. Remove the old data volume (confirmed, and only after step 3)
#   5. Start PostgreSQL 17 on a fresh volume
#   6. Restore, then compare row counts against step 2
#
# Rollback: the dump from step 2 is archive 1.15, which PostgreSQL 16 can
# still read. Revert the compose image to pg16 and restore that file.
#
# Usage:
#   ./scripts/migrate-db-pg17.sh [-f docker-compose.prod.yml] [--keep-old-volume]

set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
DB_SERVICE="db"
APP_SERVICE="app"
KEEP_OLD_VOLUME=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--file)            COMPOSE_FILE="$2"; shift 2 ;;
    --keep-old-volume)    KEEP_OLD_VOLUME=1; shift ;;
    -h|--help)            sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
die()   { red "ERROR: $*"; exit 1; }

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

[[ -f "$COMPOSE_FILE" ]] || die "Compose file not found: $COMPOSE_FILE"
command -v docker >/dev/null || die "docker is not on PATH"

# ---------------------------------------------------------------------------
# Step 1: preflight
# ---------------------------------------------------------------------------
bold "==> Step 1/6  Preflight"

DB_CONTAINER="$(compose ps -q "$DB_SERVICE" || true)"
[[ -n "$DB_CONTAINER" ]] || die "Database service '$DB_SERVICE' is not running. Start it first: docker compose -f $COMPOSE_FILE up -d $DB_SERVICE"

APP_CONTAINER="$(compose ps -q "$APP_SERVICE" || true)"
if [[ -n "$APP_CONTAINER" ]] && [[ "$(docker inspect -f '{{.State.Running}}' "$APP_CONTAINER")" == "true" ]]; then
  die "Stop the app before migrating so it cannot write mid-dump: docker compose -f $COMPOSE_FILE stop $APP_SERVICE"
fi

# Read credentials from the running container rather than guessing.
PGUSER="$(docker exec "$DB_CONTAINER" printenv POSTGRES_USER)"
PGDATABASE="$(docker exec "$DB_CONTAINER" printenv POSTGRES_DB)"
[[ -n "$PGUSER" && -n "$PGDATABASE" ]] || die "Could not read POSTGRES_USER / POSTGRES_DB from the database container"

docker exec "$DB_CONTAINER" pg_isready -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1 \
  || die "Database is not accepting connections"

SERVER_NUM="$(docker exec "$DB_CONTAINER" psql -U "$PGUSER" -d "$PGDATABASE" -tAc 'SHOW server_version_num')"
SERVER_MAJOR=$(( SERVER_NUM / 10000 ))
if [[ "$SERVER_MAJOR" -eq 17 ]]; then
  green "Server is already PostgreSQL 17 — nothing to do."
  exit 0
fi
[[ "$SERVER_MAJOR" -eq 16 ]] || die "Expected PostgreSQL 16, found major $SERVER_MAJOR. This script only migrates 16 -> 17."

# Resolve the volume backing the data directory.
DATA_VOLUME="$(docker inspect -f \
  '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$DB_CONTAINER")"
[[ -n "$DATA_VOLUME" ]] || die "Could not find a named volume mounted at /var/lib/postgresql/data (a bind mount needs manual migration)"

DB_SIZE="$(docker exec "$DB_CONTAINER" psql -U "$PGUSER" -d "$PGDATABASE" -tAc \
  "SELECT pg_size_pretty(pg_database_size('$PGDATABASE'))")"

# Confirm the compose file already targets pg17 BEFORE anything destructive.
# Without this the volume could be removed only to have pg16 start again on it.
CONFIGURED_IMAGE="$(compose config --images "$DB_SERVICE" 2>/dev/null | head -1 || true)"
if [[ -z "$CONFIGURED_IMAGE" ]]; then
  echo "  WARNING: could not read the configured image for '$DB_SERVICE'."
  echo "           Make sure $COMPOSE_FILE uses pgvector/pgvector:pg17 before continuing."
elif [[ "$CONFIGURED_IMAGE" != *pg17* ]]; then
  die "$COMPOSE_FILE still points '$DB_SERVICE' at '$CONFIGURED_IMAGE'.
     Update it to pgvector/pgvector:pg17 and re-run. Nothing has been changed."
fi

echo "  compose file : $COMPOSE_FILE"
echo "  database     : $PGDATABASE (user $PGUSER)"
echo "  server major : $SERVER_MAJOR"
echo "  target image : ${CONFIGURED_IMAGE:-unknown}"
echo "  data volume  : $DATA_VOLUME"
echo "  size         : $DB_SIZE"

# ---------------------------------------------------------------------------
# Step 2: record state and dump
# ---------------------------------------------------------------------------
bold "==> Step 2/6  Dumping database"

# Exact per-table counts. pg_stat_user_tables.n_live_tup is only an ESTIMATE
# maintained by ANALYZE/autovacuum and can be badly stale, which produces false
# "counts differ" alarms on a perfectly good migration. query_to_xml lets us run
# a real COUNT(*) per table from a single statement.
COUNT_SQL="
SELECT coalesce(string_agg(t.relname || '=' || t.cnt, E'\n' ORDER BY t.relname), '(no tables)')
FROM (
  SELECT c.relname,
         (xpath('/row/cnt/text()',
                query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', n.nspname, c.relname),
                             false, true, '')))[1]::text::bigint AS cnt
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r' AND n.nspname = 'public'
) t
WHERE t.cnt > 0;"

COUNTS_BEFORE="$(docker exec "$DB_CONTAINER" psql -U "$PGUSER" -d "$PGDATABASE" -tAc "$COUNT_SQL")"

TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
DUMP_NAME="aperture_pre_pg17_${TIMESTAMP}.dump"
DUMP_PATH="$(pwd)/${DUMP_NAME}"

docker exec "$DB_CONTAINER" pg_dump -U "$PGUSER" -d "$PGDATABASE" \
  --no-owner --no-acl -F c -Z 6 > "$DUMP_PATH"

echo "  wrote $DUMP_PATH"

# ---------------------------------------------------------------------------
# Step 3: verify the dump BEFORE destroying anything
# ---------------------------------------------------------------------------
bold "==> Step 3/6  Verifying dump"

[[ -s "$DUMP_PATH" ]] || die "Dump file is empty"
[[ "$(head -c 5 "$DUMP_PATH")" == "PGDMP" ]] || die "Dump file is missing the PGDMP header"
docker exec -i "$DB_CONTAINER" pg_restore --list < "$DUMP_PATH" >/dev/null \
  || die "pg_restore could not parse the dump — aborting before any destructive step"

DUMP_SIZE="$(du -h "$DUMP_PATH" | cut -f1)"
green "  dump verified ($DUMP_SIZE)"

# ---------------------------------------------------------------------------
# Step 4: clear the old data volume
# ---------------------------------------------------------------------------
bold "==> Step 4/6  Replacing the data volume"

red "This removes volume '$DATA_VOLUME'. Your data will live only in:"
echo "    $DUMP_PATH"
echo "Keep that file until you have verified the migration."
read -r -p "Type 'migrate' to continue: " CONFIRM
[[ "$CONFIRM" == "migrate" ]] || die "Aborted by user (nothing was changed)"

compose down

if [[ "$KEEP_OLD_VOLUME" -eq 1 ]]; then
  BACKUP_VOLUME="${DATA_VOLUME}_pg16"
  echo "  copying $DATA_VOLUME -> $BACKUP_VOLUME (needs free space equal to the database size)"
  docker volume create "$BACKUP_VOLUME" >/dev/null
  docker run --rm -v "$DATA_VOLUME":/from -v "$BACKUP_VOLUME":/to alpine \
    sh -c 'cd /from && cp -a . /to'
  green "  copy complete"
fi

docker volume rm "$DATA_VOLUME" >/dev/null
echo "  removed $DATA_VOLUME"

# ---------------------------------------------------------------------------
# Step 5: start PostgreSQL 17
# ---------------------------------------------------------------------------
bold "==> Step 5/6  Starting PostgreSQL 17"

compose up -d "$DB_SERVICE"

DB_CONTAINER="$(compose ps -q "$DB_SERVICE")"
for _ in $(seq 1 60); do
  docker exec "$DB_CONTAINER" pg_isready -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1 && break
  sleep 2
done
docker exec "$DB_CONTAINER" pg_isready -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1 \
  || die "PostgreSQL did not become ready. Check 'docker compose -f $COMPOSE_FILE logs $DB_SERVICE'. Your dump is safe at $DUMP_PATH"

NEW_NUM="$(docker exec "$DB_CONTAINER" psql -U "$PGUSER" -d "$PGDATABASE" -tAc 'SHOW server_version_num')"
NEW_MAJOR=$(( NEW_NUM / 10000 ))
[[ "$NEW_MAJOR" -eq 17 ]] || die "Expected PostgreSQL 17 after restart, found $NEW_MAJOR. Update the image in $COMPOSE_FILE to pgvector/pgvector:pg17. Your dump is safe at $DUMP_PATH"

# ---------------------------------------------------------------------------
# Step 6: restore and verify
# ---------------------------------------------------------------------------
bold "==> Step 6/6  Restoring"

docker exec -i "$DB_CONTAINER" pg_restore -U "$PGUSER" -d "$PGDATABASE" \
  --no-owner --no-acl < "$DUMP_PATH" || true   # warnings exit non-zero; row counts are the real check

COUNTS_AFTER="$(docker exec "$DB_CONTAINER" psql -U "$PGUSER" -d "$PGDATABASE" -tAc "$COUNT_SQL")"

if [[ "$COUNTS_BEFORE" == "$COUNTS_AFTER" ]]; then
  green "Row counts match exactly across every table:"
  echo "$COUNTS_AFTER" | sed 's/^/    /'
else
  red "ROW COUNTS DIFFER. These are exact counts, so this is a real mismatch:"
  diff <(echo "$COUNTS_BEFORE") <(echo "$COUNTS_AFTER") | sed 's/^/    /' || true
  echo
  echo "Your pre-migration data is still intact in:"
  echo "    $DUMP_PATH"
  echo
  echo "To roll back: set the image back to pgvector/pgvector:pg16 in $COMPOSE_FILE,"
  echo "run 'docker compose -f $COMPOSE_FILE down', remove the volume, start the db,"
  echo "and restore that file. PostgreSQL 16 can read it."
  exit 1
fi

bold "==> Done"
echo "Start the app:  docker compose -f $COMPOSE_FILE up -d"
echo "Keep this file until you are satisfied:  $DUMP_PATH"
