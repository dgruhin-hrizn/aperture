# Admin Guide

This guide covers initial setup, ongoing operations, and administrative configuration for Aperture.

## Table of Contents

- [First-Time Setup Wizard](#first-time-setup-wizard)
- [Post-Setup Configuration](#post-setup-configuration)
  - [Step 1: Select Libraries](#step-1-select-libraries-to-sync)
  - [Step 2: Run Initial Sync](#step-2-run-initial-data-sync)
  - [Step 3: Enable Users](#step-3-enable-users-for-ai-recommendations)
  - [Step 4: Sync Watch History](#step-4-sync-watch-history)
  - [Step 5: Generate Recommendations](#step-5-generate-recommendations)
- [Managing Jobs](#managing-jobs)
  - [Job Scheduling](#job-scheduling)
  - [Monitoring Jobs](#monitoring-jobs)
  - [When to Run Manual Jobs](#when-to-run-manual-jobs)
- [Algorithm Tuning](#algorithm-tuning)
- [Top Picks Configuration](#top-picks-configuration)
- [Model Selection](#model-selection)
  - [Embedding Model](#embedding-model)
  - [Text Generation Model](#text-generation-model)
  - [Chat Assistant Model](#chat-assistant-model)
- [AI Explanation Settings](#ai-explanation-settings)
- [Library Title Templates](#library-title-templates)
- [Output Format Settings](#output-format-settings)
- [File Locations Configuration](#file-locations-configuration)
- [Watch History Management](#watch-history-management)
- [API Error Alerts](#api-error-alerts)
- [Database Management](#database-management)
- [Library Image Management](#library-image-management)
- [Emby Home Row Sorting (Series)](#emby-home-row-sorting-series)
- [Backup & Restore](#backup--restore)
- [Recommended Workflow](#recommended-workflow)

---

## First-Time Setup Wizard

When you first access Aperture, you'll be guided through an 11-step setup wizard:

### Step 1: Restore (Optional)

If you have an existing backup, you can restore it here:
- Upload a backup file
- Or select from available backups in the `/backups` volume

### Step 2: Media Server Connection

Configure your Emby or Jellyfin server:

1. Select your server type (Emby or Jellyfin)
2. Enter your media server URL (e.g., `http://192.168.1.100:8096`)
3. Enter your admin API key:
   - **Emby**: Dashboard → API Keys → New API Key
   - **Jellyfin**: Dashboard → API Keys → Add
4. Click **Test Connection** to verify
5. Save the configuration

### Step 3: Source Libraries

Select which libraries to include in recommendations:
- Toggle on movie and TV libraries you want Aperture to analyze
- Disabled libraries won't be synced

### Step 4: File Locations

Configure path mappings between Aperture and your media server:

- **Auto-Detect Paths** — Click to automatically discover the correct paths by comparing how your media server and Aperture see the same files
- **Aperture Libraries Path** — Where your media server sees Aperture's output folder
- **Media Server Path Prefix** — Base path where your media server sees your media files
- **Skip** — Use defaults (`/mnt/ApertureLibraries/`, `/mnt/`) if you have a standard setup

This step is critical for symlinks to work. If you're unsure, try auto-detection first.

### Step 5: AI Recommendations

Configure library naming and cover images:
- Set default library name templates
- Upload custom banner images (optional)

### Step 6: Validate

Verify output format configuration:
- **Output Format** — Choose symlinks (recommended) or STRM files
- Review the configured paths from the previous step

### Step 7: Users

Select which users receive personalized recommendations:
- Toggle movies and/or series for each user
- Users need watch history for recommendations to work

### Step 8: Top Picks (Optional)

Configure global trending content:
- Enable/disable Top Picks
- Set output modes (Library, Collection, Playlist)
- Configure popularity algorithm

### Step 9: OpenAI Configuration

Configure your OpenAI API key:

1. Enter your OpenAI API key (get one from [platform.openai.com](https://platform.openai.com))
2. Click **Test Key** to verify
3. Click **Save & Continue** or **Skip** to proceed

> **Note**: You can always configure OpenAI later in Admin → Settings → AI.

### Step 10: Initial Sync

Run first-time sync jobs with real-time progress:
- All required jobs run automatically
- You can re-run individual jobs if needed
- View logs and progress in real-time

### Step 11: Complete

Review what was created:
- Libraries created in your media server
- Default job schedules (configurable in Admin → Jobs)
- Next steps and additional features

---

## Post-Setup Configuration

After completing the setup wizard and logging in, follow these steps to get recommendations working:

### Step 1: Select Libraries to Sync

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

**Default schedules:**

| Job | Default Schedule |
|-----|------------------|
| Database Backup | Daily at 1 AM |
| Library Scan | Daily at 2 AM |
| Watch History | Every 2 hours |
| Embeddings | Daily at 3 AM |
| AI Recommendations | Weekly on Sunday at 4 AM |
| Library Sync | Weekly on Sunday at 5 AM |
| Top Picks | Daily at 5 AM |
| Metadata Enrichment | Every 6 hours |

All schedules can be customized in **Admin → Jobs**.

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

Top Picks shows globally popular content. You can base this on your server's watch data, external MDBList rankings, or a hybrid of both.

### Popularity Source

Choose where popularity rankings come from (configured separately for Movies and Series):

| Source      | Description                                                                 |
| ----------- | --------------------------------------------------------------------------- |
| **Local**   | Based on your server's watch history (unique viewers, play counts, completion) |
| **MDBList** | Use rankings from a public or private MDBList list                          |
| **Hybrid**  | Combine local watch data with MDBList rankings (configurable weights)       |

### Local Mode Settings

When using **Local** as the popularity source:

- **Time Window** — How far back to analyze watch history (e.g., 30 days)
- **Minimum Viewers** — Require at least N unique viewers for inclusion
- **Count** — How many items to include in Top Picks

**Scoring Weights** (should sum to 1.0):

| Weight              | Description                                    | Default |
| ------------------- | ---------------------------------------------- | ------- |
| **Unique Viewers**  | Different users who watched the content        | 0.5     |
| **Play Count**      | Total plays across all users                   | 0.3     |
| **Completion Rate** | How often users finish what they start         | 0.2     |

### MDBList Mode Settings

When using **MDBList** as the popularity source:

1. **Select a List** — Browse popular lists, your own lists, search, or enter a list ID directly
2. **Choose Sort Order** — How items in the list should be ranked:

| Sort Option        | Description                                           |
| ------------------ | ----------------------------------------------------- |
| **MDBList Score**  | Combined score from all rating sources                |
| **Average Score**  | Simple average of all ratings                         |
| **IMDb Rating**    | Sort by IMDb user rating (10-point scale)             |
| **IMDb Votes**     | Sort by number of IMDb votes (most voted first)       |
| **IMDb Popularity**| Sort by IMDb popularity rank (most popular first)     |
| **TMDb Popularity**| Sort by TMDb popularity score                         |
| **Rotten Tomatoes**| Sort by Rotten Tomatoes critic score                  |
| **Metacritic**     | Sort by Metacritic score                              |

3. **Library Match Preview** — After selecting a list, Aperture shows:
   - Total items in the list
   - How many match your library
   - Which items are missing (expandable list)

> **Note**: Only items that exist in your library will appear in Top Picks. If a list has 100 items but you only have 30 in your library, your Top Picks will show those 30.

### Hybrid Mode Settings

When using **Hybrid** as the popularity source:

- Configure both Local settings (time window, minimum viewers) AND select an MDBList
- **Local Weight** — How much local watch data influences the final ranking (default: 0.5)
- **MDBList Weight** — How much the external list influences the ranking (default: 0.5)

Items are scored by combining normalized local popularity with their MDBList position.

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

### Chat Assistant Model

Navigate to **Admin → Settings → AI Recommendations → Advanced Settings → Chat Assistant Model**

The AI chat assistant (Encore) uses a separate model from text generation. More powerful models provide better conversational recommendations but cost more per interaction.

| Model       | Quality      | Context Window | Best For           |
| ----------- | ------------ | -------------- | ------------------ |
| GPT-4.1 Nano | Budget      | 1M tokens      | Basic queries      |
| GPT-4.1 Mini | Recommended | 1M tokens      | Most users         |
| GPT-4.1      | Premium     | 1M tokens      | Complex requests   |

**Cost Considerations**:
- The assistant is used interactively, so costs depend on how often users chat
- More powerful models understand nuanced requests better ("find me something like Parasite but less intense")
- Changes take effect immediately for all users

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

## File Locations Configuration

Navigate to **Admin → Settings → Setup → File Locations**

This section configures how Aperture creates symlinks and where your media server finds Aperture's output libraries. Getting these paths right is essential for symlinks to work correctly.

### The Problem

When using symlinks, Aperture needs to know:
1. Where your **media server** sees your original media files
2. Where your **media server** sees Aperture's output folder

If these paths don't match your actual Docker volume mounts, you'll see "path does not exist" errors when Aperture tries to create symlinks or when your media server tries to play content from Aperture libraries.

### Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| **Aperture Libraries Path** | Where your media server sees the `/aperture-libraries` volume | `/mnt/ApertureLibraries/` |
| **Media Server Path Prefix** | Base path where your media server sees your media files | `/mnt/` |

### Auto-Detection

Click **Auto-Detect Paths** to let Aperture automatically discover the correct paths by:
1. Fetching a sample file path from your media server
2. Comparing it to how Aperture sees the same file
3. Calculating the path prefix mapping

Auto-detection works when:
- You have movies synced in Aperture
- The media server and Aperture can both access the same files
- The paths differ only by a prefix (e.g., `/mnt/Movies/...` vs `/data/Movies/...`)

### Use Case Examples

**Unraid (Default Setup)**

Most Unraid users mount their media at `/mnt/user/Media/` and their media server sees it at `/mnt/`:

| Setting | Value |
|---------|-------|
| Aperture Libraries Path | `/mnt/ApertureLibraries/` |
| Media Server Path Prefix | `/mnt/` |

**Synology NAS**

Synology users often use `/volume1/` paths:

| Setting | Value |
|---------|-------|
| Aperture Libraries Path | `/volume1/docker/aperture/libraries/` |
| Media Server Path Prefix | `/volume1/` |

**Custom Docker Setup (Different Mount Points)**

If your media server mounts media at `/data/` but Aperture mounts it at `/media/`:

| Setting | Value |
|---------|-------|
| Aperture Libraries Path | `/data/ApertureLibraries/` |
| Media Server Path Prefix | `/data/` |

### Troubleshooting

**"Path does not exist" errors:**
- Run auto-detection to find the correct paths
- Check your Docker volume mounts match the configured paths
- Verify your media server can access the ApertureLibraries folder

**Symlinks not working:**
- Ensure both containers share the same underlying filesystem
- The path prefix must match exactly (including trailing slashes)
- Consider using STRM files if symlinks aren't possible in your setup

---

## Watch History Management

Navigate to **Admin → Users → [User] → Settings**

Control whether users can mark items as unwatched:

- **Enable Watch History Management** — Toggle to allow this user to remove items from their watch history
- When enabled, users see "Mark Unwatched" buttons on movies, episodes, seasons, and series
- Changes sync to both Aperture's database and the media server

---

## API Error Alerts

Aperture tracks errors from external API integrations (MDBList, TMDb, OMDb, OpenAI) and displays alerts when issues occur.

### Error Types

| Type              | Severity | Description                                      |
| ----------------- | -------- | ------------------------------------------------ |
| **Authentication**| Error    | Invalid API key or expired credentials           |
| **Rate Limit**    | Warning  | Daily/hourly request limit reached               |
| **Service Outage**| Info     | Temporary server errors (500, 502, 503, 504)     |

### Alert Behavior

- **Auth errors** — Require manual action (check/update API key)
- **Rate limits** — Show reset time; auto-clear when limit resets
- **Outage errors** — **Auto-dismiss** when a successful connection is detected

### Auto-Dismiss for Outages

When an external service has a temporary outage, Aperture logs the error and shows an alert. Once the service recovers:

- Testing the connection in Settings will automatically clear the alert
- No manual dismissal needed for recovered services
- This prevents stale "Service Unavailable" alerts from persisting

### Manual Dismissal

Click the **X** button on any alert to dismiss it. Dismissed errors are cleaned up after 7 days.

---

## Database Management

Navigate to **Admin → Settings → Database**

- **View Stats** — See counts of movies, series, embeddings, etc.
- **Purge Movies** — Delete all movie data (requires confirmation)

Use purge if you need to start fresh or switch media servers.

---

## Library Image Management

Navigate to **Admin → Settings → Setup → Library Images**

Customize the banner images for Aperture-created libraries (AI Recommendations and Top Picks).

### Image Types

| Library Type            | Description                              |
| ----------------------- | ---------------------------------------- |
| AI Recommendations Movies | Banner for all users' movie rec libraries |
| AI Recommendations Series | Banner for all users' series rec libraries |
| Top Picks Movies        | Banner for the Top Picks movies library  |
| Top Picks Series        | Banner for the Top Picks series library  |

### Image Specifications

- **Aspect Ratio**: 16:9 (banner format)
- **Recommended Size**: 1920×1080 pixels
- **Format**: JPG or PNG

### How It Works

1. Upload a banner image for each library type
2. Images are stored locally and synced to your media server
3. When library sync jobs run, the banner is applied to the library
4. All users' libraries of that type will use the same image

### Importing from Emby/Jellyfin

If you've already set a library image in your media server:

1. Click **Import from Emby** on the library card
2. The existing image will be downloaded and stored in Aperture
3. Future syncs will use the Aperture-managed image

---

## Emby Home Row Sorting (Series)

Aperture includes a workaround for Emby's series sorting limitation on home rows.

### The Problem

Emby sorts series on home rows (like "Latest") by the most recent episode's `dateadded`. This means your carefully ranked series recommendations appear in random order based on when episodes were added to your library.

### The Solution

Aperture creates a hidden "Season 00" in each recommended series with a placeholder episode. This placeholder has a `dateadded` set 100 years in the future, based on the series rank. Higher-ranked series get dates further in the future, ensuring they appear first.

### Technical Details

- A `Season 00` folder is created with a minimal NFO and STRM file
- The placeholder is automatically marked as "watched" to prevent it appearing in "Continue Watching"
- Aperture filters these placeholders from watch history sync
- The NFO includes a clear comment explaining its purpose

This feature is automatic and requires no configuration.

---

## Backup & Restore

### Automatic Backups

Aperture automatically backs up the database daily at 1 AM. Configure in **Admin → Jobs**.

- Backups are stored in the `/backups` volume mount
- Default retention: 7 backups (configurable in Admin → Settings → System)
- Format: Compressed PostgreSQL dump

### Manual Backup

1. Go to **Admin → Settings → System**
2. Scroll to **Backup & Restore**
3. Click **Create Backup**
4. Download for offsite storage

### Restoring

**During initial setup:**
- The first step offers to restore from a backup
- Upload a file or select from existing backups

**From Admin panel:**
1. Go to **Admin → Settings → System**
2. Scroll to **Backup & Restore**
3. Select a backup and click **Restore**

---

## Recommended Workflow

The default schedules are optimized for most setups:

| Time | Jobs |
|------|------|
| 1:00 AM | Database backup |
| 2:00 AM | Library scan (sync-movies, sync-series) |
| Every 2h | Watch history sync |
| 3:00 AM | Embedding generation |
| Sunday 4:00 AM | AI recommendations |
| Sunday 5:00 AM | Library sync (STRM/symlinks) |
| 5:00 AM | Top Picks refresh |
| Every 6h | Metadata enrichment |

This ensures:
- Fresh recommendations every Sunday based on the week's viewing
- Watch history stays current throughout the day
- New content is indexed daily
- Backups happen before any other jobs

