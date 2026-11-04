# Architecture

Technical overview of Aperture's design, recommendation pipeline, and project structure.

## Table of Contents

- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [How It Works](#how-it-works)
  - [Recommendation Pipeline](#recommendation-pipeline)
  - [Vector Similarity](#vector-similarity)
  - [Rating System](#rating-system)
  - [Top Picks Algorithm](#top-picks-algorithm)
- [AI Assistant (Encore)](#ai-assistant-encore)
  - [Architecture](#architecture)
  - [Tools](#tools)
  - [Conversation Persistence](#conversation-persistence)
- [Background Jobs](#background-jobs)
  - [Movie Jobs](#movie-jobs)
  - [Series Jobs](#series-jobs)
  - [Global Jobs](#global-jobs)
  - [Job Scheduling](#job-scheduling)
- [Database Schema](#database-schema)

---

## Project Structure

```
aperture/
├── apps/
│   ├── api/          # Fastify API server
│   │   └── src/routes/
│   │       └── assistant/  # AI Assistant (Encore)
│   │           ├── handlers/   # Chat, conversations, suggestions
│   │           ├── prompts/    # Identity, context, rules
│   │           ├── tools/      # Search, content, recommendations, etc.
│   │           └── schemas/    # Tool UI output schemas
│   └── web/          # React + Vite + MUI frontend
│       └── src/components/
│           ├── AssistantModal.tsx  # Main assistant UI
│           └── assistant/          # Thread, messages, tool renderers
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

#### Preference scoring database reads

Movie and series recommendation runs load genre weights and custom interests once per scoring pass.
Franchise detection uses the candidate title and, for movies, the collection name returned by the
candidate query. Each distinct franchise preference is read once per pass, including neutral results.
These caches belong to a single user and media type and expire when that scoring pass ends.

When the user has custom interests with embeddings, a single batch query loads the active model's
vectors for the first 100 scored candidates. Users without embedded interests skip this vector query.
The boost formulas and the pre-boost top-100 selection remain the same.

Run the focused regression checks with
`pnpm --filter @aperture/core exec node --import tsx --test src/recommender/shared/preferenceBoosts.test.ts`.

A read-only comparison against the sample account's saved Unraid data on November 3, 2026 sampled 1,000 movies
and 1,000 series with active-model embeddings, ordered by item ID. It compared the previous
per-candidate lookups with the shared-preference path in a repeatable-read transaction.

| Preference-scoring sample | Previous queries | Optimized queries | Previous elapsed | Optimized elapsed |
| --- | --- | --- | --- | --- |
| 1,000 movies | 2,618 | 204 | 1,037 ms | 55 ms |
| 1,000 series | 2,459 | 26 | 870 ms | 10 ms |

All sampled franchise, genre, and interest multipliers matched. The first 100 vectors for each media
type also matched the individual embedding lookups. The sample account had no custom interests, so his optimized
scoring path skipped candidate embedding reads. Separate batch-vector checks covered those reads.
These timings cover this scoring step from the development machine to Unraid. Complete job
timing still includes media sync, candidate retrieval, selection, explanations, and publication.

#### Query and ranking review

Watched-title expansion materializes the eligible watch history once and reuses its title identities
to find duplicate library copies. Movie expansion uses TMDb and IMDb IDs. TV expansion also uses
TVDb IDs. All returned IDs matched the previous queries for 41 accounts with history during a
read-only, repeatable-read check on November 3, 2026.

| Watched expansion across 41 accounts | Previous elapsed | Optimized elapsed |
| --- | --- | --- |
| Movies | 1,347 ms | 473 ms |
| TV | 2,623 ms | 746 ms |

For the largest history, `EXPLAIN (ANALYZE, BUFFERS)` measured TV execution at 367.661 ms before
and 68.050 ms after the rewrite, with shared buffer hits falling from 69,835 to 24,990. These are
individual measurements from this server. A second pass using the implementation returned identical
IDs again, measuring 889 → 201 ms for movies and 2,330 → 691 ms for TV across the same 41 accounts.
Read-only synthetic cases also checked duplicate external IDs, the 5% boundary, favorite-only rows,
invalid runtimes, and account isolation. The existing index for selected recommendation rows
also supported the sample account's latest movie-picks lookup in 0.236 ms during the review.

Other changes reuse community ratings returned by the TV candidate query, reuse the already-loaded
movie ratings when constructing dislike exclusions, and batch the legacy movie-profile embedding
reads. Weighted embedding averaging computes the weight total once, making that calculation linear
in the number of history items.

Positive-history inputs consistently require a completed play or an explicit favorite in profile
building, genre and franchise detection, and taste analysis. Partial-play exclusion continues to use
the separate 5% threshold. Movie history retrieval selects movies explicitly, and both fallback
history paths respect the user's excluded analysis libraries.

Both media types read `user_preferences.dislike_behavior`. TV applies explicit dislike exclusions
even when watched recommendations are enabled. Penalize mode subtracts 80% of the absolute score
from an explicitly disliked candidate before diversity selection. This reduces positive scores to
20% and also lowers negative scores.

The three base-score weights are divided by their total before preference adjustments. Diversity
is then blended once during selection. With the default 40/20/20/20 weights and neutral preference
adjustments, the final contributions are 40% similarity, 20% discovery, 20% quality, and 20% variety.
Custom diversity uses the normalized effective setting. TV candidates are sorted by base score
before selecting the first 100 for custom-interest scoring.

Custom-interest embeddings require the active provider and model identity. New interests save that
full identity. Older OpenAI interests with the matching bare model name remain compatible. Interests
from other models remain stored and contribute after recreation with the current model.

#### Browsing and diversity query improvements

Movie and TV browsing group distinct viewer counts once for each query. The aggregation joins
against the titles matching the other filters before grouping. This also keeps narrow title searches
targeted. Both the total-count query and the paged query use this form when viewer bounds are
present. An absent aggregate row contributes zero viewers, including for the `maxWatchers=0` filter.

TV diversity analysis first materializes distinct watched series IDs, then joins their embeddings.
The calculation uses distinct vectors, the active model, library exclusions, and a 100-vector sample. The sample's mean distance matched the previous query for 41 account histories
in a read-only comparison. The automatic diversity adjustment calls this statistic directly, avoiding
genre distribution, decade distribution, and viewing-pattern queries when only diversity is needed.

Additional read-only measurements on November 3, 2026 produced these examples.

| Query | Previous execution | Optimized execution |
| --- | --- | --- |
| Movie IDs with 1–5 viewers across the catalog | 81.637 ms | 19.891 ms |
| TV IDs with 1–5 viewers across the catalog | 699.065 ms | 146.294 ms |
| Movie IDs with the same viewer bounds and a narrow title search | 0.150 ms | 0.153 ms |
| TV IDs with the same viewer bounds and a narrow title search | 0.483 ms | 0.319 ms |
| the sample account's TV diversity statistic | 1,013.439 ms | 87.165 ms |

SQL execution was measured with `EXPLAIN (ANALYZE, BUFFERS)`. Catalog measurements retrieve the
matching IDs. They cover an individual SQL query within a browsing request. The diversity rewrite
reduced shared buffer hits from 1,382,556 to 51,968 in that sample. The complete automatic-diversity
path uses five database reads in place of eight, and a separate sample-account check measured TV adjustment at
112 ms with the same resulting weight. Timing depends on load and cache state.

Fourteen in-process requests through the movie and TV list handlers checked counts, pagination,
zero-viewer titles, contradictory bounds, invalid bounds, and combined filters against the original
counting approach using Unraid's read-only database connection.

All-user movie and TV history syncs load catalog identity maps once per job and reuse them across
accounts. Individual-user syncs load a fresh map. History, exclusions, progress, and favorites are
queried per account. Targeted identity lookups handle unresolved items imported while a job runs.
During a shared full sync, history IDs outside the known catalog are deferred for reconciliation on
the next pass, protecting entries imported concurrently.

This installation had 109,657 catalog episodes and 41 eligible sync accounts during review.
Loading their common mapping once reduces the base episode-mapping rows loaded from 4,495,937
to 109,657 per all-user pass. Targeted lookups add reads when newly imported titles need resolving.

Automatic genre and franchise updates use parameterized array upserts in batches of up to 1,000
unique keys. Repeated keys start another batch so input order and affected-row counts preserve the
previous sequential behavior. Manual genre weights are protected. Manual franchise scores are
protected while their engagement metadata follows the existing update rules. Explicit reset mode
clears the requested scope and inserts replacements in one transaction. A transaction-scoped
advisory lock serializes concurrent batches and resets for the same user and preference table.

The additional integration check runs against an isolated PostgreSQL database with a temporary
schema built from migration 0085. It covers overrides, clamping, duplicate keys, returned counts,
resets by media type, empty resets, batch boundaries, rollback after a later batch fails, and
concurrent resets. Run the full suite from `packages/core` with an isolated test database.

```sh
APERTURE_TEST_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/aperture_test \
  node --import tsx --test $(rg --files src -g '*.test.ts')
```

The database must be local and its name must begin with `aperture_test`. The preference integration
check skips when this variable is absent. Other regression checks mock user syncs through their
normal all-user and individual-user entry points to cover shared loads, per-user exclusions,
provider and external identity fallback, duplicate progress merging, fresh jobs, and concurrent
imports. Production checks use read-only connections.

#### Recommendation quality and evaluation

The ranking combines viewing-derived similarity, engagement, explicit preferences, and diversity.
Regression checks verify the weight arithmetic and that closer matches win in similarity-only
ranking, dislikes lower scores, TV generation honors the saved exclusion mode, and stronger history
signals influence the normalized taste vector. These checks establish behavior and mathematical
consistency. Read-only profile builds for the sample account produced finite, unit-length 3,072-dimensional movie
and TV vectors, and his movie-history sample contained only eligible movie rows. Recommendation
quality still needs evaluation against subsequent viewing and feedback.

Stored profiles follow their configured refresh interval and lock. Corrected history filtering takes
effect when those profiles are next rebuilt. The recent-history limit affects discovery scoring and
fallback profiles, while persistent profiles use the eligible full history. A single averaged profile
can blend distinct interests, and custom-interest reranking currently covers the first 100 scored
candidates. Explicit dislike exclusions use item IDs, so alternate library copies can need the same
feedback separately. New accounts need viewing history to produce a profile.

Future relevance evaluation should preserve the recommendations and eligible catalog as they existed
at selection time, then measure later plays, completions, positive ratings, and repeated-title exposure.
Compare with community-rating and previous-ranking baselines across users with different history
sizes. A saved-history snapshot contains current favorites, ratings, and last-play timestamps, so a
retrospective split alone cannot reconstruct every preference available at the original decision.

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

## AI Assistant (Encore)

Encore is a conversational AI assistant that helps users discover content through natural language interaction.

### Architecture

The assistant is built using the AI SDK (Vercel) with OpenAI models:

```
apps/api/src/routes/assistant/
├── handlers/
│   ├── chat.ts           # Streaming chat endpoint
│   ├── conversations.ts  # CRUD for conversation history
│   └── suggestions.ts    # Personalized prompt suggestions
├── prompts/
│   ├── identity.ts       # Assistant persona definition
│   ├── context/          # User and admin context builders
│   └── rules/            # Behavior, formatting, antipattern rules
├── tools/
│   ├── search.ts         # searchContent, semanticSearch, findSimilarContent
│   ├── content.ts        # getContentDetails
│   ├── recommendations.ts # getMyRecommendations, getTopRated, getUnwatched
│   ├── history.ts        # getWatchHistory, getUserRatings
│   ├── library.ts        # getLibraryStats, getContentRankings, getAvailableGenres
│   ├── people.ts         # searchPeople, getTopStudios
│   └── help.ts           # getSystemHelp
├── schemas/              # Tool UI output schemas (content cards, etc.)
├── helpers/              # Media server URL building, OpenAI client
└── jobs/
    └── refreshSuggestions.ts  # Background job for personalized suggestions
```

**Frontend**: The assistant UI uses `@assistant-ui/react` with `@assistant-ui/react-ai-sdk` for streaming chat with tool result rendering.

### Tools

Tools are function calls the AI can make to retrieve data. Each tool returns structured data that the frontend renders as interactive cards:

| Category | Tools |
| -------- | ----- |
| **Search** | `searchContent` (filter-based), `semanticSearch` (AI embeddings), `findSimilarContent` |
| **Content** | `getContentDetails` with play links |
| **Recommendations** | `getMyRecommendations`, `getTopRated`, `getUnwatched` |
| **History** | `getWatchHistory`, `getUserRatings` |
| **Library** | `getLibraryStats`, `getContentRankings`, `getAvailableGenres` |
| **People** | `searchPeople` (actors/directors with filmography), `getTopStudios` |
| **Help** | `getSystemHelp` |

**Semantic Search**: Uses the same embedding model as recommendations. The AI generates a descriptive search query, embeds it, and finds similar content via pgvector.

**Similar Content**: Uses an AI-powered approach where GPT generates a specific description of what makes a title unique, then embeds that description to find truly similar content.

### Conversation Persistence

Conversations are stored in PostgreSQL:

- `assistant_conversations` — Conversation metadata (title, timestamps)
- `assistant_messages` — Individual messages with role, content, and tool invocations
- `assistant_suggestions` — Pre-generated personalized prompts per user

Messages include serialized tool invocations so historical conversations display with their original results.

---

## Background Jobs

### Movie Jobs

| Job                                  | Description                            | Schedule     |
| ------------------------------------ | -------------------------------------- | ------------ |
| `sync-movies`                        | Sync movies from media server          | Configurable |
| `generate-movie-embeddings`          | Generate AI embeddings                 | Configurable |
| `sync-movie-watch-history`           | Delta sync of watch history            | Configurable |
| `generate-movie-recommendations`     | Generate personalized picks            | Configurable |
| `full-reset-movie-recommendations`   | Delete all + rebuild (destructive)     | Manual only  |
| `sync-movie-libraries`               | Create movie libraries (STRM/symlinks) | Configurable |

### Series Jobs

| Job                                  | Description                             | Schedule     |
| ------------------------------------ | --------------------------------------- | ------------ |
| `sync-series`                        | Sync TV series and episodes             | Configurable |
| `generate-series-embeddings`         | Generate AI embeddings                  | Configurable |
| `sync-series-watch-history`          | Delta sync of watch history             | Configurable |
| `generate-series-recommendations`    | Generate personalized picks             | Configurable |
| `full-reset-series-recommendations`  | Delete all + rebuild (destructive)      | Manual only  |
| `sync-series-libraries`              | Create series libraries (STRM/symlinks) | Configurable |

### Global Jobs

| Job                          | Description                             | Schedule      |
| ---------------------------- | --------------------------------------- | ------------- |
| `refresh-top-picks`          | Refresh popularity-based libraries      | Daily at 6 AM |
| `sync-trakt-ratings`         | Sync ratings from Trakt.tv              | Every 6 hours |
| `refresh-assistant-suggestions` | Regenerate personalized chat prompts | Daily at 7 AM |

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
- `assistant_conversations` — AI Assistant chat sessions
- `assistant_messages` — Messages within conversations (with tool invocations)
- `assistant_suggestions` — Personalized conversation starter prompts

