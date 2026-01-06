# Architecture

Technical overview of Aperture's design, recommendation pipeline, and project structure.

## Project Structure

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
│   │   ├── trakt/       # Trakt.tv integration
│   │   ├── jobs/        # Job configuration & scheduling
│   │   └── settings/    # System configuration
│   └── ui/           # Shared React components
├── db/migrations/    # SQL migration files
└── docker/           # Dockerfile
```

---

## Tech Stack

- **Backend**: Fastify, TypeScript, PostgreSQL, pgvector
- **Frontend**: React, Vite, MUI, React Router
- **AI**: OpenAI Embeddings & GPT models
- **Infrastructure**: Docker, pnpm workspaces
- **Job Scheduling**: node-cron

---

## How It Works

### Recommendation Pipeline

1. **Media Sync**: Imports movies/series from your media server libraries
2. **Embedding Generation**: Creates high-dimensional vectors for each title using OpenAI
3. **Watch History Sync**: Tracks what users have watched, favorited, and rated
4. **Taste Profile**: Builds a vector representation of each user's preferences
5. **Candidate Scoring**: Scores all unwatched content based on:
   - Vector similarity to user's taste
   - User ratings (boosting liked content, excluding/penalizing disliked)
   - Novelty (exploring new content)
   - Community ratings
   - Diversity (avoiding repetitive recommendations)
6. **Selection**: Picks the top N titles balancing all factors
7. **Explanation Generation**: AI generates natural language explanations for each pick
8. **STRM Generation**: Creates virtual library files for the media server

### Vector Similarity

Media is represented as high-dimensional vectors (1536 or 3072 dimensions) capturing semantic meaning — genres, themes, plot, mood, cast, etc. Similar content has vectors that point in similar directions, measured by cosine similarity.

Your taste profile is the weighted average of vectors from content you've watched, with recent views and favorites weighted more heavily. Recommendations are titles whose vectors are close to your taste profile but that you haven't seen yet.

### Rating System

Aperture uses a 10-heart rating system compatible with Trakt.tv:

- **High ratings (7-10 hearts)**: Increase weight of similar content in your taste profile
- **Low ratings (1-3 hearts)**: Either exclude or penalize similar content based on user preference
- **Bidirectional sync**: Ratings sync with Trakt.tv if connected

### Top Picks Algorithm

Global popularity is calculated by aggregating watch data across all users:

- **Unique Viewers**: How many different users watched the title
- **Play Count**: Total number of plays across all users
- **Completion Rate**: How often users finish what they start

Weights are configurable, and a time window limits how far back to look for trending content.

---

## Background Jobs

### Movie Jobs

| Job                             | Description                            | Schedule     |
| ------------------------------- | -------------------------------------- | ------------ |
| `sync-movies`                   | Sync movies from media server          | Configurable |
| `generate-movie-embeddings`     | Generate AI embeddings                 | Manual       |
| `sync-movie-watch-history`      | Delta sync of watch history            | Configurable |
| `full-sync-movie-watch-history` | Full resync of watch history           | Manual       |
| `generate-movie-recommendations`| Generate personalized picks            | Configurable |
| `rebuild-movie-recommendations` | Clear and rebuild all recommendations  | Manual       |
| `sync-movie-libraries`          | Create movie libraries (STRM/symlinks) | Configurable |

### Series Jobs

| Job                               | Description                             | Schedule     |
| --------------------------------- | --------------------------------------- | ------------ |
| `sync-series`                     | Sync TV series and episodes             | Configurable |
| `generate-series-embeddings`      | Generate AI embeddings                  | Manual       |
| `sync-series-watch-history`       | Delta sync of watch history             | Configurable |
| `full-sync-series-watch-history`  | Full resync of watch history            | Manual       |
| `generate-series-recommendations` | Generate personalized picks             | Configurable |
| `sync-series-libraries`           | Create series libraries (STRM/symlinks) | Configurable |

### Global Jobs

| Job                   | Description                        | Schedule      |
| --------------------- | ---------------------------------- | ------------- |
| `refresh-top-picks`   | Refresh popularity-based libraries | Daily at 6 AM |
| `sync-trakt-ratings`  | Sync ratings from Trakt.tv         | Every 6 hours |

### Job Scheduling

Jobs are scheduled using node-cron with the following options:

- **Daily**: Run at a specific time each day
- **Weekly**: Run on a specific day and time
- **Interval**: Run every N hours (1, 2, 3, 4, 6, 8, or 12)
- **Manual**: Only run when triggered manually

The scheduler initializes on server startup and can be managed via:
- **Admin → Jobs → Schedule tab**: View and configure all scheduled jobs
- **API**: `GET /api/jobs/scheduler/status` for scheduler status

---

## Database Schema

Key tables:

- `users` — User accounts with media server and Trakt credentials
- `movies` / `series` — Media metadata
- `episodes` — TV episode data
- `movie_embeddings` / `series_embeddings` — Vector embeddings (pgvector)
- `movie_watch_history` / `episode_watch_history` — User watch history
- `user_ratings` — User ratings (1-10 hearts)
- `user_preferences` — User preference settings
- `movie_recommendations` / `series_recommendations` — Generated recommendations
- `channels` / `channel_movies` — User-created channels
- `system_settings` — Global configuration
- `job_runs` / `job_progress` — Job execution tracking
- `job_config` — Job scheduling configuration

