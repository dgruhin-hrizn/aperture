# Movie Jobs

Background jobs for syncing, processing, and building movie libraries.

![Admin Jobs](../images/admin/admin-jobs.png)

## Job List

| Job | Purpose |
|-----|---------|
| **sync-movies** | Import movies from media server |
| **sync-movie-watch-history** | Import what users have watched |
| **generate-movie-embeddings** | Create AI vectors |
| **generate-movie-recommendations** | Create personalized picks |
| **full-reset-movie-recommendations** | Delete all + rebuild (manual only) |
| **sync-movie-libraries** | Build virtual libraries |

---

## sync-movies

Import movies from your media server.

### What It Does

1. Connects to Emby/Jellyfin
2. Fetches all movies from enabled libraries
3. Imports metadata (title, year, genres, etc.)
4. Downloads poster URLs
5. Updates existing records

### Output

- New movies added
- Existing movies updated
- Removed movies marked

### When to Run

- **Scheduled:** Daily
- **Manual:** After adding new movies
- **Prerequisites:** None

### Typical Duration

| Library Size | Duration |
|--------------|----------|
| Small (<500) | 1-3 min |
| Medium | 3-10 min |
| Large (2000+) | 10-30 min |

---

## sync-movie-watch-history

Import what users have watched.

### What It Does

1. Queries media server for each enabled user
2. Fetches watch status for all movies
3. Records watched movies with timestamps
4. Calculates play counts

### Variants

| Variant | Description |
|---------|-------------|
| **Regular** | Incremental update since last sync |
| **Full** | Complete resync of all history |

### When to Run

- **Scheduled:** Every 2 hours
- **Manual:** If history seems out of sync
- **Prerequisites:** sync-movies

---

## generate-movie-embeddings

Create AI vectors for similarity matching.

### What It Does

1. Identifies movies without embeddings
2. Constructs text from metadata
3. Sends to AI provider for embedding
4. Stores vectors in database

### What Gets Embedded

- Title and year
- Overview/description
- Genres
- Keywords (if available)

### API Usage

| Provider | Calls Per Movie |
|----------|-----------------|
| OpenAI | 1 |
| Ollama | 1 |

### When to Run

- **Scheduled:** Daily at 3 AM
- **Manual:** After adding many new movies
- **Prerequisites:** sync-movies, AI provider configured

### Typical Duration

| Library Size | Duration (OpenAI) | Duration (Ollama) |
|--------------|-------------------|-------------------|
| 500 | 5-10 min | 15-30 min |
| 2000 | 20-45 min | 1-2 hours |
| 5000+ | 1-2 hours | 4+ hours |

---

## generate-movie-recommendations

Create personalized picks for each user.

### What It Does

1. For each enabled user:
2. Analyzes watch history
3. Builds taste profile
4. Scores all unwatched movies
5. Ranks by score
6. Generates explanations (if enabled)
7. Stores recommendations

### Configuration

Uses settings from Admin → Settings → AI Recommendations:
- Algorithm weights
- Recommendations per user
- Recent watch limit

### When to Run

- **Scheduled:** Weekly
- **Manual:** After algorithm changes
- **Prerequisites:** embeddings, watch history

### Typical Duration

| Users | Duration |
|-------|----------|
| 1-5 | 2-10 min |
| 10+ | 10-30 min |

---

## full-reset-movie-recommendations

**⚠️ Manual Only** - This job cannot be scheduled and must be run manually.

Complete recommendation reset: **deletes ALL existing movie recommendations** for all users, then rebuilds from scratch.

### Difference from Regular

| Generate (Regular) | Full Reset |
|---------|---------|
| Updates existing | **Deletes all first** |
| Incremental | Full regeneration |
| Faster | Slower |
| Can be scheduled | **Manual only** |

### When to Use

- After major algorithm changes
- After changing embedding model
- If recommendations seem corrupted
- After significant library changes

### Warning

⚠️ **Destructive operation**: Removes ALL existing movie recommendations before rebuilding. Users will have no recommendations until the job completes.

---

## sync-movie-libraries

Build virtual libraries in media server.

### What It Does

1. For each enabled user:
2. Creates output directory
3. Generates STRM or symlink files
4. Creates NFO metadata files
5. Organizes by rank
6. Triggers media server scan (if supported)

### Output

```
/aperture-libraries/users/john/ai-movies/
├── 01 - Inception (2010)/
│   ├── Inception (2010).strm
│   └── Inception (2010).nfo
├── 02 - Interstellar (2014)/
│   └── ...
```

### When to Run

- **Scheduled:** After recommendations job
- **Manual:** After recommendation generation
- **Prerequisites:** generate-movie-recommendations

### Typical Duration

| Users × Recs | Duration |
|--------------|----------|
| 5 × 50 | 1-3 min |
| 20 × 50 | 3-10 min |

---

## Job Order

For initial setup or full refresh:

```
1. sync-movies
2. generate-movie-embeddings
3. sync-movie-watch-history
4. generate-movie-recommendations
5. sync-movie-libraries
```

Each job depends on the previous completing successfully.

---

## Troubleshooting

### Sync Movies Fails

- Check media server connection
- Verify libraries are enabled
- Review API key permissions

### Embeddings Slow/Failing

- Check AI provider status
- Verify API key
- Look for rate limit errors
- Consider running overnight

### No Recommendations

- Verify user is enabled
- Check watch history exists
- Confirm embeddings generated
- Review algorithm settings

### Libraries Not Appearing

- Check path configuration
- Verify output directory writable
- Trigger media server library scan
- Review job logs

---

**Previous:** [Job Scheduling](job-scheduling.md) | **Next:** [Series Jobs](series-jobs.md)
