# PostgreSQL 17 Migration

Aperture's bundled database is moving from PostgreSQL 16 to 17. This guide covers when you
need to migrate, how to do it, and how to roll back.

**You do not need to migrate for v0.7.9.** This release ships the tooling so you can migrate
when it suits you. A future release will move the default database image to 17.

---

## Do my existing backups still work?

**Yes.** Every backup you already have restores into PostgreSQL 17 without conversion.

`pg_restore` reads archives written by older versions of `pg_dump`. The incompatibility only
runs the other way — a *newer* dump cannot be read by an *older* restore. Dumping from one
major version and restoring into the next is the standard, supported upgrade path, which is
exactly what this migration does.

There is no dump conversion step and no tooling to run against your old files.

---

## Why a migration is needed at all

PostgreSQL refuses to start on a data directory created by a different major version:

```
PostgreSQL Database directory appears to contain a database; Skipping initialization
FATAL:  database files are incompatible with server
DETAIL:  The data directory was initialized by PostgreSQL version 16, which is not
         compatible with this version 17.
```

The container exits immediately, its healthcheck never passes, and Aperture will not start
because it waits for a healthy database.

**Your data is not damaged by this.** PostgreSQL checks the version and exits before writing
anything. If you hit this error, reverting the image to `pg16` brings everything back.

The fix is to export your data, let PostgreSQL 17 create a fresh data directory, and import.

---

## Before you start

| Requirement | Why |
|---|---|
| Free disk space equal to your database size | The export is written to disk before the old volume is removed |
| Aperture stopped | Prevents writes during the export |
| A named Docker volume for the database | Bind mounts need manual handling (see below) |

Check your database size:

```bash
docker exec aperture-db psql -U app -d aperture -tAc \
  "SELECT pg_size_pretty(pg_database_size('aperture'))"
```

---

## Migrating with the script

The script does every step in the safe order and refuses to remove anything until it has
verified the export is readable.

### 1. Update the image in your compose file

```yaml
services:
  db:
    image: pgvector/pgvector:pg17    # was pgvector/pgvector:pg16
```

Leave the volume name unchanged.

### 2. Stop the app, leave the database running

```bash
docker compose -f docker-compose.prod.yml stop app
```

### 3. Run the migration

```bash
./scripts/migrate-db-pg17.sh -f docker-compose.prod.yml
```

It will:

1. Confirm the database is healthy, running 16, and that your compose file already targets 17
2. Record row counts for every table, then export the database
3. Verify the export — non-empty, valid `PGDMP` header, and parseable by `pg_restore`
4. Ask you to type `migrate`, then remove the old data volume
5. Start PostgreSQL 17, which creates a fresh data directory
6. Import, then compare row counts against step 2

Nothing destructive happens before step 4, and step 4 only runs if step 3 passed.

### 4. Start Aperture

```bash
docker compose -f docker-compose.prod.yml up -d
docker logs -f aperture
```

On startup Aperture logs which PostgreSQL version it is connected to and whether its backup
tooling matches. Keep the export file the script created until you are satisfied.

---

## Migrating manually

If you prefer to do it by hand, or the script cannot resolve your setup:

```bash
# 1. Stop the app, keep the database up
docker compose -f docker-compose.prod.yml stop app

# 2. Export (note the row counts first, for comparison later)
docker exec aperture-db psql -U app -d aperture -c \
  "SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE n_live_tup > 0 ORDER BY relname"

docker exec aperture-db pg_dump -U app -d aperture --no-owner --no-acl -F c -Z 6 \
  > ./aperture_pre_pg17.dump

# 3. Verify the export before going further
head -c 5 ./aperture_pre_pg17.dump            # must print: PGDMP
docker exec -i aperture-db pg_restore --list < ./aperture_pre_pg17.dump > /dev/null

# 4. Change the image to pgvector/pgvector:pg17 in your compose file, then:
docker compose -f docker-compose.prod.yml down
docker volume rm <your_project>_pgdata

# 5. Start PostgreSQL 17 alone and wait for it
docker compose -f docker-compose.prod.yml up -d db
until docker exec aperture-db pg_isready -U app -d aperture; do sleep 2; done

# 6. Import
docker exec -i aperture-db pg_restore -U app -d aperture --no-owner --no-acl \
  < ./aperture_pre_pg17.dump

# 7. Verify, then start the app
docker exec aperture-db psql -U app -d aperture -c \
  "SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE n_live_tup > 0 ORDER BY relname"
docker compose -f docker-compose.prod.yml up -d
```

Find your volume name with `docker volume ls | grep pgdata`.

The fresh database needs no manual extension setup — the export recreates `vector`,
`pgcrypto`, and `pg_trgm`, along with all indexes including HNSW vector indexes.

---

## Rolling back

The export the script creates can be read by PostgreSQL 16, so rollback does not depend on
keeping the old volume:

1. Change the image back to `pgvector/pgvector:pg16`
2. `docker compose down` and remove the volume
3. `docker compose up -d db`, wait for ready
4. Import the same export file

If you ran the script with `--keep-old-volume`, your original data directory was copied to a
volume named `<original>_pg16` and you can point the compose file at that instead. This
option needs free space equal to your database size, which is why it is not the default.

---

## Bind mounts instead of volumes

If your database directory is a host path rather than a named Docker volume, the script will
stop and tell you so. Migrate manually and replace the volume removal step with moving the
directory aside:

```bash
mv /path/to/pgdata /path/to/pgdata-pg16
mkdir /path/to/pgdata
```

Then continue from step 5 of the manual procedure. Delete the `-pg16` directory once you have
verified the migration.

---

## External databases

If you run your own PostgreSQL rather than the bundled container, this migration does not
apply. Upgrade on your own schedule using your normal process.

One constraint to be aware of: `pg_dump` refuses to run against a server **newer** than
itself, so Aperture's bundled backup client must be at least as new as your server. Aperture
logs a clear error at startup if your server is newer than its client, because scheduled
backups would otherwise fail silently.

---

## Troubleshooting

### The database container will not start after changing the image

You changed the image without migrating. Change it back to `pgvector/pgvector:pg16`, start
up, and run the migration properly. No data was lost — PostgreSQL exits before writing.

### `unsupported version (1.16) in file header`

You are restoring with tools older than the ones that wrote the backup. See
[Backup & Restore](backup-restore.md#restore-fails) for the full explanation.

### Aperture starts but shows no movies

The database is empty, which means the import did not run or did not complete. Your export
file is still on disk — import it and restart.

### Row counts differ slightly after migration

Counts come from PostgreSQL's statistics, which are estimates on large tables. Confirm
against real counts:

```bash
docker exec aperture-db psql -U app -d aperture -c \
  'SELECT count(*) FROM movies; SELECT count(*) FROM series;'
```

---

**Previous:** [Backup & Restore](backup-restore.md) | **Next:** [Database Management](database-management.md)
