# Configuration Guide

This guide covers all configuration options for Aperture, including environment variables, STRM setup, and admin UI settings.

## Table of Contents

- [First-Time Setup](#first-time-setup)
- [Environment Variables](#environment-variables)
  - [Required Settings](#required-settings)
  - [Optional Settings](#optional-settings)
  - [UI-Configurable Settings](#ui-configurable-settings)
  - [STRM Configuration](#strm-configuration)
  - [Job Schedules](#job-schedules-defaults)
  - [Trakt Integration](#trakt-integration)
- [Admin UI Configuration](#admin-ui-configuration)
  - [Setup Tab](#setup-tab)
  - [AI Recommendations Tab](#ai-recommendations-tab)
  - [Top Picks Tab](#top-picks-tab)
  - [System Tab](#system-tab)
- [STRM Setup Guide](#strm-setup-guide)
  - [Same Machine Setup](#same-machine-setup)
  - [Different Machines (NAS/Network Share)](#different-machines-nasnetwork-share)
  - [Streaming URLs vs Direct Paths](#streaming-urls-vs-direct-paths)
  - [Using Symlinks Instead of STRM](#using-symlinks-instead-of-strm)
  - [Path Mapping for Symlinks](#path-mapping-for-symlinks)
  - [Symlink Folder Structure](#symlink-folder-structure)
- [Trakt Integration Setup](#trakt-integration-setup)
- [Reverse Proxy Setup](#reverse-proxy-setup)
  - [Nginx Proxy Manager](#nginx-proxy-manager)
  - [Traefik](#traefik)
  - [Caddy](#caddy)

---

## First-Time Setup

When you start Aperture for the first time (via Docker or otherwise), you'll be guided through a **Setup Wizard** that configures the essential settings:

1. **Welcome** — Introduction to the setup process
2. **Media Server** — Connect to your Emby or Jellyfin server (required)
3. **OpenAI** — Configure your OpenAI API key (optional, can be added later)
4. **Complete** — Finish setup and start using Aperture

The setup wizard saves all configuration to the database, so you don't need to configure environment variables for most settings.

---

## Environment Variables

Aperture uses a **database-first** configuration approach. Most settings can be configured through the UI and are stored in the database. Environment variables serve as fallbacks or for settings that must be configured before the application starts.

### Required Settings

| Variable       | Description                  | Notes                                       |
| -------------- | ---------------------------- | ------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string | e.g., `postgres://app:app@db:5432/aperture` |

### Optional Settings

| Variable         | Description                          | Default                                         |
| ---------------- | ------------------------------------ | ----------------------------------------------- |
| `PORT`           | API server port                      | `3456`                                          |
| `NODE_ENV`       | Environment mode                     | `development`                                   |
| `SESSION_SECRET` | Session cookie secret (min 32 chars) | Auto-generated (set in production for clusters) |
| `APP_BASE_URL`   | Public URL of the application        | `http://localhost:3456`                         |
| `TZ`             | Timezone                             | System default                                  |

### UI-Configurable Settings

The following settings can be configured via environment variables **OR** the Admin UI. **UI settings take precedence** when configured.

#### Media Server (Admin → Settings → Media Server)

| Variable                | Description          | Default |
| ----------------------- | -------------------- | ------- |
| `MEDIA_SERVER_TYPE`     | `emby` or `jellyfin` | `emby`  |
| `MEDIA_SERVER_BASE_URL` | Media server URL     | —       |
| `MEDIA_SERVER_API_KEY`  | Admin API key        | —       |

#### OpenAI (Admin → Settings → AI)

| Variable             | Description     | Default                  |
| -------------------- | --------------- | ------------------------ |
| `OPENAI_API_KEY`     | OpenAI API key  | —                        |
| `OPENAI_EMBED_MODEL` | Embedding model | `text-embedding-3-small` |

> **Note**: For Docker deployments, you typically don't need to set these environment variables. Just complete the setup wizard and configure everything through the UI.

### STRM Configuration

| Variable                    | Description                              | Default           |
| --------------------------- | ---------------------------------------- | ----------------- |
| `MEDIA_SERVER_STRM_ROOT`    | Where Aperture writes STRM files         | `/strm`           |
| `AI_LIBRARY_PATH_PREFIX`    | Path prefix as seen by media server      | `/strm/aperture/` |
| `AI_LIBRARY_NAME_PREFIX`    | Library name prefix                      | `AI Picks - `     |
| `STRM_USE_STREAMING_URL`    | Use streaming URLs in STRM files         | `true`            |
| `MEDIA_SERVER_LIBRARY_ROOT` | Root path for direct file paths          | `/mnt/media`      |
| `MEDIA_SERVER_PATH_PREFIX`  | How your media server sees file paths    | `/mnt/`           |
| `LOCAL_MEDIA_PATH_PREFIX`   | How Aperture sees the same files locally | `/mnt/`           |

### Job Schedules (Defaults)

| Variable     | Description               | Default            |
| ------------ | ------------------------- | ------------------ |
| `SYNC_CRON`  | Media sync schedule       | `0 3 * * *` (3 AM) |
| `RECS_CRON`  | Recommendation generation | `0 4 * * *` (4 AM) |
| `PERMS_CRON` | STRM/permissions sync     | `0 5 * * *` (5 AM) |

### Trakt Integration

| Variable              | Description                     | Default |
| --------------------- | ------------------------------- | ------- |
| `TRAKT_CLIENT_ID`     | Trakt application client ID     | —       |
| `TRAKT_CLIENT_SECRET` | Trakt application client secret | —       |
| `TRAKT_REDIRECT_URI`  | OAuth callback URL              | —       |

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

### Path Mapping for Symlinks

When using symlinks, Aperture needs to:

1. **Read** your original media folders to find artwork and subtitles
2. **Create symlinks** that your media server can follow

If Aperture and your media server see the same files at different paths, configure the mapping so Aperture can find the files locally while creating symlinks with paths your media server understands.

#### How to Find Your Paths

1. In Emby/Jellyfin, go to any movie → Media Info → look at the **Path**
2. On the machine running Aperture, find where that same file exists
3. The different prefix between these paths is what you configure

#### Common Scenarios

**Same machine (no mapping needed):**

```bash
# Emby sees:     /mnt/Movies/Inception/Inception.mkv
# Aperture sees: /mnt/Movies/Inception/Inception.mkv
MEDIA_SERVER_PATH_PREFIX=/mnt/
LOCAL_MEDIA_PATH_PREFIX=/mnt/
```

**Aperture on Mac, Emby on Linux/Unraid:**

```bash
# Emby sees:     /mnt/Movies/Inception/Inception.mkv
# Mac sees:      /Volumes/Media/Movies/Inception/Inception.mkv
MEDIA_SERVER_PATH_PREFIX=/mnt/
LOCAL_MEDIA_PATH_PREFIX=/Volumes/Media/
```

**Both in Docker with different volume mounts:**

```bash
# Emby container:     /media/Movies/Inception/...
# Aperture container: /data/Movies/Inception/...
MEDIA_SERVER_PATH_PREFIX=/media/
LOCAL_MEDIA_PATH_PREFIX=/data/
```

> **Note**: The symlinks Aperture creates will use the media server paths (so Emby can follow them), but Aperture needs the local paths to read the directory and find what files exist.

### Symlink Folder Structure

When using symlinks for movies, each movie gets its own folder:

```
AI Picks - Movies/
├── Inception (2010)/
│   ├── Inception (2010).mkv           → symlink to original video
│   ├── Inception (2010).nfo           ← custom (with AI explanation)
│   ├── Inception (2010).en.srt        → symlink (renamed to match video)
│   ├── Inception (2010).es.srt        → symlink (renamed to match video)
│   ├── poster.jpg                     ← custom (with rank badge)
│   ├── fanart.jpg                     ← downloaded
│   ├── banner.jpg                     → symlink from original
│   ├── clearlogo.png                  → symlink from original
│   └── landscape.jpg                  → symlink from original
```

For series, Aperture creates the folder with:

```
AI Picks - TV Series/
├── Breaking Bad (2008)/
│   ├── tvshow.nfo                     ← custom (with AI explanation)
│   ├── poster.jpg                     ← custom (with rank badge)
│   ├── fanart.jpg                     → symlink from original
│   ├── banner.jpg                     → symlink from original
│   ├── clearlogo.png                  → symlink from original
│   ├── landscape.jpg                  → symlink from original
│   ├── season01-poster.jpg            → symlink from original
│   ├── Season 00/                     ← sorting workaround folder
│   ├── Season 01/                     → symlink to original season
│   └── Season 02/                     → symlink to original season
```

**What gets symlinked automatically:**

- All artwork files (banner.jpg, clearlogo.png, landscape.jpg, fanart\*.jpg, etc.)
- Subtitle files (.srt, .sub, .ass, etc.) — renamed to match video file
- Season folders (for series)

**What Aperture creates custom:**

- NFO files (includes AI explanation when enabled)
- poster.jpg (with rank badge overlay)
- Season 00 folder (Emby home row sorting workaround)

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

---

## Reverse Proxy Setup

Running Aperture behind a reverse proxy like **Nginx Proxy Manager**, **Traefik**, or **Caddy** is recommended for:

- HTTPS/SSL termination
- Custom domain access
- Trakt OAuth callbacks (requires a public URL)

### Nginx Proxy Manager

1. **Add a new Proxy Host**:
   - **Domain Names**: `aperture.yourdomain.com`
   - **Scheme**: `http`
   - **Forward Hostname/IP**: Your Aperture container name or IP (e.g., `aperture` or `192.168.1.100`)
   - **Forward Port**: `3456`

2. **SSL Tab**:
   - Request a new SSL certificate or use an existing one
   - Enable **Force SSL**

3. **Advanced Tab** (optional but recommended):

   ```nginx
   proxy_set_header Host $host;
   proxy_set_header X-Real-IP $remote_addr;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Forwarded-Proto $scheme;

   # WebSocket support (if needed in future)
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   ```

4. **Update Aperture's `APP_BASE_URL`**:
   ```yaml
   environment:
     APP_BASE_URL: https://aperture.yourdomain.com
   ```

### Traefik

```yaml
services:
  aperture:
    image: ghcr.io/dgruhin-hrizn/aperture:latest
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.aperture.rule=Host(`aperture.yourdomain.com`)'
      - 'traefik.http.routers.aperture.entrypoints=websecure'
      - 'traefik.http.routers.aperture.tls.certresolver=letsencrypt'
      - 'traefik.http.services.aperture.loadbalancer.server.port=3456'
    environment:
      APP_BASE_URL: https://aperture.yourdomain.com
```

### Caddy

```
aperture.yourdomain.com {
    reverse_proxy aperture:3456
}
```

Then set `APP_BASE_URL=https://aperture.yourdomain.com` in Aperture.

### Important Notes

1. **APP_BASE_URL must match your public URL** — This is used for OAuth callbacks (Trakt) and cookie settings.

2. **Session cookies** — In production (`NODE_ENV=production`), cookies are set with `secure: true`, requiring HTTPS.

3. **Trakt OAuth** — The Redirect URI configured in your Trakt application must exactly match your `APP_BASE_URL` + `/api/trakt/callback`. Example: `https://aperture.yourdomain.com/api/trakt/callback`

4. **Docker networking** — If using Docker, ensure your reverse proxy can reach the Aperture container (same Docker network or use host IP).
