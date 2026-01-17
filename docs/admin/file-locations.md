# File Locations Configuration

Configure path mappings between Aperture and your media server for symlinks and STRM files to work correctly.

![Admin Settings - Media Server](../images/admin/admin-settings-setup-media.png)

## Accessing Settings

Navigate to **Admin → Settings → Setup → Media Server** (File Locations section)

---

## Why Path Mapping Matters

Aperture and your media server may see files at different paths:

```
Media Server sees:     /mnt/Movies/Inception.mkv
Aperture sees:         /media/Movies/Inception.mkv
```

When Aperture creates symlinks, it needs to write paths that the **media server** understands, not paths that Aperture uses internally.

---

## Configuration Options

### Aperture Libraries Path

Where your **media server** sees Aperture's output folder.

| Your Setup | Value |
|------------|-------|
| Standard Docker | `/mnt/ApertureLibraries/` |
| Synology | `/volume1/docker/aperture/libraries/` |
| Unraid | `/mnt/user/ApertureLibraries/` |

This is the path the media server uses to access the folder where Aperture creates STRM files and symlinks.

### Media Server Path Prefix

The base path prefix for media files as seen by your media server.

| Your Setup | Value |
|------------|-------|
| Standard Docker | `/mnt/` |
| Synology | `/volume1/` |
| Unraid | `/mnt/user/` |

Aperture uses this to translate its internal paths to media server paths.

---

## Auto-Detection

The easiest way to configure paths:

1. Click **Auto-Detect Paths**
2. Aperture fetches a sample file path from your media server
3. Compares it to how Aperture sees the same file
4. Calculates the correct prefix mapping

### When Auto-Detection Works

- You have movies synced in Aperture
- Both Aperture and media server can access the same files
- Paths differ only by a prefix

### When Auto-Detection Fails

- No content synced yet
- Files are on different filesystems
- Complex path mappings needed

In these cases, configure manually.

---

## Manual Configuration

### Step 1: Identify Media Server Path

Find how your media server sees a movie file:
1. Open media server web UI
2. Go to any movie's info/details
3. Look for "Path" in the metadata

Example: `/mnt/Movies/Inception (2010)/Inception.mkv`

### Step 2: Identify Aperture Path

Find how Aperture sees the same file:
1. Check your Docker volume mounts
2. The path inside the container

Example: `/media/Movies/Inception (2010)/Inception.mkv`

### Step 3: Calculate Mapping

Compare the two paths:
- Media server: `/mnt/Movies/...`
- Aperture: `/media/Movies/...`

The prefix mapping:
- Aperture `/media/` → Media server `/mnt/`

---

## Common Configurations

### Unraid

Most Unraid users:

```
Aperture Libraries Path: /mnt/ApertureLibraries/
Media Server Path Prefix: /mnt/
```

Docker volumes:
```yaml
volumes:
  - /mnt/user/appdata/aperture:/data
  - /mnt/user/ApertureLibraries:/aperture-libraries
  - /mnt/user/Media:/media
```

### Synology NAS

Typical Synology setup:

```
Aperture Libraries Path: /volume1/docker/aperture/libraries/
Media Server Path Prefix: /volume1/
```

### Standard Docker

If using standard paths:

```
Aperture Libraries Path: /data/ApertureLibraries/
Media Server Path Prefix: /data/
```

### QNAP

Typical QNAP setup:

```
Aperture Libraries Path: /share/Container/aperture/libraries/
Media Server Path Prefix: /share/
```

---

## STRM vs Symlinks

### STRM Files

STRM files contain the path to the actual media:

```
/mnt/Movies/Inception (2010)/Inception.mkv
```

**Requirements:**
- Path must be accessible to media server
- Path mapping must be correct

### Symlinks

Symbolic links point directly to the original file:

```
ln -s /mnt/Movies/Inception.mkv /mnt/ApertureLibraries/ai-movies/Inception.strm
```

**Requirements:**
- Same filesystem (or network mount)
- Correct path mapping
- Proper permissions

---

## Troubleshooting

### "Path does not exist" Errors

**Cause:** Media server can't find the symlink target.

**Fix:**
1. Run auto-detection
2. Check Docker volume mounts
3. Verify paths match between containers

### Symlinks Not Working

**Check:**
- Both containers share the same underlying filesystem
- Path prefix matches exactly (including trailing slashes)
- Permissions allow symlink creation

**Alternative:** Use STRM files instead of symlinks.

### Media Won't Play

**Check:**
1. Open the STRM file and check the path inside
2. Verify that path exists from media server's perspective
3. Test by manually navigating to that path

### Auto-Detection Returns Wrong Path

**Try:**
1. Sync more content first
2. Configure manually using the steps above
3. Check Docker volume mount consistency

---

## Validation

### Test Your Configuration

1. Run `sync-movie-libraries` job
2. Check the output directory for created files
3. Try playing a recommendation in your media server

### Check STRM Contents

```bash
cat /path/to/aperture-libraries/ai-movies/SomeMovie.strm
```

The path inside should be valid from your media server's perspective.

---

## Changing Configuration

If you need to change path mappings:

1. Update the settings
2. Re-run library build jobs
3. Files are regenerated with new paths
4. Trigger media server library scan

---

**Previous:** [Library Configuration](libraries.md) | **Next:** [Integrations Overview](integrations-overview.md)
