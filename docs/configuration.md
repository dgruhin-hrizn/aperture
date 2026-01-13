# Configuration Guide

This guide covers all configuration options for Aperture, including Docker setup, the Setup Wizard, and admin UI settings.

## Table of Contents

- [Quick Start (Docker)](#quick-start-docker)
- [Volume Mounts Explained](#volume-mounts-explained)
- [Setup Wizard](#setup-wizard)
- [Environment Variables](#environment-variables)
- [Admin UI Configuration](#admin-ui-configuration)
- [Symlinks vs STRM Files](#symlinks-vs-strm-files)
- [MDBList Integration](#mdblist-integration)
- [Trakt Integration](#trakt-integration)
- [Reverse Proxy Setup](#reverse-proxy-setup)

---

## Quick Start (Docker)

### Platform-Specific Docker Compose Files

We provide pre-configured docker-compose files for common platforms:

| Platform | File | Notes |
|----------|------|-------|
| **Unraid** | [`docker-compose.unraid.yml`](https://github.com/dgruhin-hrizn/aperture/blob/main/docker-compose.unraid.yml) | `/mnt/user/` paths |
| **QNAP** | [`docker-compose.qnap.yml`](https://github.com/dgruhin-hrizn/aperture/blob/main/docker-compose.qnap.yml) | qnet driver with static IPs |
| **Synology** | [`docker-compose.synology.yml`](https://github.com/dgruhin-hrizn/aperture/blob/main/docker-compose.synology.yml) | `/volume1/` paths, optional macvlan |
| **Linux/Other** | [`docker-compose.prod.yml`](https://github.com/dgruhin-hrizn/aperture/blob/main/docker-compose.prod.yml) | Generic production setup |

Download the file for your platform and edit the required values (IP address, session secret, paths).

### Volume Mounts

Aperture requires **3 volume mounts**:

1. **Aperture Libraries** (`/aperture-libraries`) — Where recommendations are written
2. **Backups** (`/backups`) — Database backup storage
3. **Media Library** (`/media`) — Read-only access to your media files

The recommended setup is to create the ApertureLibraries folder **inside** your existing media share.

### Why Inside Your Media Share?

When you create `ApertureLibraries` inside your existing media share (e.g., `/mnt/user/Media/ApertureLibraries`), your media server (Emby/Jellyfin) can already see it through its existing mount. **No extra configuration needed in your media server!**

### Folder Structure

```
Your Host Filesystem:
─────────────────────────────────────────────────────────
/mnt/user/Media/                      ← Your media share
├── Movies/                           ← Your movies
├── TV/                               ← Your TV shows
└── ApertureLibraries/                ← Create this folder HERE
    └── (Aperture writes recommendations here)


Your Emby/Jellyfin Container (existing mount - don't change anything):
─────────────────────────────────────────────────────────
/mnt/user/Media  mounted at  /mnt     ← You already have this!


What Emby Sees (automatically):
─────────────────────────────────────────────────────────
/mnt/
├── Movies/                           ← Your movies
├── TV/                               ← Your TV shows
└── ApertureLibraries/                ← Emby can see this automatically!
    └── (Your AI recommendation libraries appear here)
```

### Docker Compose Example (Unraid)

```yaml
services:
  app:
    image: ghcr.io/dgruhin-hrizn/aperture:latest
    container_name: aperture
    user: root
    environment:
      APP_BASE_URL: http://YOUR_SERVER_IP:3456
      DATABASE_URL: postgres://app:app@db:5432/aperture
      TZ: America/New_York
    ports:
      - '3456:3456'
    volumes:
      # ─────────────────────────────────────────────────────────────
      # VOLUME 1: Aperture Libraries Output
      # ─────────────────────────────────────────────────────────────
      # IMPORTANT: Create this folder INSIDE your media share!
      #
      # Why inside? Because your media server already has your media
      # share mounted, so it will automatically see this folder too.
      # No need to add another mount to Emby/Jellyfin!
      #
      # In this example:
      #   - Host folder:        /mnt/user/Media/ApertureLibraries
      #   - Emby sees it at:    /mnt/ApertureLibraries (automatically!)
      #
      - /mnt/user/Media/ApertureLibraries:/aperture-libraries

      # ─────────────────────────────────────────────────────────────
      # VOLUME 2: Your Media Library (read-only access)
      # ─────────────────────────────────────────────────────────────
      # Aperture needs to read your media files to create symlinks.
      # Mount the SAME media folder that your media server uses.
      # Read-only (:ro) is fine - Aperture only reads, never writes here.
      #
      - /mnt/user/Media:/media:ro
```

---

## Volume Mounts Explained

| Mount | Container Path | Purpose |
|-------|----------------|---------|
| **Aperture Libraries** | `/aperture-libraries` | Where Aperture writes recommendation libraries (symlinks/STRM files) |
| **Media Library** | `/media` | Read-only access to your actual media files (for creating symlinks) |

### Important Notes

- **No changes needed to your Emby/Jellyfin container** if you put ApertureLibraries inside your media share
- The `/media` mount should be the **same files** your media server accesses
- Read-only (`:ro`) is fine for the media mount - Aperture never writes to your original media

---

## Setup Wizard

When you first start Aperture, the Setup Wizard guides you through configuration:

1. **Restore** — Optionally restore from a previous backup
2. **Media Server** — Connect to your Emby or Jellyfin server
3. **Source Libraries** — Select which libraries to include in recommendations
4. **AI Recommendations** — Configure library naming and cover images
5. **Validate** — Verify paths and output format (symlinks vs STRM)
6. **Users** — Select which users get personalized recommendations
7. **Top Picks** — Configure trending content libraries (optional)
8. **OpenAI** — Enter your OpenAI API key
9. **Initial Sync** — Run first-time sync jobs (with re-run capability)
10. **Complete** — Review created libraries and default schedules

### Output Configuration Step

The wizard will ask for two paths:

| Question | What to Enter | Example |
|----------|---------------|---------|
| **Media Server Path Prefix** | How your media server sees your files | `/mnt/` |
| **Aperture Libraries Path** | Where media server sees Aperture's output | `/mnt/ApertureLibraries/` |

**How to find your Media Server Path Prefix:**
1. Open Emby/Jellyfin and go to any movie
2. Click the **⋮** menu → **Media Info**
3. Look at the **Path** field - the prefix is everything before your media folders

---

## Environment Variables

Aperture uses a **database-first** configuration approach. Most settings are configured through the UI and stored in the database. Only a few environment variables are needed:

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://app:app@db:5432/aperture` |

### Recommended for Production

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_BASE_URL` | Public URL of the application | `http://localhost:3456` |
| `SESSION_SECRET` | Session cookie secret (min 32 chars) | Auto-generated |
| `TZ` | Timezone for scheduled jobs | System default |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3456` |
| `NODE_ENV` | Environment mode | `development` |
| `RUN_MIGRATIONS_ON_START` | Auto-run database migrations | `true` |

> **Note**: Path configuration and job schedules are managed through the Setup Wizard and Admin UI, not environment variables.

---

## Admin UI Configuration

The Admin Settings page is organized into tabs:

### Setup Tab

- **Media Server**: Connection details and test connection
- **Source Libraries**: Enable/disable libraries to include in sync

### AI Recommendations Tab

- **Output Format**: Symlinks vs STRM (separate for Movies and Series)
- **Library Title Templates**: Default naming with merge tags
- **AI Explanations**: Global toggle and user override settings
- **Advanced Settings**: AI models and algorithm weights

### Top Picks Tab

- **Popularity Source**: Choose Local, MDBList, or Hybrid for movies and series
- **MDBList Selection**: Browse/search lists, choose sort order, preview library matches
- **Local Settings**: Time window, minimum viewers, scoring weights
- **Output Modes**: Library, Collection, and/or Playlist

### Integrations Tab

- **OpenAI**: API key configuration and model selection
- **MDBList**: API key and connection status
- **TMDb / OMDb**: Additional metadata sources
- **Trakt**: OAuth client credentials for rating sync

### System Tab

- **Cost Estimator**: Estimate OpenAI API costs
- **Database Management**: View stats and purge data
- **Backup & Restore**: Create manual backups, restore from backup, configure retention

---

## Backup & Restore

Aperture automatically backs up the database daily. Backups are stored in the `/backups` volume mount.

### Automatic Backups

- **Default Schedule**: Daily at 1 AM (configurable in Admin → Jobs)
- **Retention**: Keeps the last 7 backups by default (configurable)
- **Format**: Compressed PostgreSQL dump (`.sql.gz`)

### Restore from Backup

**During Initial Setup:**
1. The first step of the Setup Wizard offers to restore from a backup
2. Upload a backup file or select from existing backups
3. Aperture will restore and continue setup

**From Admin Panel:**
1. Go to **Admin → Settings → System**
2. Scroll to **Backup & Restore**
3. Select a backup and click **Restore**

### Manual Backup

1. Go to **Admin → Settings → System**
2. Click **Create Backup** in the Backup section
3. Download the backup file for offsite storage

### Volume Mount

Ensure you have the backups volume mounted:

```yaml
volumes:
  - /path/to/backups:/backups
```

---

## Symlinks vs STRM Files

Aperture can create recommendation libraries using either **symlinks** or **STRM files**:

### Symlinks (Recommended)

- Creates direct filesystem links to your original media files
- Preserves all metadata and quality
- Best playback experience - no transcoding overhead
- **Requires**: Shared filesystem access between Aperture and media server

### STRM Files

- Small text files containing streaming URLs
- Works when symlinks aren't possible (different filesystems, network shares)
- May require transcoding depending on setup

### Folder Structure with Symlinks

```
ApertureLibraries/
├── aperture/                         ← AI Movie recommendations
│   └── JohnDoe_abc123/               ← Per-user folders
│       ├── Inception (2010)/
│       │   ├── Inception (2010).mkv  → symlink to original
│       │   ├── Inception (2010).nfo  ← custom (with AI explanation)
│       │   ├── poster.jpg            ← custom (with rank badge)
│       │   └── fanart.jpg            → symlink
│       └── ...
├── aperture-tv/                      ← AI Series recommendations
│   └── JohnDoe_abc123/
│       └── Breaking Bad (2008)/
│           ├── tvshow.nfo            ← custom
│           ├── poster.jpg            ← custom (with rank badge)
│           ├── Season 01/            → symlink to original season
│           └── ...
├── aperture-watching/                ← "Shows You Watch" libraries
├── top-picks-movies/                 ← Trending movies
└── top-picks-series/                 ← Trending series
```

---

## MDBList Integration

MDBList provides curated movie and TV lists with rich metadata from multiple sources (IMDb, TMDb, Rotten Tomatoes, Metacritic, etc.).

### Setup

1. Get a free API key from [mdblist.com/preferences](https://mdblist.com/preferences/)
2. Navigate to **Admin → Settings → Integrations → MDBList**
3. Enter your API key and click **Test Connection**
4. Save the configuration

### Features

Once configured, MDBList enables:

- **Top Picks from MDBList** — Use public or private lists as your Top Picks source
- **Sort Options** — Rank by IMDb popularity, rating, Rotten Tomatoes score, etc.
- **Library Match Preview** — See which list items exist in your library before enabling

### Rate Limits

| Tier       | Daily Requests | Rate Limit    |
| ---------- | -------------- | ------------- |
| Free       | 1,000          | 10 req/sec    |
| Supporter  | 100,000        | 40 req/sec    |

Aperture automatically respects these limits. If you hit the daily limit, a warning alert will appear.

---

## Trakt Integration

To enable Trakt.tv sync:

### 1. Create a Trakt Application

1. Go to [trakt.tv/oauth/applications](https://trakt.tv/oauth/applications)
2. Click **New Application**
3. Fill in the details:
   - **Name**: Aperture
   - **Redirect URI**: `https://your-aperture-domain.com/api/trakt/callback`
4. Note your **Client ID** and **Client Secret**

### 2. Configure in Aperture

Navigate to **Admin → Settings → Setup → Trakt Integration**:

1. Enter your **Client ID** and **Client Secret**
2. Click **Save**

### 3. User Connection

Users can connect their Trakt accounts in **User Settings → Connect Trakt Account**.

---

## Reverse Proxy Setup

Running Aperture behind a reverse proxy is recommended for:

- HTTPS/SSL termination
- Custom domain access
- Trakt OAuth callbacks (requires a public URL)

### Nginx Proxy Manager

1. **Add a new Proxy Host**:
   - **Domain**: `aperture.yourdomain.com`
   - **Scheme**: `http`
   - **Forward Hostname/IP**: `aperture` or your server IP
   - **Forward Port**: `3456`

2. **SSL Tab**: Request SSL certificate and enable Force SSL

3. **Update Aperture**:
   ```yaml
   environment:
     APP_BASE_URL: https://aperture.yourdomain.com
   ```

### Traefik

```yaml
services:
  aperture:
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

### Important Notes

1. **APP_BASE_URL must match your public URL** — Used for OAuth callbacks and cookie settings
2. **Session cookies** — In production, cookies require HTTPS (`secure: true`)
3. **Trakt OAuth** — Redirect URI must exactly match `APP_BASE_URL/api/trakt/callback`
