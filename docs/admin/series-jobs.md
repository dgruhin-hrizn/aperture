# Series Jobs

Background jobs for syncing, processing, and building TV series libraries.

![Admin Jobs](../images/admin/admin-jobs.png)

## Job List

| Job | Purpose |
|-----|---------|
| **sync-series** | Import series from media server |
| **sync-series-watch-history** | Import what users have watched |
| **generate-series-embeddings** | Create AI vectors |
| **generate-series-recommendations** | Create personalized picks |
| **sync-series-libraries** | Build virtual libraries |

---

## sync-series

Import TV series from your media server.

### What It Does

1. Connects to Emby/Jellyfin
2. Fetches all series from enabled libraries
3. Imports series metadata
4. Imports all seasons and episodes
5. Downloads poster URLs
6. Updates existing records

### Output

- New series added
- New episodes added
- Existing entries updated
- Removed series/episodes marked

### When to Run

- **Scheduled:** Daily
- **Manual:** After adding new series
- **Prerequisites:** None

### Typical Duration

| Library Size | Duration |
|--------------|----------|
| Small (<200 series) | 2-5 min |
| Medium | 5-15 min |
| Large (500+ series) | 15-45 min |

Series sync is slower than movies due to episode count.

---

## sync-series-watch-history

Import what episodes users have watched.

### What It Does

1. Queries media server for each enabled user
2. Fetches watch status for all episodes
3. Records watched episodes with timestamps
4. Tracks partial plays (progress percentage)
5. Calculates series-level progress

### Episode-Level Tracking

| Data | Description |
|------|-------------|
| **Watched** | Boolean completion |
| **Progress** | Percentage if partially watched |
| **Play Count** | Number of times watched |
| **Last Watched** | Most recent play date |

### When to Run

- **Scheduled:** Every 2 hours
- **Manual:** If history seems out of sync
- **Prerequisites:** sync-series

---

## generate-series-embeddings

Create AI vectors for similarity matching.

### What It Does

1. Identifies series without embeddings
2. Constructs text from series metadata
3. Sends to AI provider for embedding
4. Stores vectors in database

### What Gets Embedded

Series-level data:
- Title and year
- Overview/description
- Genres
- Keywords (if available)
- Network

Note: Episodes are not individually embedded.

### When to Run

- **Scheduled:** Daily at 3 AM
- **Manual:** After adding many new series
- **Prerequisites:** sync-series, AI provider configured

### Typical Duration

| Library Size | Duration (OpenAI) | Duration (Ollama) |
|--------------|-------------------|-------------------|
| 200 series | 3-8 min | 10-20 min |
| 500 series | 8-20 min | 30-60 min |
| 1000+ series | 20-45 min | 1-2 hours |

---

## generate-series-recommendations

Create personalized picks for each user.

### What It Does

1. For each enabled user:
2. Analyzes episode watch history
3. Builds series taste profile
4. Excludes series already being watched
5. Scores all unwatched series
6. Ranks by score
7. Generates explanations (if enabled)
8. Stores recommendations

### Series-Specific Logic

| Factor | Handling |
|--------|----------|
| **Partially watched** | Excluded from recommendations |
| **Completed series** | Excluded (unless ended) |
| **Currently watching** | Excluded |
| **Ended series** | Included in pool |

### When to Run

- **Scheduled:** Weekly
- **Manual:** After algorithm changes
- **Prerequisites:** embeddings, watch history

---

## sync-series-libraries

Build virtual libraries in media server.

### What It Does

1. For each enabled user:
2. Creates output directory structure
3. Generates series folders
4. Creates Season 00 placeholder (for Emby sorting)
5. Generates STRM or symlink files for each season/episode
6. Creates NFO metadata files
7. Triggers media server scan

### Output Structure

```
/aperture-libraries/users/john/ai-series/
├── Breaking Bad (2008)/
│   ├── Season 00/
│   │   └── breaking-bad-placeholder.strm  (sorting workaround)
│   ├── Season 1/
│   │   ├── Breaking Bad - S01E01.strm
│   │   └── ...
│   └── tvshow.nfo
├── The Wire (2002)/
│   └── ...
```

### Emby Home Row Fix

The Season 00 placeholder ensures series appear in correct rank order on Emby home rows. See [technical details](#emby-home-row-sorting).

### When to Run

- **Scheduled:** After recommendations job
- **Manual:** After recommendation generation
- **Prerequisites:** generate-series-recommendations

---

## Emby Home Row Sorting

### The Problem

Emby sorts series on home rows by the most recent episode's `dateadded`. This causes recommendations to appear in random order.

### The Solution

Aperture creates a hidden Season 00 with a placeholder episode. This placeholder has a future `dateadded` based on rank:
- Rank 1: 2125-01-01
- Rank 2: 2124-12-31
- etc.

### Technical Details

- Season 00 folder contains minimal STRM and NFO
- Placeholder is auto-marked as watched
- Hidden from Continue Watching
- NFO explains its purpose

### Jellyfin

Jellyfin handles sorting differently and doesn't need this workaround, but the placeholder doesn't cause issues.

---

## Job Order

For initial setup or full refresh:

```
1. sync-series
2. generate-series-embeddings
3. sync-series-watch-history
4. generate-series-recommendations
5. sync-series-libraries
```

---

## Troubleshooting

### Sync Series Taking Too Long

- Large libraries with many episodes take time
- Consider running overnight
- Check for stuck episodes

### Missing Episodes

- Verify episode exists in media server
- Check if episode is in enabled library
- Re-run sync job

### Recommendations Include Currently Watching

- Ensure watch history is synced
- Check episode tracking is working
- Verify series status in database

### Season 00 Visible to Users

- This is expected for Emby sorting
- Placeholder should be auto-watched
- Users won't see in Continue Watching

---

**Previous:** [Movie Jobs](movie-jobs.md) | **Next:** [Global Jobs](global-jobs.md)
