# Aperture

**Aperture** — AI-powered media recommendations for Emby & Jellyfin.

Aperture creates personalized recommendation libraries for your media server users using OpenAI embeddings and pgvector similarity search. Recommendations appear as STRM-based virtual libraries in your media server's home screen, with support for both **movies** and **TV series**.

## Features

### AI Recommendations
- **Personalized Libraries**: Creates dedicated "AI Picks" libraries for each user containing movies and TV series tailored to their taste
- **OpenAI Embeddings**: Uses text-embedding-3-small/large to create semantic vectors for all your media
- **pgvector Similarity**: Lightning-fast vector similarity search for finding related content
- **Configurable Algorithm**: Tune weights for similarity, novelty, rating, and diversity

### Media Support
- **Movies**: Full movie library sync with metadata, ratings, and watch history
- **TV Series**: Complete series and episode tracking with per-show recommendations
- **Watch History**: Automatic sync of viewing history including play counts and favorites

### Personalization
- **AI Taste Profiles**: Separate AI-generated natural language descriptions of each user's movie and TV taste
- **Match Scores**: Personalized percentage scores on posters showing how well each title matches user preferences
- **Recommendation Insights**: Detailed breakdown of why each title was recommended:
  - **Taste Match**: Similarity to content you've enjoyed
  - **Discovery**: How it helps you explore new content
  - **Quality**: Community and critic ratings
  - **Variety**: Diversity in your recommendations
- **Genre Analysis**: See which genres match your preferences
- **Evidence Trail**: View specific titles from your watch history that influenced each recommendation

### Top Picks (Global)
- **Popularity-Based Libraries**: Global "Top Picks" libraries showing trending content across all users
- **Configurable Metrics**: Weight by unique viewers, play count, and completion rate
- **Time Windows**: Configure how far back to look for popular content
- **Separate Libraries**: Independent Top Picks libraries for movies and series

### Channels (Custom Collections)
- **User-Created Channels**: Build personalized collections with custom criteria
- **Genre Filters**: Filter by specific genres
- **Text Preferences**: Natural language preferences (e.g., "classic noir films", "heartwarming comedies")
- **Example Titles**: Seed channels with example movies to define the taste
- **AI Generation**: Let AI populate your channel based on your criteria
- **Sharing**: Share channels with other users
- **Playlist Sync**: Channels sync as playlists to your media server

### Media Server Integration
- **Emby & Jellyfin**: Full support for both platforms with deep linking
- **STRM Libraries**: Virtual libraries using STRM files for seamless integration
- **Per-User Permissions**: Each user only sees their own recommendation library
- **Play Buttons**: One-click deep links to play content directly in your media server
- **Library Selection**: Choose which source libraries to include in sync

### Admin Features
- **Web-Based Configuration**: Configure media server connection from the UI (no env vars required)
- **Job Management**: Real-time progress tracking, scheduling, and history for all background jobs
- **User Management**: Enable/disable AI recommendations per user, separately for movies and series
- **Algorithm Tuning**: Configure recommendation weights and parameters separately for movies and series
- **Model Selection**: Choose between embedding models (small/large) and text generation models (GPT-4o-mini, GPT-5-nano, etc.)
- **Cost Estimator**: Built-in OpenAI API cost estimation based on your configuration
- **Database Management**: Purge and reset functionality for media data

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ and pnpm (for local development)
- An Emby or Jellyfin server with admin API key
- OpenAI API key

### Docker Deployment

1. **Clone and configure**

```bash
git clone <repo-url> aperture
cd aperture
cp env.local.example .env.local
```

2. **Edit `.env.local`** with required settings:

```bash
# Required
SESSION_SECRET=your-random-secret-at-least-32-chars
APP_BASE_URL=http://localhost:3456
DATABASE_URL=postgres://app:app@db:5432/aperture

# OpenAI (for AI features)
OPENAI_API_KEY=sk-...

# Media Server (can also configure via Admin UI)
MEDIA_SERVER_TYPE=emby  # or 'jellyfin'
MEDIA_SERVER_BASE_URL=http://your-server:8096
MEDIA_SERVER_API_KEY=your-api-key
```

3. **Start the stack**

```bash
docker compose up -d
```

4. **Open the app** at http://localhost:3456 and log in with your media server credentials.

### Local Development

```bash
# Install dependencies
pnpm install

# Start the database
docker compose up -d db

# Configure environment
cp env.local.example .env.local
# Edit .env.local - use DATABASE_URL=postgres://app:app@localhost:5432/aperture

# Run migrations
pnpm db:migrate

# Start dev servers
pnpm dev
```

This starts:
- API server at http://localhost:3456
- Web dev server at http://localhost:3457 (with proxy to API)

## Getting Started

### Initial Setup

1. **Configure Media Server** (Admin > Settings > Media Server)
   - Enter your Emby/Jellyfin URL and API key
   - Test the connection

2. **Select Libraries** (Admin > Settings > Libraries)
   - Sync libraries from your media server
   - Enable which movie and TV libraries to include

3. **Run Initial Sync** (Admin > Jobs)
   - `sync-movies` — Import your movie library
   - `sync-series` — Import your TV series library
   - `generate-embeddings` — Create AI embeddings for movies
   - `generate-series-embeddings` — Create AI embeddings for series

4. **Enable Users** (Admin > Users)
   - Enable AI recommendations for users (separate toggles for movies/series)

5. **Sync Watch History** (Admin > Jobs)
   - `sync-watch-history` — Import movie viewing history
   - `sync-series-watch-history` — Import series viewing history

6. **Generate Recommendations** (Admin > Jobs)
   - `generate-recommendations` — Create personalized movie picks
   - `generate-series-recommendations` — Create personalized series picks
   - `sync-strm` / `sync-series-strm` — Create virtual libraries in media server

### Ongoing Operations

Jobs can be scheduled to run automatically:
- **Daily/Weekly/Interval**: Configure schedule type per job
- **Manual**: Trigger jobs on-demand from the admin panel

## Architecture

```
aperture/
├── apps/
│   ├── api/          # Fastify API server
│   └── web/          # React + Vite + MUI frontend
├── packages/
│   ├── core/         # Shared business logic
│   │   ├── channels/    # Channel management & AI
│   │   ├── media/       # Emby/Jellyfin providers
│   │   ├── recommender/ # Embeddings & recommendation pipeline
│   │   │   ├── movies/     # Movie-specific logic
│   │   │   ├── series/     # Series-specific logic
│   │   │   └── shared/     # Common scoring/selection
│   │   ├── strm/        # STRM file generation
│   │   ├── topPicks/    # Global popularity libraries
│   │   └── settings/    # System configuration
│   └── ui/           # Shared React components
├── db/migrations/    # SQL migration files
└── docker/           # Dockerfile
```

## Configuration

### Environment Variables

All configuration can be done via environment variables or the Admin UI.

#### Core Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3456` |
| `NODE_ENV` | Environment mode | `development` |
| `SESSION_SECRET` | Session cookie secret (min 32 chars) | **Required** |
| `APP_BASE_URL` | Public URL of the application | **Required** |
| `DATABASE_URL` | PostgreSQL connection string | **Required** |

#### OpenAI Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required for AI features |
| `OPENAI_EMBED_MODEL` | Embedding model | `text-embedding-3-small` |

#### Media Server Settings

These can also be configured via Admin > Settings > Media Server.

| Variable | Description | Default |
|----------|-------------|---------|
| `MEDIA_SERVER_TYPE` | `emby` or `jellyfin` | `emby` |
| `MEDIA_SERVER_BASE_URL` | Media server URL | — |
| `MEDIA_SERVER_API_KEY` | Admin API key | — |

#### STRM Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `MEDIA_SERVER_STRM_ROOT` | Where Aperture writes STRM files | `/strm` |
| `AI_LIBRARY_PATH_PREFIX` | Path prefix as seen by media server | `/strm/aperture/` |
| `AI_LIBRARY_NAME_PREFIX` | Library name prefix | `AI Picks - ` |
| `STRM_USE_STREAMING_URL` | Use streaming URLs in STRM files | `true` |
| `MEDIA_SERVER_LIBRARY_ROOT` | Root path for direct file paths | `/mnt/media` |

#### Job Schedules (Defaults)

| Variable | Description | Default |
|----------|-------------|---------|
| `SYNC_CRON` | Media sync schedule | `0 3 * * *` (3 AM) |
| `RECS_CRON` | Recommendation generation | `0 4 * * *` (4 AM) |
| `PERMS_CRON` | STRM/permissions sync | `0 5 * * *` (5 AM) |

### Admin UI Configuration

The Admin Settings page provides UI-based configuration for:

- **Media Server**: Connection details, test connection
- **Libraries**: Enable/disable source libraries
- **AI Config**: Algorithm weights for movies and series separately
- **Embedding Model**: Choose small (fast/cheap) or large (best quality)
- **Text Generation Model**: Select GPT model for taste profiles and explanations
- **Top Picks**: Configure global popularity libraries
- **Cost Estimator**: Estimate OpenAI API costs based on your setup

## Background Jobs

### Movie Jobs

| Job | Description | Schedule |
|-----|-------------|----------|
| `sync-movies` | Sync movies from media server | Configurable |
| `generate-embeddings` | Generate AI embeddings | Manual |
| `sync-watch-history` | Delta sync of watch history | Configurable |
| `full-sync-watch-history` | Full resync of watch history | Manual |
| `generate-recommendations` | Generate personalized picks | Configurable |
| `rebuild-recommendations` | Clear and rebuild all recommendations | Manual |
| `sync-strm` | Create STRM files and libraries | Configurable |

### Series Jobs

| Job | Description | Schedule |
|-----|-------------|----------|
| `sync-series` | Sync TV series and episodes | Configurable |
| `generate-series-embeddings` | Generate AI embeddings | Manual |
| `sync-series-watch-history` | Delta sync of watch history | Configurable |
| `full-sync-series-watch-history` | Full resync of watch history | Manual |
| `generate-series-recommendations` | Generate personalized picks | Configurable |
| `sync-series-strm` | Create STRM files and libraries | Configurable |

### Global Jobs

| Job | Description | Schedule |
|-----|-------------|----------|
| `refresh-top-picks` | Refresh popularity-based libraries | Daily at 6 AM |

### Job Scheduling Options

- **Daily**: Run at a specific time each day
- **Weekly**: Run on a specific day and time
- **Interval**: Run every N hours (1, 2, 3, 4, 6, 8, or 12)
- **Manual**: Only run when triggered manually

## API Reference

### Authentication

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Authenticate with media server credentials |
| `POST /api/auth/logout` | End session |
| `GET /api/auth/me` | Get current user |

### Users

| Endpoint | Description |
|----------|-------------|
| `GET /api/users` | List all users (Admin) |
| `GET /api/users/:id` | Get user details |
| `GET /api/users/:id/stats` | Get user statistics |
| `GET /api/users/:id/watch-history` | Get movie watch history |
| `GET /api/users/:id/taste-profile` | Get movie taste synopsis |
| `POST /api/users/:id/taste-profile/regenerate` | Regenerate movie taste |
| `GET /api/users/:id/series-taste-profile` | Get series taste synopsis |
| `POST /api/users/:id/series-taste-profile/regenerate` | Regenerate series taste |
| `PUT /api/users/:id` | Update user settings |

### Movies

| Endpoint | Description |
|----------|-------------|
| `GET /api/movies` | List movies (paginated, filterable) |
| `GET /api/movies/:id` | Get movie details |
| `GET /api/movies/:id/similar` | Get similar movies (vector search) |
| `GET /api/movies/genres` | List all genres |

### Recommendations

| Endpoint | Description |
|----------|-------------|
| `GET /api/recommendations/:userId` | Get user's movie recommendations |
| `GET /api/recommendations/:userId/movie/:movieId/insights` | Get recommendation insights |
| `GET /api/recommendations/:userId/history` | Get recommendation run history |

### Channels

| Endpoint | Description |
|----------|-------------|
| `GET /api/channels` | List user's channels |
| `POST /api/channels` | Create channel |
| `GET /api/channels/:id` | Get channel details |
| `PUT /api/channels/:id` | Update channel |
| `DELETE /api/channels/:id` | Delete channel |
| `POST /api/channels/:id/generate` | AI-generate channel content |
| `POST /api/channels/:id/sync` | Sync to media server playlist |

### Settings (Admin)

| Endpoint | Description |
|----------|-------------|
| `GET /api/settings/media-server` | Get media server info |
| `GET /api/settings/media-server/config` | Get full config (Admin) |
| `PATCH /api/settings/media-server/config` | Update config |
| `POST /api/settings/media-server/test` | Test connection |
| `GET /api/settings/libraries` | Get library configurations |
| `POST /api/settings/libraries/sync` | Sync from media server |
| `PATCH /api/settings/libraries/:id` | Enable/disable library |
| `GET /api/settings/recommendations` | Get algorithm config |
| `PATCH /api/settings/recommendations/movies` | Update movie config |
| `PATCH /api/settings/recommendations/series` | Update series config |
| `GET /api/settings/embedding-model` | Get embedding model |
| `PATCH /api/settings/embedding-model` | Set embedding model |
| `GET /api/settings/text-generation-model` | Get text gen model |
| `PATCH /api/settings/text-generation-model` | Set text gen model |
| `GET /api/settings/top-picks` | Get Top Picks config |
| `PATCH /api/settings/top-picks` | Update Top Picks config |
| `GET /api/settings/cost-inputs` | Get cost estimation data |

### Jobs (Admin)

| Endpoint | Description |
|----------|-------------|
| `GET /api/jobs` | List all jobs with status |
| `POST /api/jobs/:name/run` | Trigger a job |
| `POST /api/jobs/:name/cancel` | Cancel running job |
| `GET /api/jobs/:name/config` | Get job schedule config |
| `PATCH /api/jobs/:name/config` | Update job schedule |
| `GET /api/jobs/:name/history` | Get job run history |
| `GET /api/jobs/progress/stream/:jobId` | SSE stream for progress |

### Database (Admin)

| Endpoint | Description |
|----------|-------------|
| `GET /api/admin/purge/stats` | Get database statistics |
| `POST /api/admin/purge/movies` | Purge all movie data |

## How It Works

### Recommendation Pipeline

1. **Media Sync**: Imports movies/series from your media server libraries
2. **Embedding Generation**: Creates high-dimensional vectors for each title using OpenAI
3. **Watch History Sync**: Tracks what users have watched, favorited, and rated
4. **Taste Profile**: Builds a vector representation of each user's preferences
5. **Candidate Scoring**: Scores all unwatched content based on:
   - Vector similarity to user's taste
   - Novelty (exploring new content)
   - Community ratings
   - Diversity (avoiding repetitive recommendations)
6. **Selection**: Picks the top N titles balancing all factors
7. **Explanation Generation**: AI generates natural language explanations for each pick
8. **STRM Generation**: Creates virtual library files for the media server

### Vector Similarity

Media is represented as high-dimensional vectors (1536 or 3072 dimensions) capturing semantic meaning — genres, themes, plot, mood, cast, etc. Similar content has vectors that point in similar directions, measured by cosine similarity.

Your taste profile is the weighted average of vectors from content you've watched, with recent views and favorites weighted more heavily. Recommendations are titles whose vectors are close to your taste profile but that you haven't seen yet.

### Top Picks Algorithm

Global popularity is calculated by aggregating watch data across all users:

- **Unique Viewers**: How many different users watched the title
- **Play Count**: Total number of plays across all users
- **Completion Rate**: How often users finish what they start

Weights are configurable, and a time window limits how far back to look for trending content.

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start API and web dev servers |
| `pnpm dev:api` | Start only the API server |
| `pnpm dev:web` | Start only the web dev server |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Type check all packages |
| `pnpm lint` | Lint all packages |
| `pnpm db:migrate` | Run database migrations |
| `pnpm docker:up` | Start Docker stack |
| `pnpm docker:down` | Stop Docker stack |
| `pnpm docker:db` | Start only the database container |

## Tech Stack

- **Backend**: Fastify, TypeScript, PostgreSQL, pgvector
- **Frontend**: React, Vite, MUI, React Router
- **AI**: OpenAI Embeddings & GPT models
- **Infrastructure**: Docker, pnpm workspaces

## License

MIT
