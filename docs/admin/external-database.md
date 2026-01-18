# External PostgreSQL Database

This guide explains how to use your own PostgreSQL database with Aperture instead of the built-in database container. This is for advanced users who want more control over their database infrastructure.

## When to Use an External Database

Consider using an external database if you:

- Already have a PostgreSQL server you want to use
- Want to use a managed database service (AWS RDS, Supabase, DigitalOcean, etc.)
- Need enterprise features like replication, point-in-time recovery, or high availability
- Want to centralize database management across multiple services
- Have specific compliance or security requirements

For most home users, the default setup with the built-in database container is recommended.

## Requirements

Your PostgreSQL database must meet these requirements:

| Requirement | Details |
|-------------|---------|
| PostgreSQL Version | 14 or higher (16+ recommended) |
| pgvector Extension | **Required** - not included in standard PostgreSQL |
| pgcrypto Extension | Required (usually included by default) |
| Database | A dedicated database for Aperture |
| User Permissions | Full privileges on the Aperture database |

### Why pgvector is Required

Aperture uses AI embeddings for recommendations and similarity search. These embeddings are stored as vectors in the database, and pgvector provides the specialized data types and indexing needed for efficient vector operations.

**Standard PostgreSQL does NOT include pgvector** - you must install it separately or use a PostgreSQL distribution that includes it.

## Installing pgvector

### Option 1: Docker with pgvector (Recommended for Self-Hosted)

If you're running PostgreSQL in Docker, use the official pgvector image:

```bash
docker run -d \
  --name postgres-pgvector \
  -e POSTGRES_USER=aperture \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e POSTGRES_DB=aperture \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  pgvector/pgvector:pg16
```

### Option 2: Install pgvector on Existing PostgreSQL

For Debian/Ubuntu:

```bash
# Install build dependencies
sudo apt-get install postgresql-server-dev-16 build-essential git

# Clone and build pgvector
git clone --branch v0.7.4 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Restart PostgreSQL
sudo systemctl restart postgresql
```

For other platforms, see the [pgvector installation guide](https://github.com/pgvector/pgvector#installation).

### Option 3: Managed Database Services

Many managed PostgreSQL services now support pgvector:

| Service | pgvector Support |
|---------|------------------|
| Supabase | Built-in |
| Neon | Built-in |
| AWS RDS | Available as extension |
| Azure Database for PostgreSQL | Available in Flexible Server |
| Google Cloud SQL | Available as extension |
| DigitalOcean Managed Databases | Available |

Check your provider's documentation for enabling the pgvector extension.

## Database Setup

### 1. Create the Database and User

Connect to your PostgreSQL server as a superuser and run:

```sql
-- Create a dedicated user for Aperture
CREATE USER aperture WITH PASSWORD 'your_secure_password';

-- Create the database
CREATE DATABASE aperture OWNER aperture;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE aperture TO aperture;
```

### 2. Enable Required Extensions

Connect to the `aperture` database and enable the extensions:

```sql
-- Connect to the aperture database first
\c aperture

-- Enable pgvector (required for embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pgcrypto (required for UUID generation)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

**Note:** If you get an error like `extension "vector" does not exist`, pgvector is not installed on your PostgreSQL server. See the installation section above.

### 3. Verify Extensions

Confirm the extensions are enabled:

```sql
SELECT * FROM pg_extension WHERE extname IN ('vector', 'pgcrypto');
```

You should see both extensions listed.

## Configuring Aperture

### 1. Use the External Database Docker Compose

Use `docker-compose.external-db.yml` instead of the standard compose file:

```bash
# Download the external database compose file
curl -O https://raw.githubusercontent.com/dgruhin-hrizn/aperture/main/docker-compose.external-db.yml

# Or if you have the repo, it's already there
```

### 2. Configure the DATABASE_URL

Edit the compose file and set your `DATABASE_URL`:

```yaml
environment:
  DATABASE_URL: 'postgres://aperture:your_secure_password@192.168.1.100:5432/aperture'
```

#### Connection String Format

```
postgres://USER:PASSWORD@HOST:PORT/DATABASE?options
```

| Component | Description | Example |
|-----------|-------------|---------|
| USER | Database username | `aperture` |
| PASSWORD | Database password | `secretpass123` |
| HOST | Database server hostname or IP | `192.168.1.100` or `db.example.com` |
| PORT | PostgreSQL port (default 5432) | `5432` |
| DATABASE | Database name | `aperture` |
| options | Optional connection parameters | `?sslmode=require` |

#### Connection String Examples

```bash
# Local network server
postgres://aperture:mypass@192.168.1.50:5432/aperture

# Docker network (if PostgreSQL is in another container)
postgres://aperture:mypass@postgres-container:5432/aperture

# With SSL required (for cloud databases)
postgres://aperture:mypass@db.example.com:5432/aperture?sslmode=require

# AWS RDS example
postgres://aperture:mypass@mydb.abc123.us-east-1.rds.amazonaws.com:5432/aperture?sslmode=require

# Supabase example
postgres://postgres.abc123:mypass@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### 3. Start Aperture

```bash
docker-compose -f docker-compose.external-db.yml up -d
```

Aperture will automatically:
1. Connect to your external database
2. Create the required extensions (if not already present)
3. Run all database migrations
4. Start the web server

### 4. Verify Connection

Check the container logs to verify the database connection:

```bash
docker logs aperture
```

You should see:
```
🔮 Running database migrations...
✓ Database is up to date
🚀 Aperture API server running at http://0.0.0.0:3456
```

## Migrations

Aperture manages its own database schema through migrations. When you start Aperture:

1. It connects to your database
2. Creates a `aperture_migrations` table to track applied migrations
3. Applies any pending migrations in order
4. Starts the server

**Migrations run automatically** on every startup when `RUN_MIGRATIONS_ON_START: 'true'` (the default).

### Checking Migration Status

You can check which migrations have been applied:

```sql
SELECT name, applied_at FROM aperture_migrations ORDER BY name;
```

### Manual Migration (Advanced)

If you prefer to run migrations manually:

1. Set `RUN_MIGRATIONS_ON_START: 'false'` in your compose file
2. Run migrations using the migration script:

```bash
DATABASE_URL="postgres://..." node scripts/migrate.mjs
```

## Backups

### Using Aperture's Built-in Backup

Aperture's backup feature works with external databases. It uses `pg_dump` to create backups, which requires network connectivity to your database.

The backups are stored in the `/backups` volume mount.

### Using Your Own Backup Solution

For external databases, you may prefer to use your own backup strategy:

- **Managed services**: Use your provider's built-in backup features
- **Self-hosted**: Set up pg_dump cron jobs or use tools like pgBackRest
- **Point-in-time recovery**: Configure WAL archiving for your PostgreSQL server

## Network Considerations

### Firewall Rules

Ensure your PostgreSQL server allows connections from the Docker host:

```bash
# Example: Allow connections from Docker network
sudo ufw allow from 172.17.0.0/16 to any port 5432
```

### PostgreSQL Authentication (pg_hba.conf)

Your `pg_hba.conf` must allow connections from the Docker container:

```
# Allow connections from Docker network
host    aperture    aperture    172.17.0.0/16    scram-sha-256

# Or allow from specific IP
host    aperture    aperture    192.168.1.0/24   scram-sha-256
```

Reload PostgreSQL after changes:
```bash
sudo systemctl reload postgresql
```

### Docker Networks

If your PostgreSQL is in another Docker container, ensure both containers are on the same Docker network:

```bash
# Create a shared network
docker network create aperture-network

# Connect your PostgreSQL container
docker network connect aperture-network postgres-container

# Update DATABASE_URL to use container name
DATABASE_URL: 'postgres://user:pass@postgres-container:5432/aperture'
```

## SSL/TLS Connections

For production environments, especially cloud databases, use SSL:

```yaml
DATABASE_URL: 'postgres://user:pass@host:5432/aperture?sslmode=require'
```

SSL modes:
- `disable` - No SSL
- `require` - Require SSL but don't verify certificate
- `verify-ca` - Require SSL and verify CA
- `verify-full` - Require SSL and verify CA + hostname

## Troubleshooting

### "extension vector does not exist"

pgvector is not installed on your PostgreSQL server. See the [Installing pgvector](#installing-pgvector) section.

### "connection refused"

1. Check that PostgreSQL is running and listening on the correct port
2. Verify firewall rules allow the connection
3. Check `pg_hba.conf` allows connections from Docker
4. Test connectivity: `docker exec aperture pg_isready -h YOUR_HOST -p 5432`

### "password authentication failed"

1. Verify the username and password in DATABASE_URL
2. Check that the user exists: `SELECT usename FROM pg_user;`
3. Ensure the password doesn't contain special characters that need URL encoding

### "database does not exist"

Create the database:
```sql
CREATE DATABASE aperture OWNER aperture;
```

### "permission denied"

Grant the user full privileges:
```sql
GRANT ALL PRIVILEGES ON DATABASE aperture TO aperture;
\c aperture
GRANT ALL ON SCHEMA public TO aperture;
```

### Migration Failures

If migrations fail:

1. Check the error message in container logs: `docker logs aperture`
2. Verify the database user has CREATE privileges
3. Check for conflicting schema from a previous installation
4. Try connecting manually and running the failing migration SQL

### Performance Issues

For large libraries, consider tuning PostgreSQL:

```sql
-- Increase work_mem for vector operations
ALTER SYSTEM SET work_mem = '256MB';

-- Increase maintenance_work_mem for index creation
ALTER SYSTEM SET maintenance_work_mem = '512MB';

-- Reload configuration
SELECT pg_reload_conf();
```

## Migrating from Built-in Database

If you want to migrate from the built-in database container to an external database:

1. Create a backup using Aperture's backup feature
2. Set up your external database following this guide
3. Restore the backup to your external database using `pg_restore`
4. Update your compose file to use `docker-compose.external-db.yml`
5. Start Aperture with the new configuration

```bash
# Restore backup to external database
pg_restore -h YOUR_HOST -U aperture -d aperture /path/to/backup.dump
```
