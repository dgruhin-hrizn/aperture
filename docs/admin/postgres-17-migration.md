# PostgreSQL 16 and 17

Aperture ships **PostgreSQL 16** (`pgvector/pgvector:pg16`) and bundles the **PostgreSQL 17**
client tools. That pairing is deliberate and needs no action from you.

**You do not need to migrate.** This guide is for operators who want to run PostgreSQL 17
anyway, and for anyone moving a database back down to 16.

---

## Why the client is one major ahead of the server

PostgreSQL's client/server compatibility runs in one direction only:

- `pg_dump` works against a server **older** than itself, never newer.
- `pg_restore` reads archives from **older** versions of `pg_dump`, never newer.

A 17 client against a 16 server therefore backs up and restores correctly, **and** it can read
every backup Aperture has ever produced — including the archive-1.16 files written by releases
before 0.7.10. A client pinned to 16 could not read those:

```
pg_restore: error: unsupported version (1.16) in file header
```

It also means moving your database to 17 later requires no client change.

The one rule to respect: **do not run a server newer than 17**, or backups stop working
entirely. Aperture logs an explicit error at startup if it detects that.

---

## Do my existing backups still work?

**Yes.** Every backup you have restores through Admin → Settings → System, whichever Aperture
release created it, and whether your server is 16 or 17.

A pg16-era backup also restores into a pg17 server with no conversion, because dumping from
one major version and restoring into the next is the standard upgrade path. There is no file
to convert and no tool to run against your old backups.

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

## Migrating to PostgreSQL 17 with the script

**Optional.** Only do this if you specifically want to run PostgreSQL 17. Aperture works
fully on the shipped PostgreSQL 16.

The script does every step in the safe order and refuses to remove anything until it has
verified the export is readable.

### 1. Point your compose file at pg17

The shipped compose files use `pg16`. Change the `db` service in your own copy:

```yaml
services:
  db:
    image: pgvector/pgvector:pg17    # was pgvector/pgvector:pg16
```

Leave the volume name unchanged. The script refuses to run if the compose file still points at
16, so it cannot remove your volume and then start the old version on it.

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

## Going back to PostgreSQL 16

Returning to the shipped configuration needs a different technique than the upgrade, because
`pg_dump` 16 cannot connect to a 17 server and `pg_restore` 16 cannot read a custom-format
archive written by 17. **Plain SQL avoids both limits** — it carries no archive version.

### Easiest: restore an existing backup

If you have a backup from before you moved to 17, and you can accept losing anything written
since, just restore it into a fresh pg16 database. Skip the export entirely and go to step 2.

### Otherwise: export as plain SQL first

```bash
# 1. With the stack still on 17, export as plain SQL (-F p, not -F c)
docker compose -f docker-compose.prod.yml stop app
docker exec aperture-db pg_dump -U app -d aperture --no-owner --no-acl -F p \
  > ./aperture_pg17_plain.sql

# 2. Set the db image back to pgvector/pgvector:pg16, then replace the volume
docker compose -f docker-compose.prod.yml down
docker volume rm <your_project>_pgdata
docker compose -f docker-compose.prod.yml up -d db
until docker exec aperture-db pg_isready -U app -d aperture; do sleep 2; done

# 3a. Load the plain SQL export
docker exec -i aperture-db psql -U app -d aperture < ./aperture_pg17_plain.sql

# 3b. OR restore a pre-17 backup instead, using a 17 client because pg16's
#     own pg_restore cannot read archives written by a newer pg_dump
docker run --rm -i --network container:aperture-db -e PGPASSWORD=app \
  pgvector/pgvector:pg17 \
  pg_restore -h 127.0.0.1 -U app -d aperture --no-owner --no-acl < /path/to/backup.dump

# 4. Verify, then start the app
docker exec aperture-db psql -U app -d aperture -c \
  'SELECT count(*) FROM movies; SELECT count(*) FROM series;'
docker compose -f docker-compose.prod.yml up -d
```

Expect one error in step 3, and ignore it:

```
ERROR:  unrecognized configuration parameter "transaction_timeout"
```

The 17 client emits a session setting PostgreSQL 16 does not recognize. It has no effect on
your data — verify by row count rather than exit status.

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

You changed the `db` image to `pg17` without migrating. `docker logs aperture-db` shows:

```
FATAL:  database files are incompatible with server
DETAIL:  The data directory was initialized by PostgreSQL version 16, which is not
         compatible with this version 17.
```

**Your data is intact.** PostgreSQL validates the version and exits before writing anything.

Get back online immediately:

```bash
# 1. Point the db service back at pg16 in your compose file:
#      image: pgvector/pgvector:pg16
# 2. Bring the stack back up
docker compose -f docker-compose.prod.yml up -d
```

Aperture runs again on 16, which is the supported configuration. If you still want 17, follow
[Migrating to PostgreSQL 17 with the script](#migrating-to-postgresql-17-with-the-script).

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
