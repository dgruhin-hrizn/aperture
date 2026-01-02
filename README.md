# Aperture

**Aperture** — AI-powered movie recommendations for Emby & Jellyfin.

Aperture creates personalized recommendation libraries for your media server users using OpenAI embeddings and pgvector similarity search. Recommendations appear as STRM-based virtual libraries in your media server's home screen.

## Features

### Core Features
- **AI Recommendations**: Uses OpenAI embeddings to find movies similar to what each user has watched
- **Per-User Libraries**: Creates dedicated "AI Picks" libraries for each enabled user
- **Media Server Integration**: Supports both Emby and Jellyfin with deep linking
- **Custom Channels**: Users can create genre-filtered channels that appear as playlists
- **Dark UI**: Modern, Jellyseerr-inspired admin interface

### Personalization
- **AI Taste Profile**: AI-generated natural language synopsis of each user's movie taste, displayed on the home screen
- **Match Scores**: Personalized percentage scores on movie posters showing how well each film matches user preferences
- **Recommendation Insights**: Detailed breakdown of why each movie was recommended, including:
  - **Taste Match**: Similarity to movies you've enjoyed
  - **Discovery**: How it helps you explore new content
  - **Quality**: Community and critic ratings
  - **Variety**: Diversity in your recommendations
- **Genre Analysis**: See which genres in a recommendation match your preferences
- **Evidence Trail**: View the specific movies from your watch history that influenced each recommendation

### Admin Features
- **Library Selection**: Choose which media server libraries to include in movie sync
- **Recommendation Algorithm Tuning**: Configure weights for similarity, novelty, rating, and diversity
- **Database Management**: Purge movie data and reset the system when needed
- **Job Monitoring**: Real-time progress tracking for sync and recommendation jobs

### User Experience
- **Play on Emby/Jellyfin**: One-click deep links to play movies directly in your media server
- **Similar Movies**: Vector-based similarity search shows related films on each movie page
- **Welcome Modal**: Onboarding experience explaining how the AI recommendations work
- **Watch History**: View and track your complete viewing history with play counts

## Screenshots

The home screen shows your personalized taste profile, top recommendations with match scores, and recently watched movies.

Movie detail pages include full AI scoring breakdowns, genre analysis, and evidence from your watch history explaining why each movie was recommended.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- pnpm (`corepack enable && corepack prepare pnpm@latest --activate`)
- An Emby or Jellyfin server
- OpenAI API key

### Docker Deployment

1. **Clone and configure**

```bash
git clone <repo-url> aperture
cd aperture
cp env.local.example .env.local
```

2. **Edit `.env.local`**

```bash
# Required settings
SESSION_SECRET=your-random-secret-at-least-32-chars
APP_BASE_URL=http://localhost:3456
DATABASE_URL=postgres://app:app@db:5432/aperture

# OpenAI
OPENAI_API_KEY=sk-...

# Media Server
MEDIA_SERVER_TYPE=emby  # or 'jellyfin'
MEDIA_SERVER_BASE_URL=http://your-server:8096
MEDIA_SERVER_API_KEY=your-api-key
```

3. **Start the stack**

```bash
pnpm docker:up
```

4. **Open the app**

Navigate to http://localhost:3456 and log in with your media server credentials.

### Local Development

1. **Install dependencies**

```bash
pnpm install
```

2. **Start the database**

```bash
docker compose up -d db
```

3. **Configure environment**

```bash
cp env.local.example .env.local
# Edit .env.local with your settings
# Use DATABASE_URL=postgres://app:app@localhost:5432/aperture for local dev
```

4. **Run migrations**

```bash
pnpm db:migrate
```

5. **Start dev servers**

```bash
pnpm dev
```

This starts:
- API server at http://localhost:3456
- Web dev server at http://localhost:3457 (with proxy to API)

## Architecture

```
aperture/
├── apps/
│   ├── api/          # Fastify API server
│   └── web/          # React + Vite + MUI frontend
├── packages/
│   ├── core/         # Shared business logic
│   │   ├── config/   # Environment validation
│   │   ├── lib/      # Logger, DB pool, taste synopsis
│   │   ├── media/    # Emby/Jellyfin providers
│   │   ├── recommender/  # Embeddings & recommendation pipeline
│   │   ├── strm/     # STRM file generation
│   │   └── channels/ # Channel management
│   └── ui/           # Shared React components
├── db/migrations/    # SQL migration files
└── docker/           # Dockerfile
```

## Configuration

All configuration is done via environment variables. See `env.local.example` for the full list.

### Core Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3456` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `SESSION_SECRET` | Secret for session cookies (min 32 chars) | Required |
| `APP_BASE_URL` | Public URL of the application | Required |
| `DATABASE_URL` | PostgreSQL connection string | Required |

### OpenAI Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required for embeddings |
| `OPENAI_EMBED_MODEL` | Embedding model to use | `text-embedding-3-small` |

### Media Server Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `MEDIA_SERVER_TYPE` | `emby` or `jellyfin` | `emby` |
| `MEDIA_SERVER_BASE_URL` | Media server URL | Required |
| `MEDIA_SERVER_API_KEY` | Admin API key | Required for sync |
| `MEDIA_SERVER_STRM_ROOT` | Container path for STRM files | `/strm` |

### Job Schedules (Cron)

| Variable | Description | Default |
|----------|-------------|---------|
| `SYNC_CRON` | Movie and watch history sync | `0 3 * * *` (3 AM) |
| `RECS_CRON` | Generate recommendations | `0 4 * * *` (4 AM) |
| `PERMS_CRON` | Update library permissions | `0 5 * * *` (5 AM) |

### Recommendation Algorithm (Admin UI)

These settings are configured via the Admin Settings page in the UI:

| Setting | Description | Default |
|---------|-------------|---------|
| Max Candidates | Maximum movies to consider | 50,000 (unlimited) |
| Selected Count | Number of recommendations per user | 50 |
| Recent Watch Limit | Recent watches to analyze | 100 |
| Similarity Weight | Weight for taste matching | 0.5 |
| Novelty Weight | Weight for discovery/exploration | 0.3 |
| Rating Weight | Weight for community ratings | 0.2 |
| Diversity Weight | Weight for variety in results | 0.3 |

## Usage

### Getting Started

1. Log in with your media server admin account
2. Go to **Admin > Settings** and configure which libraries to sync
3. Go to **Admin > Jobs** and run:
   - `sync-movies` - Import your movie library
   - `generate-embeddings` - Create AI embeddings (requires OpenAI)
4. Go to **Admin > Users** and enable AI recommendations for users
5. Run `sync-watch-history` to import viewing history
6. Run `generate-recommendations` to create personalized picks

### Understanding Your Recommendations

Each movie in your recommendations includes:

- **Match Score**: A percentage showing how well the movie fits your taste (displayed on posters)
- **Score Breakdown**: Detailed factors including taste match, discovery potential, quality, and variety
- **Genre Analysis**: Which genres match your preferences
- **Evidence**: Similar movies you've watched that influenced this recommendation

### STRM Libraries

When recommendations are generated for an enabled user, Aperture:

1. Creates a virtual library in your media server named "AI Picks - {Username}"
2. Writes STRM files pointing to the actual media files
3. Restricts library visibility to just that user

The user will see a new library on their home screen with their personalized recommendations.

### Play on Emby/Jellyfin

Click the "Play on Emby" (or Jellyfin) button on any movie detail page to open the movie directly in your media server's web interface, ready to play.

### AI Taste Profile

Your home screen displays an AI-generated synopsis describing your movie taste. This is generated by analyzing:

- Your watch history and favorite genres
- Preferred decades and eras
- Types of movies you gravitate toward
- Patterns in your viewing habits

Click the refresh button to regenerate your profile with the latest data.

### Custom Channels

Users can create custom channels with:

- **Genre Filters**: Only include specific genres
- **Text Preferences**: Natural language preferences (e.g., "classic noir films")
- **Example Movies**: Seed movies to define the channel's taste

Channels appear as playlists in the media server and can be shared with other users.

## API Endpoints

### Authentication

- `POST /api/auth/login` - Authenticate with media server credentials
- `POST /api/auth/logout` - End session
- `GET /api/auth/me` - Get current user

### Users

- `GET /api/users` - List all users (Admin)
- `GET /api/users/:id` - Get user details
- `GET /api/users/:id/stats` - Get user statistics (watched, favorites, recommendations)
- `GET /api/users/:id/watch-history` - Get user's watch history
- `GET /api/users/:id/taste-profile` - Get AI-generated taste synopsis
- `POST /api/users/:id/taste-profile/regenerate` - Regenerate taste synopsis
- `PUT /api/users/:id` - Update user (enable/disable AI)

### Movies

- `GET /api/movies` - List movies (paginated)
- `GET /api/movies/:id` - Get movie details
- `GET /api/movies/:id/similar` - Get similar movies (vector search)
- `GET /api/movies/genres` - List all genres

### Recommendations

- `GET /api/recommendations/:userId` - Get user's recommendations
- `GET /api/recommendations/:userId/movie/:movieId/insights` - Get detailed recommendation insights
- `GET /api/recommendations/:userId/history` - Get recommendation run history

### Settings (Admin)

- `GET /api/settings/media-server` - Get media server info for deep linking
- `GET /api/settings/libraries` - Get library configurations
- `POST /api/settings/libraries/sync` - Sync libraries from media server
- `PUT /api/settings/libraries/:id` - Enable/disable a library
- `GET /api/settings/recommendations` - Get recommendation algorithm config
- `PATCH /api/settings/recommendations` - Update recommendation config
- `POST /api/settings/recommendations/reset` - Reset to defaults
- `DELETE /api/settings/database/purge` - Purge movie database

### Channels

- `GET /api/channels` - List user's channels
- `POST /api/channels` - Create channel
- `PUT /api/channels/:id` - Update channel
- `DELETE /api/channels/:id` - Delete channel

### Jobs (Admin)

- `GET /api/jobs` - List all jobs
- `POST /api/jobs/:name/run` - Trigger a job

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
- **AI**: OpenAI Embeddings (text-embedding-3-small), GPT-4o-mini for taste profiles
- **Infrastructure**: Docker, pnpm workspaces

## How It Works

### Recommendation Pipeline

1. **Movie Sync**: Imports movies from your media server libraries
2. **Embedding Generation**: Creates 1536-dimensional vectors for each movie using OpenAI
3. **Watch History Sync**: Tracks what users have watched and favorited
4. **Taste Profile**: Builds a vector representation of each user's preferences
5. **Candidate Scoring**: Scores all unwatched movies based on:
   - Vector similarity to user's taste
   - Novelty (exploring new content)
   - Community ratings
   - Diversity (avoiding repetitive recommendations)
6. **Selection**: Picks the top N movies balancing all factors
7. **STRM Generation**: Creates virtual library files for the media server

### Vector Similarity

Movies are represented as 1536-dimensional vectors capturing their semantic meaning (genres, themes, plot, mood, etc.). Similar movies have vectors that point in similar directions, measured by cosine similarity.

Your taste profile is the average of vectors from movies you've watched, weighted by recency and ratings. Recommendations are movies whose vectors are close to your taste profile.

## License

MIT
