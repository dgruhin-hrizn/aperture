# Aperture

[![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)](https://github.com/dgruhin-hrizn/aperture/releases)
[![Docker Image](https://img.shields.io/badge/docker-ghcr.io%2Fdgruhin--hrizn%2Faperture-blue?logo=docker)](https://github.com/dgruhin-hrizn/aperture/pkgs/container/aperture)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Aperture** — AI-powered media recommendations for Emby & Jellyfin.

Aperture creates personalized recommendation libraries for your media server users using OpenAI embeddings and pgvector similarity search. Recommendations appear as virtual libraries in your media server's home screen, with support for both **movies** and **TV series**.

---

## Quick Start

### 1. Download the docker-compose file for your platform

| Platform        | File                          | Download                                                                                              |
| --------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Unraid**      | `docker-compose.unraid.yml`   | [Download](https://raw.githubusercontent.com/dgruhin-hrizn/aperture/main/docker-compose.unraid.yml)   |
| **QNAP**        | `docker-compose.qnap.yml`     | [Download](https://raw.githubusercontent.com/dgruhin-hrizn/aperture/main/docker-compose.qnap.yml)     |
| **Synology**    | `docker-compose.synology.yml` | [Download](https://raw.githubusercontent.com/dgruhin-hrizn/aperture/main/docker-compose.synology.yml) |
| **Linux/Other** | `docker-compose.prod.yml`     | [Download](https://raw.githubusercontent.com/dgruhin-hrizn/aperture/main/docker-compose.prod.yml)     |

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

Open `http://YOUR_SERVER_IP:3456` and follow the guided setup:

1. Connect to your Emby/Jellyfin server
2. Select source libraries
3. Configure AI recommendations
4. Select users
5. (Optional) Enable Top Picks
6. Enter OpenAI API key
7. Run initial sync

### 6. Log in

Use your Emby/Jellyfin admin credentials to access Aperture.

---

## Updating

```bash
docker-compose -f docker-compose.[your-platform].yml pull
docker-compose -f docker-compose.[your-platform].yml up -d
```

---

## Features

### AI Recommendations

- **Personalized Libraries** — Creates dedicated "AI Picks" libraries for each user
- **OpenAI Embeddings** — Semantic vectors for all your media
- **pgvector Similarity** — Lightning-fast vector similarity search
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
- **Match Scores** — Personalized percentage scores showing recommendation fit
- **Recommendation Insights** — Detailed breakdown of why each title was recommended

### Top Picks (Global)

- **Popularity-Based Content** — Trending content across all users
- **Multiple Output Modes** — Libraries, Collections, and/or Playlists
- **Rank Badges** — Gold, silver, bronze badges for top 3 on posters

### Symlinks & Artwork

- **Full Artwork Preservation** — Symlinks banner.jpg, clearlogo.png, landscape.jpg, and more
- **Smart Subtitle Handling** — Subtitles are symlinked and renamed to match video files
- **Custom NFOs** — Aperture generates NFOs with AI explanations while preserving original artwork

### Backup & Restore

- **Automatic Daily Backups** — Database backed up at 1 AM (configurable)
- **Restore During Setup** — Restore from backup when setting up a new instance
- **Admin Panel Restore** — Restore from the Admin → Settings → System tab
- **Configurable Retention** — Set how many backups to keep

### Admin Features

- **Setup Wizard** — Guided first-time configuration
- **Job Management** — Real-time progress, scheduling, and history
- **Configurable Schedules** — All job schedules adjustable via Admin → Jobs
- **User Management** — Per-user recommendation settings
- **Cost Estimator** — Built-in OpenAI API cost estimation

---

## Default Job Schedules

All schedules are configurable in **Admin → Jobs**.

| Job                 | Default Schedule         |
| ------------------- | ------------------------ |
| Database Backup     | Daily at 1 AM            |
| Library Scan        | Daily at 2 AM            |
| Embeddings          | Daily at 3 AM            |
| AI Recommendations  | Weekly on Sunday at 4 AM |
| Top Picks           | Daily at 5 AM            |
| Watch History       | Every 2 hours            |
| Metadata Enrichment | Every 6 hours            |

---

## Documentation

| Guide                                  | Description                                                  |
| -------------------------------------- | ------------------------------------------------------------ |
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
- **AI**: OpenAI Embeddings & GPT models
- **Infrastructure**: Docker, pnpm workspaces

---

## License

[MIT](LICENSE)
