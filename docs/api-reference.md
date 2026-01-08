# API Reference

Complete reference for all Aperture API endpoints.

## Table of Contents

- [Authentication](#authentication)
- [Users](#users)
- [Movies](#movies)
- [Series](#series)
- [Ratings](#ratings)
- [Recommendations](#recommendations)
- [Top Picks](#top-picks)
- [Channels](#channels)
- [AI Assistant](#ai-assistant)
- [Trakt Integration](#trakt-integration)
- [Settings (Admin)](#settings-admin)
- [Jobs (Admin)](#jobs-admin)
- [Database (Admin)](#database-admin)

---

## Authentication

| Endpoint                | Description                                |
| ----------------------- | ------------------------------------------ |
| `POST /api/auth/login`  | Authenticate with media server credentials |
| `POST /api/auth/logout` | End session                                |
| `GET /api/auth/me`      | Get current user                           |

---

## Users

| Endpoint                                                    | Description                     |
| ----------------------------------------------------------- | ------------------------------- |
| `GET /api/users`                                            | List all users (Admin)          |
| `GET /api/users/:id`                                        | Get user details                |
| `GET /api/users/:id/stats`                                  | Get user statistics             |
| `GET /api/users/:id/watch-history`                          | Get movie watch history         |
| `GET /api/users/:id/series-watch-history`                   | Get series watch history        |
| `GET /api/users/:id/watch-stats`                            | Get watch stats with breakdowns |
| `GET /api/users/:id/taste-profile`                          | Get movie taste synopsis        |
| `POST /api/users/:id/taste-profile/regenerate`              | Regenerate movie taste          |
| `GET /api/users/:id/series-taste-profile`                   | Get series taste synopsis       |
| `POST /api/users/:id/series-taste-profile/regenerate`       | Regenerate series taste         |
| `PUT /api/users/:id`                                        | Update user settings            |
| `DELETE /api/users/:id/watch-history/movies/:movieId`       | Mark movie as unwatched         |
| `DELETE /api/users/:id/watch-history/episodes/:episodeId`   | Mark episode as unwatched       |
| `DELETE /api/users/:id/watch-history/series/:id/seasons/:n` | Mark season as unwatched        |
| `DELETE /api/users/:id/watch-history/series/:seriesId`      | Mark entire series as unwatched |

---

## Movies

| Endpoint                      | Description                         |
| ----------------------------- | ----------------------------------- |
| `GET /api/movies`             | List movies (paginated, filterable) |
| `GET /api/movies/:id`         | Get movie details                   |
| `GET /api/movies/:id/similar` | Get similar movies (vector search)  |
| `GET /api/movies/genres`      | List all genres                     |

---

## Series

| Endpoint                       | Description                         |
| ------------------------------ | ----------------------------------- |
| `GET /api/series`              | List series (paginated, filterable) |
| `GET /api/series/:id`          | Get series details with seasons     |
| `GET /api/series/:id/episodes` | Get all episodes for a series       |
| `GET /api/series/:id/similar`  | Get similar series (vector search)  |
| `GET /api/series/genres`       | List all genres                     |

---

## Ratings

| Endpoint                        | Description                  |
| ------------------------------- | ---------------------------- |
| `GET /api/ratings`              | Get all user ratings         |
| `GET /api/ratings/movie/:id`    | Get rating for a movie       |
| `POST /api/ratings/movie/:id`   | Rate a movie (1-10)          |
| `DELETE /api/ratings/movie/:id` | Remove rating for a movie    |
| `GET /api/ratings/series/:id`   | Get rating for a series      |
| `POST /api/ratings/series/:id`  | Rate a series (1-10)         |
| `DELETE /api/ratings/series/:id`| Remove rating for a series   |

---

## Recommendations

| Endpoint                                                   | Description                      |
| ---------------------------------------------------------- | -------------------------------- |
| `GET /api/recommendations/:userId`                         | Get user's movie recommendations |
| `GET /api/recommendations/:userId/movie/:movieId/insights` | Get recommendation insights      |
| `GET /api/recommendations/:userId/history`                 | Get recommendation run history   |

---

## Top Picks

| Endpoint                    | Description             |
| --------------------------- | ----------------------- |
| `GET /api/top-picks/movies` | Get top trending movies |
| `GET /api/top-picks/series` | Get top trending series |

---

## Channels

| Endpoint                          | Description                   |
| --------------------------------- | ----------------------------- |
| `GET /api/channels`               | List user's channels          |
| `POST /api/channels`              | Create channel                |
| `GET /api/channels/:id`           | Get channel details           |
| `PUT /api/channels/:id`           | Update channel                |
| `DELETE /api/channels/:id`        | Delete channel                |
| `POST /api/channels/:id/generate` | AI-generate channel content   |
| `POST /api/channels/:id/sync`     | Sync to media server playlist |

---

## AI Assistant

The AI Assistant (Encore) provides conversational recommendations and library exploration.

### Chat

| Endpoint                       | Description                           |
| ------------------------------ | ------------------------------------- |
| `POST /api/assistant/chat`     | Send a message and stream AI response |

The chat endpoint accepts a JSON body with messages array and returns a streaming response (Server-Sent Events) with the AI's reply, including tool calls for content discovery.

### Conversations

| Endpoint                                        | Description                    |
| ----------------------------------------------- | ------------------------------ |
| `GET /api/assistant/conversations`              | List user's conversations      |
| `POST /api/assistant/conversations`             | Create new conversation        |
| `GET /api/assistant/conversations/:id`          | Get conversation with messages |
| `PATCH /api/assistant/conversations/:id`        | Update conversation (rename)   |
| `DELETE /api/assistant/conversations/:id`       | Delete conversation            |
| `POST /api/assistant/conversations/:id/messages`| Save messages to conversation  |

### Suggestions

| Endpoint                        | Description                            |
| ------------------------------- | -------------------------------------- |
| `GET /api/assistant/suggestions`| Get personalized conversation starters |

Suggestions are AI-generated prompts based on the user's watch history and preferences, refreshed periodically by a background job.

### Available Tools

The assistant has access to these tools for content discovery:

| Tool                 | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `searchContent`      | Filter-based search (genre, year, rating, actor, etc) |
| `semanticSearch`     | AI-powered conceptual/thematic search                 |
| `findSimilarContent` | Find movies/series similar to a given title           |
| `getContentDetails`  | Get full details about a specific title               |
| `getMyRecommendations`| Get user's AI-generated recommendations              |
| `getTopRated`        | Get highest-rated content                             |
| `getUnwatched`       | Get content user hasn't watched                       |
| `getWatchHistory`    | Get user's watch history                              |
| `getUserRatings`     | Get user's ratings                                    |
| `getLibraryStats`    | Get library statistics                                |
| `getContentRankings` | Get content leaderboards (longest, oldest, etc)       |
| `getAvailableGenres` | List all genres with counts                           |
| `searchPeople`       | Search actors/directors with filmography              |
| `getTopStudios`      | Get user's most-watched studios/networks              |
| `getSystemHelp`      | Get help on Aperture features                         |

---

## Trakt Integration

| Endpoint                   | Description                      |
| -------------------------- | -------------------------------- |
| `GET /api/trakt/auth-url`  | Get Trakt OAuth authorization URL|
| `POST /api/trakt/callback` | Handle OAuth callback            |
| `POST /api/trakt/sync`     | Manually sync Trakt ratings      |
| `DELETE /api/trakt/disconnect` | Disconnect Trakt account     |

---

## Settings (Admin)

| Endpoint                                      | Description                 |
| --------------------------------------------- | --------------------------- |
| `GET /api/settings/media-server`              | Get media server info       |
| `GET /api/settings/media-server/config`       | Get full config (Admin)     |
| `PATCH /api/settings/media-server/config`     | Update config               |
| `POST /api/settings/media-server/test`        | Test connection             |
| `GET /api/settings/libraries`                 | Get library configurations  |
| `POST /api/settings/libraries/sync`           | Sync from media server      |
| `PATCH /api/settings/libraries/:id`           | Enable/disable library      |
| `GET /api/settings/recommendations`           | Get algorithm config        |
| `PATCH /api/settings/recommendations/movies`  | Update movie config         |
| `PATCH /api/settings/recommendations/series`  | Update series config        |
| `GET /api/settings/embedding-model`           | Get embedding model         |
| `PATCH /api/settings/embedding-model`         | Set embedding model         |
| `GET /api/settings/text-generation-model`     | Get text gen model          |
| `PATCH /api/settings/text-generation-model`   | Set text gen model          |
| `GET /api/settings/top-picks`                 | Get Top Picks config        |
| `PATCH /api/settings/top-picks`               | Update Top Picks config     |
| `GET /api/settings/output-format`             | Get output format config    |
| `PATCH /api/settings/output-format`           | Update output format        |
| `GET /api/settings/ai-explanation`            | Get AI explanation config   |
| `PATCH /api/settings/ai-explanation`          | Update AI explanation       |
| `GET /api/settings/ai-explanation/user/:id`   | Get user override settings  |
| `PATCH /api/settings/ai-explanation/user/:id` | Update user override        |
| `GET /api/settings/library-titles`            | Get library title templates |
| `PATCH /api/settings/library-titles`          | Update title templates      |
| `GET /api/settings/ai-recs/output`            | Get AI recs output config   |
| `PATCH /api/settings/ai-recs/output`          | Update AI recs output       |
| `GET /api/settings/cost-inputs`               | Get cost estimation data    |
| `GET /api/settings/user/dislike-behavior`     | Get user's dislike behavior |
| `PATCH /api/settings/user/dislike-behavior`   | Update dislike behavior     |
| `GET /api/settings/trakt`                     | Get Trakt configuration     |
| `PATCH /api/settings/trakt`                   | Update Trakt configuration  |
| `GET /api/settings/chat-assistant-model`      | Get chat assistant model    |
| `PATCH /api/settings/chat-assistant-model`    | Set chat assistant model    |

---

## Jobs (Admin)

| Endpoint                               | Description               |
| -------------------------------------- | ------------------------- |
| `GET /api/jobs`                        | List all jobs with status |
| `GET /api/jobs/active`                 | Get all running jobs      |
| `POST /api/jobs/:name/run`             | Trigger a job             |
| `POST /api/jobs/:name/cancel`          | Cancel running job        |
| `GET /api/jobs/:name/config`           | Get job schedule config   |
| `PATCH /api/jobs/:name/config`         | Update job schedule       |
| `GET /api/jobs/:name/history`          | Get job run history       |
| `GET /api/jobs/progress/stream/:jobId` | SSE stream for progress   |
| `GET /api/jobs/scheduler/status`       | Get scheduler status      |

---

## Database (Admin)

| Endpoint                       | Description             |
| ------------------------------ | ----------------------- |
| `GET /api/admin/purge/stats`   | Get database statistics |
| `POST /api/admin/purge/movies` | Purge all movie data    |

