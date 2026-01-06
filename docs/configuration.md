# Configuration Guide

This guide covers all configuration options for Aperture, including environment variables, STRM setup, and admin UI settings.

## Environment Variables

All configuration can be done via environment variables or the Admin UI.

### Core Settings

| Variable         | Description                          | Default       |
| ---------------- | ------------------------------------ | ------------- |
| `PORT`           | API server port                      | `3456`        |
| `NODE_ENV`       | Environment mode                     | `development` |
| `SESSION_SECRET` | Session cookie secret (min 32 chars) | **Required**  |
| `APP_BASE_URL`   | Public URL of the application        | **Required**  |
| `DATABASE_URL`   | PostgreSQL connection string         | **Required**  |

### OpenAI Settings

| Variable             | Description     | Default                  |
| -------------------- | --------------- | ------------------------ |
| `OPENAI_API_KEY`     | OpenAI API key  | Required for AI features |
| `OPENAI_EMBED_MODEL` | Embedding model | `text-embedding-3-small` |

### Media Server Settings

These can also be configured via Admin > Settings > Media Server.

| Variable                | Description          | Default |
| ----------------------- | -------------------- | ------- |
| `MEDIA_SERVER_TYPE`     | `emby` or `jellyfin` | `emby`  |
| `MEDIA_SERVER_BASE_URL` | Media server URL     | —       |
| `MEDIA_SERVER_API_KEY`  | Admin API key        | —       |

### STRM Configuration

| Variable                    | Description                         | Default           |
| --------------------------- | ----------------------------------- | ----------------- |
| `MEDIA_SERVER_STRM_ROOT`    | Where Aperture writes STRM files    | `/strm`           |
| `AI_LIBRARY_PATH_PREFIX`    | Path prefix as seen by media server | `/strm/aperture/` |
| `AI_LIBRARY_NAME_PREFIX`    | Library name prefix                 | `AI Picks - `     |
| `STRM_USE_STREAMING_URL`    | Use streaming URLs in STRM files    | `true`            |
| `MEDIA_SERVER_LIBRARY_ROOT` | Root path for direct file paths     | `/mnt/media`      |

### Job Schedules (Defaults)

| Variable     | Description               | Default            |
| ------------ | ------------------------- | ------------------ |
| `SYNC_CRON`  | Media sync schedule       | `0 3 * * *` (3 AM) |
| `RECS_CRON`  | Recommendation generation | `0 4 * * *` (4 AM) |
| `PERMS_CRON` | STRM/permissions sync     | `0 5 * * *` (5 AM) |

### Trakt Integration

| Variable              | Description                      | Default |
| --------------------- | -------------------------------- | ------- |
| `TRAKT_CLIENT_ID`     | Trakt application client ID      | —       |
| `TRAKT_CLIENT_SECRET` | Trakt application client secret  | —       |
| `TRAKT_REDIRECT_URI`  | OAuth callback URL               | —       |

---

## Admin UI Configuration

The Admin Settings page is organized into four tabs:

### Setup Tab

- **Media Server**: Connection details and test connection
- **Source Libraries**: Enable/disable libraries to include in sync
- **Trakt Integration**: Configure Trakt.tv client credentials
- **Docker Setup Guide**: Documentation for STRM/symlink volume configuration

### AI Recommendations Tab

- **Output Format**: STRM vs symlinks (separate for Movies and Series)
- **Library Title Templates**: Default naming with merge tags
- **AI Explanations**: Global toggle and user override settings
- **Advanced Settings** (collapsed):
  - AI Models: Embedding and text generation model selection
  - Algorithm Weights: Tune similarity, novelty, rating, diversity

### Top Picks Tab

- **Configuration**: Time window, counts, minimum viewers
- **Scoring Algorithm**: Weight unique viewers, play count, completion
- **Output Modes**: Library, Collection, and/or Playlist (per content type)

### System Tab

- **Cost Estimator**: Estimate OpenAI API costs based on your setup
- **Database Management**: View stats and purge data

---

## STRM Setup Guide

STRM files are how Aperture creates virtual libraries in your media server. Each STRM file is a small text file that points to the actual media file or streaming URL.

**Key Concept**: The STRM directory must be accessible by both Aperture (to write files) and your media server (to read and play them).

### Same Machine Setup

If Aperture and your media server run on the same machine:

```yaml
# Aperture container
volumes:
  - /path/to/strm:/strm

# Media server container (Emby/Jellyfin)
volumes:
  - /path/to/strm:/strm
```

Environment variables:

```
MEDIA_SERVER_STRM_ROOT=/strm
AI_LIBRARY_PATH_PREFIX=/strm/aperture/
```

### Different Machines (NAS/Network Share)

If Aperture runs on a different machine than your media server:

1. Create a shared folder accessible by both machines (e.g., on your NAS)
2. Mount it on both the Aperture machine and media server machine

Example:

- **NAS share**: `/mnt/user/Media/VirtualLibraries`
- **Aperture mount**: `/mnt/nas/VirtualLibraries` → `/strm` in container
- **Media server mount**: `/media/VirtualLibraries` in its container

```
# Aperture writes to /strm (which is /mnt/nas/VirtualLibraries on host)
MEDIA_SERVER_STRM_ROOT=/strm

# Media server sees the files at /media/VirtualLibraries
AI_LIBRARY_PATH_PREFIX=/media/VirtualLibraries/aperture/
```

### Streaming URLs vs Direct Paths

By default, Aperture uses streaming URLs in STRM files:

```
STRM_USE_STREAMING_URL=true
```

This means STRM files contain URLs like:

```
http://emby-server:8096/Videos/12345/stream?api_key=...
```

If you prefer direct file paths (requires the media server to have direct access to your media files):

```
STRM_USE_STREAMING_URL=false
MEDIA_SERVER_LIBRARY_ROOT=/path/to/your/media
```

### Using Symlinks Instead of STRM

For setups where both Aperture and your media server share the same filesystem (common with NAS), you can use symlinks instead of STRM files. Symlinks preserve all metadata and allow the media server to treat files exactly as originals.

**Requirements:**

- Aperture must have write access to the STRM directory
- Both containers must see the same paths for media files
- The filesystem must support symlinks (most Linux filesystems do)

Configure via **Admin → Settings → Output & AI → User Recommendations Output Format**.

**Top Picks** also support symlinks, configured separately in **Admin → Settings → Top Picks → Output Configuration**.

**Library Sorting**: Top Picks libraries and collections are automatically assigned sort titles that place them at the top of your library/collection lists (using `!!!!!!` prefix).

### Symlink Folder Structure

When using symlinks for movies, each movie gets its own folder:

```
Top Picks - Movies/
├── Inception (2010) [12345]/
│   ├── Inception (2010) [12345].mkv  → symlink to original
│   ├── Inception (2010) [12345].nfo
│   ├── poster.jpg
│   └── fanart.jpg
```

---

## Trakt Integration Setup

To enable Trakt.tv sync:

### 1. Create a Trakt Application

1. Go to [trakt.tv/oauth/applications](https://trakt.tv/oauth/applications)
2. Click **New Application**
3. Fill in the details:
   - **Name**: Aperture
   - **Description**: AI-powered media recommendations for Emby & Jellyfin
   - **Redirect URI**: `https://your-aperture-domain.com/api/trakt/callback`
4. Note your **Client ID** and **Client Secret**

### 2. Configure in Aperture

Navigate to **Admin → Settings → Setup → Trakt Integration**:

1. Enter your **Client ID**
2. Enter your **Client Secret**
3. The **Redirect URI** is shown — ensure it matches your Trakt app
4. Click **Save**

### 3. User Connection

Users can connect their Trakt accounts in **User Settings → Connect Trakt Account**.

### Sync Behavior

- **Push**: When users rate content in Aperture, ratings are immediately pushed to Trakt
- **Pull**: Trakt ratings sync to Aperture on a scheduled job (default: every 6 hours)
- **Bidirectional**: Both directions are supported for seamless integration

