# Aperture

[![Version](https://img.shields.io/badge/version-0.1.7-blue.svg)](https://github.com/dgruhin-hrizn/aperture/releases)
[![Docker Image](https://img.shields.io/badge/docker-ghcr.io%2Fdgruhin--hrizn%2Faperture-blue?logo=docker)](https://github.com/dgruhin-hrizn/aperture/pkgs/container/aperture)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Aperture** — AI-powered media recommendations for Emby & Jellyfin.

```bash
docker pull ghcr.io/dgruhin-hrizn/aperture:latest
```

Aperture creates personalized recommendation libraries for your media server users using OpenAI embeddings and pgvector similarity search. Recommendations appear as STRM-based virtual libraries in your media server's home screen, with support for both **movies** and **TV series**.

## Documentation

| Guide                                  | Description                                                  |
| -------------------------------------- | ------------------------------------------------------------ |
| [Admin Guide](docs/admin-guide.md)     | Setup walkthrough, job management, algorithm tuning          |
| [User Guide](docs/user-guide.md)       | Features for end users, ratings, channels                    |
| [Configuration](docs/configuration.md) | Environment variables, STRM setup, reverse proxy, Trakt      |
| [API Reference](docs/api-reference.md) | Complete API endpoint documentation                          |
| [Architecture](docs/architecture.md)   | Technical overview, recommendation pipeline, database schema |
| [Development](docs/development.md)     | Local dev setup, scripts, contribution guidelines            |

---

## Features

### AI Recommendations

- **Personalized Libraries**: Creates dedicated "AI Picks" libraries for each user
- **OpenAI Embeddings**: Semantic vectors for all your media using text-embedding-3-small/large
- **pgvector Similarity**: Lightning-fast vector similarity search
- **Configurable Algorithm**: Tune weights for similarity, novelty, rating, and diversity

### Media Support

- **Movies**: Full movie library sync with metadata, ratings, and watch history
- **TV Series**: Complete series and episode tracking with per-show recommendations
- **Watch History**: Automatic sync of viewing history including play counts and favorites

### Rating System

- **10-Heart Ratings**: Rate content from 1-10 hearts (Trakt.tv compatible)
- **Rate from Any Poster**: Click the heart icon on any poster to rate instantly
- **Visual Fill Indicator**: Heart fills proportionally to show current rating
- **Trakt.tv Sync**: Bidirectional sync of ratings with Trakt
- **Smart Recommendations**: Ratings influence future recommendations

### Personalization

- **AI Taste Profiles**: Natural language descriptions of user preferences
- **Match Scores**: Personalized percentage scores showing recommendation fit
- **Recommendation Insights**: Detailed breakdown of why each title was recommended
- **Evidence Trail**: See which watched titles influenced each recommendation

### Watch Stats Dashboard

- **Genre Breakdown**: Donut chart of favorite genres
- **Watch Timeline**: Monthly activity visualization
- **Top Actors & Directors**: Most-watched with profile images
- **Movies vs Series**: Compare watching patterns

### Top Picks (Global)

- **Popularity-Based Content**: Trending content across all users
- **Multiple Output Modes**: Libraries, Collections, and/or Playlists
- **Rank-Ordered**: Collections maintain popularity order
- **Rank Badges**: Gold, silver, bronze badges for top 3 on posters

### Symlinks & Artwork

- **Full Artwork Preservation**: Symlinks banner.jpg, clearlogo.png, landscape.jpg, and more
- **Smart Subtitle Handling**: Subtitles are symlinked and renamed to match video files
- **Path Mapping**: Automatic translation between media server and local filesystem paths
- **Custom NFOs**: Aperture generates NFOs with AI explanations while preserving original artwork

### Library Image Management

- **Custom Library Images**: Set custom banner images for AI recommendation libraries
- **Global Defaults**: Admin-configured images apply to all users' libraries
- **Emby/Jellyfin Sync**: Library images automatically sync to your media server
- **16:9 Banners**: Optimized for media server home screen display

### Channels (Custom Collections)

- **User-Created Channels**: Build personalized collections with custom criteria
- **AI Generation**: Let AI populate channels based on preferences
- **Playlist Sync**: Channels sync as playlists to your media server

### Admin Features

- **Web-Based Configuration**: No env vars required for setup
- **Job Management**: Real-time progress, scheduling, and history
- **Schedule Overview**: View all scheduled jobs in a dedicated table
- **User Management**: Per-user recommendation settings
- **Cost Estimator**: Built-in OpenAI API cost estimation

### Poster Overlays

- **Rank Badges**: Unified gold/silver/bronze styling across all views
- **Heart Rating Overlay**: Rate directly from any poster with a single click
- **Consistent Sizing**: Medium-sized posters throughout the app for visual consistency

---

## Quick Start

### Prerequisites

- Docker and Docker Compose
- An Emby or Jellyfin server with admin API key
- OpenAI API key

### Using Pre-built Docker Image

1. **Create docker-compose.yml**

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    container_name: aperture-db
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: changeme-db-password
      POSTGRES_DB: aperture
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U app -d aperture']
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  app:
    image: ghcr.io/dgruhin-hrizn/aperture:latest
    container_name: aperture
    environment:
      NODE_ENV: production
      PORT: 3456
      DATABASE_URL: postgres://app:changeme-db-password@db:5432/aperture
      SESSION_SECRET: changeme-generate-random-32-char-string
      APP_BASE_URL: http://localhost:3456
      RUN_MIGRATIONS_ON_START: 'true'
      OPENAI_API_KEY: sk-your-openai-api-key
      MEDIA_SERVER_STRM_ROOT: /strm
      AI_LIBRARY_PATH_PREFIX: /strm/aperture/
    ports:
      - '3456:3456'
    volumes:
      - ./strm:/strm
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

volumes:
  pgdata:
```

2. **Configure environment variables**
   - `SESSION_SECRET` — Generate a random string (at least 32 characters)
   - `OPENAI_API_KEY` — Your OpenAI API key
   - `APP_BASE_URL` — The URL where you'll access Aperture
   - Database passwords (change `changeme-db-password` in both places)

3. **Start Aperture**

```bash
docker compose up -d
```

4. **Open the app** at http://localhost:3456 and log in with your Emby/Jellyfin credentials.

5. **Configure your media server** in Admin → Settings → Media Server.

### Updating

```bash
docker compose pull
docker compose up -d
```

---

## Tech Stack

- **Backend**: Fastify, TypeScript, PostgreSQL, pgvector
- **Frontend**: React, Vite, MUI, React Router
- **AI**: OpenAI Embeddings & GPT models
- **Infrastructure**: Docker, pnpm workspaces

## License

MIT
