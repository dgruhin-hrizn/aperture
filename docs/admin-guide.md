# Admin Guide

This guide covers initial setup, ongoing operations, and administrative configuration for Aperture.

## Initial Setup Walkthrough

After starting Aperture for the first time, log in with your **Emby/Jellyfin admin account** and follow these steps:

### Step 1: Configure Media Server Connection

Navigate to **Admin → Settings → Media Server**

1. Select your server type (Emby or Jellyfin)
2. Enter your media server URL (e.g., `http://192.168.1.100:8096`)
3. Enter your admin API key
   - **Emby**: Dashboard → API Keys → New API Key
   - **Jellyfin**: Dashboard → API Keys → Add
4. Click **Test Connection** to verify
5. Save the configuration

### Step 2: Select Libraries to Sync

Navigate to **Admin → Settings → Libraries**

1. Click **Sync Libraries** to fetch available libraries from your media server
2. Toggle **ON** for each movie and TV library you want Aperture to analyze
3. Libraries that are disabled won't be synced or included in recommendations

### Step 3: Run Initial Data Sync

Navigate to **Admin → Jobs**

Run these jobs in order (wait for each to complete):

1. **sync-movies** — Imports all movies from enabled libraries
2. **sync-series** — Imports all TV series and episodes
3. **generate-movie-embeddings** — Creates AI embeddings for movies (requires OpenAI API key)
4. **generate-series-embeddings** — Creates AI embeddings for series

> **Note**: Embedding generation can take time for large libraries. Progress is shown in real-time.

### Step 4: Enable Users for AI Recommendations

Navigate to **Admin → Users**

1. You'll see all users from your media server
2. For each user you want to receive recommendations:
   - Toggle **Movies** to enable movie recommendations
   - Toggle **Series** to enable TV series recommendations
3. Users must have watch history for recommendations to work

### Step 5: Sync Watch History

Navigate to **Admin → Jobs**

1. Run **sync-movie-watch-history** — Imports what movies users have watched
2. Run **sync-series-watch-history** — Imports what episodes users have watched

### Step 6: Generate Recommendations

Navigate to **Admin → Jobs**

1. Run **generate-movie-recommendations** — Creates personalized movie picks for all enabled users
2. Run **generate-series-recommendations** — Creates personalized series picks
3. Run **sync-movie-libraries** — Creates the virtual movie library in your media server
4. Run **sync-series-libraries** — Creates the virtual series library

After this, users will see a new "AI Picks" library in their media server!

---

## Managing Jobs

### Job Scheduling

Each job can be scheduled to run automatically:

1. Go to **Admin → Jobs**
2. Click the **gear icon** on any job
3. Choose a schedule type:
   - **Daily** — Run at a specific time each day
   - **Weekly** — Run on a specific day and time
   - **Interval** — Run every N hours (1, 2, 3, 4, 6, 8, or 12)
   - **Manual** — Only run when you trigger it

**Recommended schedule:**

- Sync jobs: Daily at 3 AM
- Recommendation jobs: Daily at 4 AM
- STRM jobs: Daily at 5 AM

### Monitoring Jobs

- **Real-time progress**: Watch jobs as they run with live progress bars
- **Job history**: View past runs, duration, and any errors
- **Cancel**: Stop a running job if needed

### When to Run Manual Jobs

- **generate-movie-embeddings** — After adding many new movies, or after changing embedding model
- **full-sync-movie-watch-history** — If watch history seems out of sync
- **rebuild-movie-recommendations** — After major algorithm changes

---

## Algorithm Tuning

Navigate to **Admin → Settings → AI Recommendations → Advanced Settings**

Adjust these weights separately for movies and series:

| Weight         | Description                                        | Default |
| -------------- | -------------------------------------------------- | ------- |
| **Similarity** | How closely recommendations match user taste       | 0.5     |
| **Novelty**    | Preference for content outside user's usual genres | 0.3     |
| **Rating**     | Weight given to community ratings                  | 0.2     |
| **Diversity**  | Variety in the recommendation list                 | 0.3     |

Other settings:

- **Recommendations per user** — How many titles to recommend (default: 50)
- **Recent watch limit** — How many recent watches to analyze for taste (default: 100)

---

## Top Picks Configuration

Navigate to **Admin → Settings → Top Picks**

Top Picks shows globally popular content based on aggregated watch data across all users.

### Content Selection

- **Enable/Disable** — Turn Top Picks on or off
- **Time Window** — How far back to analyze (e.g., 30 days)
- **Movies Count** — How many movies to include
- **Series Count** — How many series to include
- **Minimum Viewers** — Require at least N unique viewers for inclusion

### Popularity Algorithm

Configure how popularity is calculated by weighting:

- **Unique Viewers** — Different users who watched the content
- **Play Count** — Total plays across all users
- **Completion Rate** — How often users finish what they start

### Output Configuration

Choose how Top Picks appear in your media server (independently for movies and series):

| Output Type    | Description                                                   |
| -------------- | ------------------------------------------------------------- |
| **Library**    | Virtual folder with STRM/symlink files (traditional approach) |
| **Collection** | Box Set in your media server (appears in Collections view)    |
| **Playlist**   | Server playlist (appears in Playlists section)                |

You can enable any combination — for example, create both a Library AND a Collection for movies.

**Library File Type**: When using Libraries, you can choose between STRM files (default) or Symlinks for each content type independently.

**Collection/Playlist Names**: Customize the display names (defaults: "Top Picks - Movies", "Top Picks - Series"). Collections are automatically sorted to appear at the top of your collections list.

**Rank Ordering**: Items in collections have their sort names set to maintain rank order (e.g., "01 - Movie Title"). When viewing the collection sorted by name, items appear in popularity order.

Click **Refresh Top Picks Now** to manually update.

---

## Model Selection

### Embedding Model

Navigate to **Admin → Settings → Embedding Model**

| Model                  | Quality | Cost            | Best For        |
| ---------------------- | ------- | --------------- | --------------- |
| text-embedding-3-small | Good    | $0.02/1M tokens | Most users      |
| text-embedding-3-large | Best    | $0.13/1M tokens | Premium quality |

> **Warning**: Changing models requires regenerating all embeddings.

### Text Generation Model

Navigate to **Admin → Settings → Text Model**

Used for taste profiles and recommendation explanations:

| Model       | Quality     | Cost   |
| ----------- | ----------- | ------ |
| GPT-4o Mini | Recommended | Low    |
| GPT-5 Nano  | Budget      | Lowest |
| GPT-5 Mini  | Premium     | Higher |

---

## AI Explanation Settings

Navigate to **Admin → Settings → AI Recommendations**

Control whether AI-generated explanations appear in recommendation NFO files:

- **Global Toggle** — Enable/disable AI explanations for all users
- **User Override Permission** — When enabled, admins can grant specific users the ability to toggle their own preference
- **Per-User Settings** — On each user's detail page, admins can allow that user to override the global setting

The AI explanation appears in the NFO plot field, explaining why each title was recommended.

---

## Library Title Templates

Navigate to **Admin → Settings → AI Recommendations**

Configure default library names using merge tags:

| Merge Tag      | Description               | Example Output          |
| -------------- | ------------------------- | ----------------------- |
| `{{username}}` | User's display name       | "John"                  |
| `{{type}}`     | Media type                | "Movies" or "TV Series" |
| `{{count}}`    | Number of recommendations | "50"                    |
| `{{date}}`     | Date of last run          | "2025-01-06"            |

**Example templates:**

- `{{username}}'s AI Picks - {{type}}` → "John's AI Picks - Movies"
- `AI Recommendations for {{username}}` → "AI Recommendations for John"

Users can override these with custom names in their own settings.

---

## Output Format Settings

Navigate to **Admin → Settings → AI Recommendations**

Configure how virtual libraries are created, separately for Movies and Series:

| Format       | Description                                              | Use When                                  |
| ------------ | -------------------------------------------------------- | ----------------------------------------- |
| **STRM**     | Small text files containing streaming URLs or file paths | Default; works in all setups              |
| **Symlinks** | Symbolic links pointing to original media files          | Shared filesystem; preserves full quality |

**STRM files** are universally compatible and work even when Aperture runs on a different machine than your media server.

**Symlinks** require that both Aperture and your media server can access the same filesystem paths.

**Default Settings:**

- **Movies**: STRM files (default)
- **Series**: Symlinks (default)

> **Note**: Top Picks has its own separate STRM/Symlinks toggles in **Admin → Settings → Top Picks → Output Configuration**.

---

## Watch History Management

Navigate to **Admin → Users → [User] → Settings**

Control whether users can mark items as unwatched:

- **Enable Watch History Management** — Toggle to allow this user to remove items from their watch history
- When enabled, users see "Mark Unwatched" buttons on movies, episodes, seasons, and series
- Changes sync to both Aperture's database and the media server

---

## Database Management

Navigate to **Admin → Settings → Database**

- **View Stats** — See counts of movies, series, embeddings, etc.
- **Purge Movies** — Delete all movie data (requires confirmation)

Use purge if you need to start fresh or switch media servers.

---

## Recommended Workflow

For best results, schedule jobs to run automatically:

| Time    | Jobs                                                                              |
| ------- | --------------------------------------------------------------------------------- |
| 3:00 AM | sync-movies, sync-series, sync-movie-watch-history, sync-series-watch-history     |
| 4:00 AM | generate-movie-recommendations, generate-series-recommendations                   |
| 5:00 AM | sync-movie-libraries, sync-series-libraries                                       |
| 6:00 AM | refresh-top-picks                                                                 |

This ensures users wake up to fresh recommendations based on yesterday's viewing.

