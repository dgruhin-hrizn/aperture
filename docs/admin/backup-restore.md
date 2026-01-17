# Backup & Restore

Protect your data with automatic and manual backups.

![Admin Settings - System](../images/admin/admin-settings-system.png)

## Accessing Settings

Navigate to **Admin → Settings → System** (Backup & Restore section)

---

## What Gets Backed Up

| Data | Included |
|------|----------|
| **Database** | All tables, users, ratings, recommendations |
| **Settings** | All configuration |
| **Job schedules** | Custom schedules |
| **User preferences** | Algorithm weights, UI preferences |

### Not Included

| Data | Why |
|------|-----|
| **Media files** | Too large, managed separately |
| **STRM/Symlink files** | Regenerated from database |
| **Cache** | Temporary, regenerated |

---

## Automatic Backups

### Schedule

Default: Daily at 1:00 AM

Configure in Admin → Jobs → database-backup

### Retention

Default: Keep 7 backups

Older backups are automatically deleted.

### Storage Location

Backups stored in `/backups` volume mount:
```
/backups/
├── aperture-backup-2025-01-15.sql.gz
├── aperture-backup-2025-01-14.sql.gz
└── ...
```

---

## Manual Backup

### Creating a Backup

1. Navigate to Admin → Settings → System
2. Scroll to Backup & Restore
3. Click **Create Backup**
4. Wait for completion
5. Backup appears in list

### Download Backup

1. Find backup in list
2. Click **Download**
3. Save to secure location

Recommended: Download backups for offsite storage.

---

## Restore Process

### During Initial Setup

1. Start fresh Aperture instance
2. First wizard step offers restore
3. Upload backup file or select from list
4. Wizard restores data
5. Continue with remaining setup steps

### From Admin Panel

1. Navigate to Admin → Settings → System
2. Scroll to Backup & Restore
3. Click **Restore** on desired backup
4. Confirm action
5. Wait for completion
6. Aperture restarts with restored data

---

## Backup File Format

### Structure

Backups are compressed PostgreSQL dumps:
- Format: `.sql.gz`
- Contains: Full database schema and data
- Size: Depends on library size

### Typical Sizes

| Library Size | Approximate Backup Size |
|--------------|------------------------|
| Small (<500) | 5-20 MB |
| Medium (500-2000) | 20-100 MB |
| Large (2000+) | 100-500 MB |

---

## Restore Scenarios

### New Server Migration

1. Download backup from old server
2. Install Aperture on new server
3. Upload backup during setup
4. Reconfigure media server connection
5. Re-run library sync jobs

### Disaster Recovery

1. Reinstall Aperture
2. Restore from most recent backup
3. Verify data integrity
4. Resume normal operation

### Rollback After Issues

1. Stop Aperture
2. Restore from pre-issue backup
3. Identify and fix issue
4. Resume operation

---

## Best Practices

### Regular Backups

- Keep automatic daily backups enabled
- Download weekly for offsite storage
- Store in multiple locations

### Before Major Changes

Create manual backup before:
- Changing embedding models
- Purging database
- Major version updates
- Configuration changes

### Testing Restores

Periodically test restore process:
1. Create test environment
2. Restore backup
3. Verify data integrity
4. Confirm functionality

---

## Retention Configuration

### Setting Retention

In Admin → Jobs → database-backup configuration:

| Setting | Description |
|---------|-------------|
| **Keep N backups** | Number of backups to retain |
| **Delete older** | Remove backups exceeding count |

### Recommendations

| Use Case | Retention |
|----------|-----------|
| Limited storage | 3-5 backups |
| Normal | 7 backups (1 week) |
| Cautious | 14-30 backups |

---

## Troubleshooting

### Backup Fails

1. Check disk space in backup volume
2. Verify database is accessible
3. Review job logs for errors
4. Check file permissions

### Restore Fails

1. Verify backup file is valid
2. Check file isn't corrupted
3. Ensure sufficient disk space
4. Review error messages

### Backup Too Large

- More backups = more space needed
- Consider reducing retention
- Clean old data before backing up

---

## Security

### Backup Contents

Backups contain sensitive data:
- User information
- API keys (encrypted)
- Watch history
- Ratings

### Protect Backups

- Store in secure location
- Encrypt offsite backups
- Limit access to backup volume
- Use secure transfer methods

---

**Previous:** [Maintenance](maintenance.md) | **Next:** [Database Management](database-management.md)
