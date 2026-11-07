# Aperture

[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](https://github.com/dgruhin-hrizn/aperture/releases)
[![Docker Image](https://img.shields.io/badge/docker-ghcr.io%2Fdgruhin--hrizn%2Faperture-blue?logo=docker)](https://github.com/dgruhin-hrizn/aperture/pkgs/container/aperture)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

**Aperture** — AI-powered media recommendations for Emby & Jellyfin.

Aperture creates personalized recommendation libraries for your media server users using OpenAI embeddings and pgvector similarity search. Recommendations appear as virtual libraries in your media server's home screen, with support for both **movies** and **TV series**.

---

## Quick Start

### 1. Download the docker-compose file for your platform

| Platform        | File                          | Download                                                                                               |
| --------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Unraid**      | `docker-compose.unraid.yml`   | [Download](https://raw.githubusercontent.com/dgruhin-hrizn/aperture/main/docker-compose.unraid.yml)    |
| **QNAP**        | `docker-compose.qnap.yml`     | [Download](https://raw.githubusercontent.com/dgruhin-hrizn/aperture/main/docker-compose.qnap.yml)      |
| **Synology**    | `docker-compose.synology.yml` | [Download](https://raw.githubusercontent.com/dgruhin-hrizn/aperture/main/docker-compose.synology.yml)  |
| **Windows**     | `docker-compose.windows.yml`  | [Download](https://raw.githubusercontent.com/dgruhin-hrizn/aperture/main/docker-compose.windows.yml) ¹ |
| **Linux/Other** | `docker-compose.prod.yml`     | [Download](https://raw.githubusercontent.com/dgruhin-hrizn/aperture/main/docker-compose.prod.yml)      |

> ¹ **Windows Users**: For Docker Desktop with Emby/Jellyfin running natively on Windows, see the [complete setup guide](docs/admin/windows-docker-desktop.md).

### 2. Configure the file

Edit the docker-compose file and set:

- `APP_BASE_URL` — Your server's IP address (e.g., `http://192.168.1.100:3456`)
- `SESSION_SECRET` — A random string (32+ characters)
- Volume paths — Adjust to match your media folder locations

### 3. Create required folders

```bash
# Example for Unraid - adjust paths for your platform
mkdir -p /mnt/user/Media/ApertureLibraries
mkdir -p /mnt/user/appdata/aperture/backups
```

### 4. Start Aperture

```bash
docker-compose -f docker-compose.[your-platform].yml up -d
```

### 5. Complete the Setup Wizard

Open `http://YOUR_SERVER_IP:3456` and follow the 11-step guided setup:

1. **Restore** (Optional) — Restore from an existing backup if migrating
2. **Media Server** — Connect to your Emby/Jellyfin server
3. **Source Libraries** — Select which libraries to analyze
4. **File Locations** — Configure path mappings for symlinks/STRM
5. **AI Recommendations** — Configure library naming and cover images
6. **Validate** — Verify output configuration and paths
7. **Users** — Select which users receive recommendations
8. **Top Picks** (Optional) — Configure global trending libraries
9. **AI / LLM** — Enter your OpenAI API key (or configure Ollama/other providers)
10. **Initial Jobs** — Run first-time sync with real-time progress
11. **Complete** — Review summary and next steps

### 6. Log in

Use your Emby/Jellyfin admin credentials to access Aperture.

---

## Updating

Stable `:latest` currently publishes **1.0.1**. This development branch prepares **1.0.2-dev.1**, which updates output compatibility guidance and documentation. Choose `ghcr.io/dgruhin-hrizn/aperture:dev` to test a published development build, or pin a published version. Changing branches or restarting an existing container does not pull a new image.

Back up PostgreSQL and uploaded artwork, keep the existing database/mounts, pull the selected app image and recreate the app container. Refresh the page and check `/health` for the version and database connection. Supplied production configurations apply pending migrations at startup.


```bash
docker-compose -f docker-compose.[your-platform].yml pull
docker-compose -f docker-compose.[your-platform].yml up -d
```

---

## Features

### AI Recommendations

- **Personalized Libraries** — Creates dedicated "AI Picks" libraries for each user
- **Configurable Embeddings** — Semantic vectors for all your media
- **pgvector Similarity** — Vector similarity retrieval
- **Configurable Algorithm** — Tune weights for similarity, novelty, rating, and diversity

### Media Support

- **Movies** — Full movie library sync with metadata, ratings, and watch history
- **TV Series** — Complete series and episode tracking with per-show recommendations
- **Watch History** — Automatic sync of viewing history including play counts and favorites

### Rating System

- **10-Heart Ratings** — Rate content from 1-10 hearts (Trakt.tv compatible)
- **Rate from Any Poster** — Click the heart icon on any poster
- **Trakt.tv Sync** — Bidirectional sync of ratings with Trakt

### Personalization

- **AI Taste Profiles** — Natural language descriptions of user preferences
- **Match Scores** — Ranking signals for recommendation fit, not a calibrated probability of enjoyment
- **Recommendation Insights** — Detailed breakdown of why each title was recommended

### Top Picks (Global)

- **Popularity-Based Content** — Trending content across all users
- **Multiple Output Modes** — Libraries, Collections, and/or Playlists
- **Rank Badges** — Gold, silver, bronze badges for top 3 on posters

### Output compatibility

Generated libraries can use STRM pointers or symlinks. Choose according to the media-server deployment and output storage; symlinks are not universally recommended. Native Windows Emby with Aperture in Linux Docker should use STRM. FAT32/exFAT output cannot store native symlinks. Original media can be on another filesystem if its target remains readable. Neither format guarantees Direct Play.

Read [output formats and compatibility](docs/admin/output-format.md) and [file locations](docs/admin/file-locations.md). The dev build adds shared guidance and compatibility checks at setup and output settings. A successful filesystem check still needs an actual movie/episode playback test.

### Symlinks & Artwork

- **Source Artwork Links** — Symlinks banner.jpg, clearlogo.png, landscape.jpg, and more
- **Optional Subtitle Sidecars** — Accessible supported sidecars can be linked and renamed; source mounts and symlink support are required
- **Custom NFOs** — Aperture generates NFOs with AI explanations while preserving original artwork

### Backup & Restore

- **Automatic Daily Backups** — Database backed up at 2 AM (configurable)
- **Restore During Setup** — Restore from backup when setting up a new instance
- **Admin Panel Restore** — Restore from the Admin → Settings → System tab
- **Configurable Retention** — Set how many backups to keep

### Admin Features

- **Setup Wizard** — Guided first-time configuration
- **Job Management** — Real-time progress, scheduling, and history
- **Encore Workspace** — Conversations, memory, watch plans, approved Emby playlist actions, MCP connections and opt-in recurring curation
- **Configurable Schedules** — All job schedules adjustable via Admin → Jobs
- **User Management** — Per-user recommendation settings
- **Cost Estimator** — Built-in OpenAI API cost estimation

---

## Default Job Schedules

All schedules are configurable in **Admin → Jobs**.

| Job                 | Default Schedule         |
| ------------------- | ------------------------ |
| Database Backup     | Daily at 2 AM            |
| User Sync           | Every 30 minutes         |
| Movie / TV Catalog  | Every 3 hours at :00 / :10 |
| Movie / TV Publishing | Every 3 hours at :20 / :30 |
| Movie / TV Embeddings | Every 6 hours at :10 / :20 |
| AI Recommendations  | Weekly on Sunday at 4 AM |
| Top Picks           | Daily at 5 AM            |
| Movie Watch History | Every 2 hours at :15     |
| TV Watch History    | Every hour at :05        |
| Watching / Favorites | Every hour at :45       |
| Metadata Enrichment | Every 6 hours            |

---

## Documentation

| Guide                                  | Description                                                  |
| -------------------------------------- | ------------------------------------------------------------ |
| [1.0.1 release notes](docs/release-notes/v1.0.1.md) | Emby stability, accurate job schedules, search, recommendations, and Encore styles |
| [1.0.0 release notes](docs/release-notes/v1.0.0.md) | Encore, mobile and Home Screen updates, and upgrade notes |
| [0.7.11 release notes](docs/release-notes/v0.7.11.md) | Emby publishing, recommendation freshness, and upgrade notes |
| [Admin Guide](docs/admin-guide.md)     | Setup walkthrough, job management, algorithm tuning          |
| [User Guide](docs/user-guide.md)       | Features for end users, ratings, channels                    |
| [Configuration](docs/configuration.md) | Volume setup, reverse proxy, Trakt integration               |
| [API Reference](docs/api-reference.md) | Complete API endpoint documentation                          |
| [Architecture](docs/architecture.md)   | Technical overview, recommendation pipeline, database schema |
| [Development](docs/development.md)     | Local dev setup, scripts, contribution guidelines            |

---

## Tech Stack

- **Backend**: Fastify, TypeScript, PostgreSQL, pgvector
- **Frontend**: React, Vite, MUI, React Router
- **AI**: Configurable embedding and language providers, with shared Encore tools
- **Infrastructure**: Docker, pnpm workspaces

---

## License

[GNU Affero General Public License v3.0](LICENSE)
