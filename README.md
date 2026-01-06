# Aperture

[![Docker Image](https://img.shields.io/badge/docker-ghcr.io%2Fdgruhin--hrizn%2Faperture-blue?logo=docker)](https://github.com/dgruhin-hrizn/aperture/pkgs/container/aperture)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Aperture** — AI-powered media recommendations for Emby & Jellyfin.

```bash
docker pull ghcr.io/dgruhin-hrizn/aperture:latest
```

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

### Watch Stats Dashboard

- **Comprehensive Analytics**: Visualize your watch history with interactive charts
- **Genre Breakdown**: Donut chart showing your favorite genres
- **Watch Timeline**: Monthly activity area chart
- **Decades Distribution**: Bar chart of content by decade
- **Ratings Distribution**: See which ratings you gravitate toward
- **Top Actors & Directors**: Most-watched actors and directors with profile images from your media server
- **Top Studios & Networks**: Most-watched studios (movies) and networks (series) with logos
- **Movies vs Series**: Compare your movie and TV watching patterns

### Top Picks (Global)

- **Popularity-Based Content**: Global "Top Picks" showing trending content across all users
- **Multiple Output Modes**: Create Libraries, Collections (Box Sets), and/or Playlists — use any combination
- **Rank-Ordered Collections**: Collections and playlists maintain rank order (1, 2, 3...) so your #1 pick appears first
- **Priority Sorting**: Top Picks libraries and collections automatically sort to the top of your media server
- **Configurable Metrics**: Weight by unique viewers, play count, and completion rate
- **Time Windows**: Configure how far back to look for popular content
- **Separate Configuration**: Independent settings for movies and series

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
- **Running Jobs Widget**: Live progress indicator in the top bar showing active jobs with combined progress
- **User Management**: Enable/disable AI recommendations per user, separately for movies and series
- **Algorithm Tuning**: Configure recommendation weights and parameters separately for movies and series
- **Model Selection**: Choose between embedding models (small/large) and text generation models (GPT-4o-mini, GPT-5-nano, etc.)
- **AI Explanation Toggle**: Enable/disable AI-generated "why this was picked" explanations globally, with per-user override capability
- **Output Format Options**: Choose between STRM files or symlinks for virtual libraries
- **Cost Estimator**: Built-in OpenAI API cost estimation based on your configuration
- **Database Management**: Purge and reset functionality for media data

### User Experience

- **Media Server Avatars**: User profile images pulled directly from Emby/Jellyfin
- **Top Movies & Series Pages**: Browse global trending content with rank badges and popularity metrics
- **Responsive Design**: Full mobile support with collapsible sidebar

## Quick Start

### Prerequisites

- Docker and Docker Compose
- An Emby or Jellyfin server with admin API key
- OpenAI API key

### Option 1: Using Pre-built Docker Image (Recommended)

The easiest way to run Aperture is with the pre-built image from GitHub Container Registry.

1. **Create a directory and docker-compose.yml**

```bash
mkdir aperture && cd aperture
```

Create a `docker-compose.yml` file:

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
      # OpenAI - required for AI features
      OPENAI_API_KEY: sk-your-openai-api-key
      # Media Server - can also configure via Admin UI after startup
      # MEDIA_SERVER_TYPE: emby
      # MEDIA_SERVER_BASE_URL: http://your-server:8096
      # MEDIA_SERVER_API_KEY: your-api-key
      # STRM Configuration
      MEDIA_SERVER_STRM_ROOT: /strm
      AI_LIBRARY_PATH_PREFIX: /strm/aperture/
    ports:
      - '3456:3456'
    volumes:
      # Mount a directory for STRM files - must be accessible by your media server
      - ./strm:/strm
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

volumes:
  pgdata:
```

2. **Configure the environment variables**

Edit the `docker-compose.yml` and update:

- `SESSION_SECRET` — Generate a random string (at least 32 characters)
- `OPENAI_API_KEY` — Your OpenAI API key
- `APP_BASE_URL` — The URL where you'll access Aperture (e.g., `http://192.168.1.100:3456`)
- Database passwords (change `changeme-db-password` in both places)

3. **Start Aperture**

```bash
docker compose up -d
```

4. **Open the app** at http://localhost:3456 and log in with your Emby/Jellyfin credentials.

5. **Configure your media server** in Admin → Settings → Media Server (if not set via environment variables).

### Option 2: Build from Source

For development or customization:

1. **Clone and configure**

```bash
git clone https://github.com/dgruhin-hrizn/aperture.git
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
OPENAI_API_KEY: sk-your-openai-api-key

# Media Server (can also configure via Admin UI)
MEDIA_SERVER_TYPE=emby  # or 'jellyfin'
MEDIA_SERVER_BASE_URL=http://your-server:8096
MEDIA_SERVER_API_KEY=your-api-key
```

3. **Start the stack**

```bash
docker compose up -d --build
```

4. **Open the app** at http://localhost:3456 and log in with your media server credentials.

### Updating Aperture

```bash
# Pull the latest image
docker compose pull

# Restart with the new version
docker compose up -d
```

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

## Admin Guide

### Initial Setup Walkthrough

After starting Aperture for the first time, log in with your **Emby/Jellyfin admin account** and follow these steps:

#### Step 1: Configure Media Server Connection

Navigate to **Admin → Settings → Media Server**

1. Select your server type (Emby or Jellyfin)
2. Enter your media server URL (e.g., `http://192.168.1.100:8096`)
3. Enter your admin API key
   - **Emby**: Dashboard → API Keys → New API Key
   - **Jellyfin**: Dashboard → API Keys → Add
4. Click **Test Connection** to verify
5. Save the configuration

#### Step 2: Select Libraries to Sync

Navigate to **Admin → Settings → Libraries**

1. Click **Sync Libraries** to fetch available libraries from your media server
2. Toggle **ON** for each movie and TV library you want Aperture to analyze
3. Libraries that are disabled won't be synced or included in recommendations

#### Step 3: Run Initial Data Sync

Navigate to **Admin → Jobs**

Run these jobs in order (wait for each to complete):

1. **sync-movies** — Imports all movies from enabled libraries
2. **sync-series** — Imports all TV series and episodes
3. **generate-embeddings** — Creates AI embeddings for movies (requires OpenAI API key)
4. **generate-series-embeddings** — Creates AI embeddings for series

> **Note**: Embedding generation can take time for large libraries. Progress is shown in real-time.

#### Step 4: Enable Users for AI Recommendations

Navigate to **Admin → Users**

1. You'll see all users from your media server
2. For each user you want to receive recommendations:
   - Toggle **Movies** to enable movie recommendations
   - Toggle **Series** to enable TV series recommendations
3. Users must have watch history for recommendations to work

#### Step 5: Sync Watch History

Navigate to **Admin → Jobs**

1. Run **sync-watch-history** — Imports what movies users have watched
2. Run **sync-series-watch-history** — Imports what episodes users have watched

#### Step 6: Generate Recommendations

Navigate to **Admin → Jobs**

1. Run **generate-recommendations** — Creates personalized movie picks for all enabled users
2. Run **generate-series-recommendations** — Creates personalized series picks
3. Run **sync-movie-libraries** — Creates the virtual movie library in your media server
4. Run **sync-series-libraries** — Creates the virtual series library

After this, users will see a new "AI Picks" library in their media server!

### Managing Jobs

#### Job Scheduling

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

#### Monitoring Jobs

- **Real-time progress**: Watch jobs as they run with live progress bars
- **Job history**: View past runs, duration, and any errors
- **Cancel**: Stop a running job if needed

### Algorithm Tuning

Navigate to **Admin → Settings → AI Config**

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

### Top Picks Configuration

Navigate to **Admin → Settings → Top Picks**

Top Picks shows globally popular content based on aggregated watch data across all users. The dedicated Top Picks tab provides comprehensive configuration:

#### Content Selection

- **Enable/Disable** — Turn Top Picks on or off
- **Time Window** — How far back to analyze (e.g., 30 days)
- **Movies Count** — How many movies to include
- **Series Count** — How many series to include
- **Minimum Viewers** — Require at least N unique viewers for inclusion

#### Popularity Algorithm

Configure how popularity is calculated by weighting:

- **Unique Viewers** — Different users who watched the content
- **Play Count** — Total plays across all users
- **Completion Rate** — How often users finish what they start

#### Output Configuration

Choose how Top Picks appear in your media server (independently for movies and series):

| Output Type    | Description                                                   |
| -------------- | ------------------------------------------------------------- |
| **Library**    | Virtual folder with STRM/symlink files (traditional approach) |
| **Collection** | Box Set in your media server (appears in Collections view)    |
| **Playlist**   | Server playlist (appears in Playlists section)                |

You can enable any combination — for example, create both a Library AND a Collection for movies.

**Library File Type**: When using Libraries, you can choose between STRM files (default) or Symlinks for each content type independently:

- **Movies**: Toggle between STRM files (flat structure) or symlinks (folder per movie with symlink to original file)
- **Series**: Toggle between STRM files (per episode) or symlinks to season folders

Both default to STRM files, which work in all network configurations. Use symlinks only if Aperture and your media server share the same filesystem paths.

**Folder Structure with Symlinks**: When using symlinks for movies, each movie gets its own folder containing the symlinked video file, NFO metadata, poster, and fanart:

```
Top Picks - Movies/
├── Inception (2010) [12345]/
│   ├── Inception (2010) [12345].mkv  → symlink to original
│   ├── Inception (2010) [12345].nfo
│   ├── poster.jpg
│   └── fanart.jpg
```

**Collection/Playlist Names**: Customize the display names (defaults: "Top Picks - Movies", "Top Picks - Series"). Collections are automatically sorted to appear at the top of your collections list.

**Collections and Libraries Together**: You can enable both Library AND Collection modes. Collections will contain items from the Top Picks library (not your original library), so you won't see duplicates. The job automatically:

1. Writes STRM/symlink files to the library
2. Triggers a library scan and waits for completion
3. Creates collections using the newly-scanned library items

**Rank Ordering**: Items in collections have their sort names set to maintain rank order (e.g., "01 - Movie Title", "02 - Movie Title"). When viewing the collection sorted by name, items appear in popularity order.

Click **Refresh Top Picks Now** to manually update.

### Model Selection

#### Embedding Model (Admin → Settings → Embedding Model)

| Model                  | Quality | Cost            | Best For        |
| ---------------------- | ------- | --------------- | --------------- |
| text-embedding-3-small | Good    | $0.02/1M tokens | Most users      |
| text-embedding-3-large | Best    | $0.13/1M tokens | Premium quality |

> **Warning**: Changing models requires regenerating all embeddings.

#### Text Generation Model (Admin → Settings → Text Model)

Used for taste profiles and recommendation explanations:

| Model       | Quality     | Cost   |
| ----------- | ----------- | ------ |
| GPT-4o Mini | Recommended | Low    |
| GPT-5 Nano  | Budget      | Lowest |
| GPT-5 Mini  | Premium     | Higher |

### AI Explanation Settings

Navigate to **Admin → Settings → Output & AI**

Control whether AI-generated explanations appear in recommendation NFO files:

- **Global Toggle** — Enable/disable AI explanations for all users
- **User Override Permission** — When enabled, admins can grant specific users the ability to toggle their own preference
- **Per-User Settings** — On each user's detail page, admins can allow that user to override the global setting

The AI explanation appears in the NFO plot field, explaining why each title was recommended ("Because you enjoyed dark thrillers like X and Y...").

### Output Format Settings

Configure how virtual libraries are created:

| Format       | Description                                              | Use When                                  |
| ------------ | -------------------------------------------------------- | ----------------------------------------- |
| **STRM**     | Small text files containing streaming URLs or file paths | Default; works in all setups              |
| **Symlinks** | Symbolic links pointing to original media files          | Shared filesystem; preserves full quality |

**STRM files** are universally compatible and work even when Aperture runs on a different machine than your media server.

**Symlinks** require that both Aperture and your media server can access the same filesystem paths. This is ideal for NAS setups where both containers mount the same media share.

> **Note**: Top Picks has its own separate STRM/Symlinks toggles for Movies and Series in **Admin → Settings → Top Picks**. User recommendations output format is configured in **Admin → Settings → Output & AI**.

### Database Management

Navigate to **Admin → Settings → Database**

- **View Stats** — See counts of movies, series, embeddings, etc.
- **Purge Movies** — Delete all movie data (requires confirmation)

Use purge if you need to start fresh or switch media servers.

---

## User Guide

### Logging In

1. Open Aperture in your browser
2. Enter your **Emby or Jellyfin username and password**
3. Aperture authenticates against your media server — no separate account needed

### Home Page

Your home page shows:

#### Quick Stats

- **Movies Watched** — Total movies in your watch history
- **Favorites** — Movies you've marked as favorites
- **AI Recommendations** — Number of personalized picks available

#### Taste Profiles

Two AI-generated cards describe your viewing preferences:

- **Movie Taste** — A natural language description of your film preferences
- **TV Taste** — A description of your series preferences

Click the **refresh button** to regenerate your profile with the latest watch data.

#### Your Top Picks

A carousel of AI-recommended movies based on your taste. Each poster shows:

- **Match Score** — A percentage indicating how well it fits your preferences
- Click any poster to see detailed insights

#### Recently Watched

Movies you've recently watched, with play counts and favorite indicators.

### Top Movies & Top Series

Navigate to **Top Movies** or **Top Series** in the sidebar to see global trending content:

- **Rank Badges** — Gold (#1), Silver (#2), Bronze (#3) badges for top 3
- **Popularity Metrics** — View count, unique viewers, and popularity scores
- **Grid View** — Browse all trending content with posters
- **Quick Actions** — One-click play buttons for each title

### Understanding Recommendations

Click on any recommended movie to see **why it was picked for you**:

#### Match Score Breakdown

- **Taste Match** — How similar this is to movies you've enjoyed
- **Discovery** — How much it expands your horizons
- **Quality** — Community and critic ratings
- **Variety** — How it adds diversity to your recommendations

#### Genre Analysis

See which genres in this movie match your preferences and which are new territory.

#### Evidence Trail

View the specific movies from your watch history that influenced this recommendation. "Because you watched X, Y, and Z..."

### Browsing Movies

Navigate to **Movies** in the sidebar to browse your entire library:

- **Search** — Find movies by title
- **Filter by Genre** — Show only specific genres
- **Similar Movies** — On any movie detail page, see AI-powered similar titles

### Creating Channels

Channels are custom collections you can create based on your own criteria.

Navigate to **Playlists** in the sidebar:

1. Click **Create Channel**
2. Configure your channel:
   - **Name** — Give it a descriptive name
   - **Genre Filters** — Only include specific genres
   - **Text Preferences** — Natural language description (e.g., "90s action movies", "heartwarming family films")
   - **Example Movies** — Seed with movies that define the channel's taste
3. Click **Generate with AI** to let Aperture populate the channel
4. Optionally **sync to media server** to create a playlist in Emby/Jellyfin

### Watch History

Navigate to **History** to see everything you've watched:

- Sort by **recent** or **most played**
- See **play counts** and **last watched** dates
- **Favorites** are highlighted with a heart icon

### Watch Stats

Navigate to **Watch Stats** in the sidebar for detailed analytics:

- **Summary Cards** — Total movies, episodes, watch time, and favorites
- **Favorite Genres** — Interactive donut chart of your genre preferences
- **Watch Timeline** — Monthly activity showing when you watch most
- **Decades** — Bar chart showing which eras of content you prefer
- **Ratings Distribution** — See which rating ranges you gravitate toward
- **Top Actors** — Most-watched actors with profile thumbnails
- **Top Directors** — Most-watched directors with profile thumbnails
- **Top Studios** — Production studios you've watched most (movies)
- **Top Networks** — TV networks you've watched most (series)

### User Settings

Navigate to **Settings** (user icon in sidebar):

- **Custom Library Name** — Change your "AI Picks" library name (default: "AI Picks - YourUsername")
- **AI Explanation Preference** — If your admin has enabled this option for you, toggle whether AI explanations appear in your recommendation descriptions

### Virtual Libraries in Your Media Server

Once recommendations are generated and STRM files are synced:

1. Open your **Emby or Jellyfin** app
2. Look for a new library called **"AI Picks - YourUsername"**
3. This library contains your personalized recommendations
4. Play directly from here — it streams from your actual media files

The library updates automatically when new recommendations are generated.

---

## Ongoing Operations

### Recommended Workflow

For best results, schedule jobs to run automatically:

| Time    | Jobs                                                                    |
| ------- | ----------------------------------------------------------------------- |
| 3:00 AM | sync-movies, sync-series, sync-watch-history, sync-series-watch-history |
| 4:00 AM | generate-recommendations, generate-series-recommendations               |
| 5:00 AM | sync-movie-libraries, sync-series-libraries                             |
| 6:00 AM | refresh-top-picks                                                       |

This ensures users wake up to fresh recommendations based on yesterday's viewing.

### When to Run Manual Jobs

- **generate-embeddings** — After adding many new movies, or after changing embedding model
- **full-sync-watch-history** — If watch history seems out of sync
- **rebuild-recommendations** — After major algorithm changes

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

| Variable         | Description                          | Default       |
| ---------------- | ------------------------------------ | ------------- |
| `PORT`           | API server port                      | `3456`        |
| `NODE_ENV`       | Environment mode                     | `development` |
| `SESSION_SECRET` | Session cookie secret (min 32 chars) | **Required**  |
| `APP_BASE_URL`   | Public URL of the application        | **Required**  |
| `DATABASE_URL`   | PostgreSQL connection string         | **Required**  |

#### OpenAI Settings

| Variable             | Description     | Default                  |
| -------------------- | --------------- | ------------------------ |
| `OPENAI_API_KEY`     | OpenAI API key  | Required for AI features |
| `OPENAI_EMBED_MODEL` | Embedding model | `text-embedding-3-small` |

#### Media Server Settings

These can also be configured via Admin > Settings > Media Server.

| Variable                | Description          | Default |
| ----------------------- | -------------------- | ------- |
| `MEDIA_SERVER_TYPE`     | `emby` or `jellyfin` | `emby`  |
| `MEDIA_SERVER_BASE_URL` | Media server URL     | —       |
| `MEDIA_SERVER_API_KEY`  | Admin API key        | —       |

#### STRM Configuration

| Variable                    | Description                         | Default           |
| --------------------------- | ----------------------------------- | ----------------- |
| `MEDIA_SERVER_STRM_ROOT`    | Where Aperture writes STRM files    | `/strm`           |
| `AI_LIBRARY_PATH_PREFIX`    | Path prefix as seen by media server | `/strm/aperture/` |
| `AI_LIBRARY_NAME_PREFIX`    | Library name prefix                 | `AI Picks - `     |
| `STRM_USE_STREAMING_URL`    | Use streaming URLs in STRM files    | `true`            |
| `MEDIA_SERVER_LIBRARY_ROOT` | Root path for direct file paths     | `/mnt/media`      |

#### Job Schedules (Defaults)

| Variable     | Description               | Default            |
| ------------ | ------------------------- | ------------------ |
| `SYNC_CRON`  | Media sync schedule       | `0 3 * * *` (3 AM) |
| `RECS_CRON`  | Recommendation generation | `0 4 * * *` (4 AM) |
| `PERMS_CRON` | STRM/permissions sync     | `0 5 * * *` (5 AM) |

### Admin UI Configuration

The Admin Settings page provides UI-based configuration for:

- **Media Server**: Connection details, test connection
- **Libraries**: Enable/disable source libraries
- **AI Config**: Algorithm weights for movies and series separately
- **Embedding Model**: Choose small (fast/cheap) or large (best quality)
- **Text Generation Model**: Select GPT model for taste profiles and explanations
- **Top Picks**: Dedicated tab for global popularity content (output modes, algorithm tuning)
- **Output & AI**: User recommendations output format (STRM vs symlinks), AI explanation toggles
- **Cost Estimator**: Estimate OpenAI API costs based on your setup

### STRM Setup Guide

STRM files are how Aperture creates virtual libraries in your media server. Each STRM file is a small text file that points to the actual media file or streaming URL.

**Key Concept**: The STRM directory must be accessible by both Aperture (to write files) and your media server (to read and play them).

#### Same Machine Setup

If Aperture and your media server run on the same machine:

```yaml
# Aperture container
volumes:
  - /path/to/strm:/strm

# Media server container (Emby/Jellyfin)
volumes:
  - /path/to/strm:/strm
```

Environment variables:

```
MEDIA_SERVER_STRM_ROOT=/strm
AI_LIBRARY_PATH_PREFIX=/strm/aperture/
```

#### Different Machines (NAS/Network Share)

If Aperture runs on a different machine than your media server:

1. Create a shared folder accessible by both machines (e.g., on your NAS)
2. Mount it on both the Aperture machine and media server machine

Example:

- **NAS share**: `/mnt/user/Media/VirtualLibraries`
- **Aperture mount**: `/mnt/nas/VirtualLibraries` → `/strm` in container
- **Media server mount**: `/media/VirtualLibraries` in its container

```
# Aperture writes to /strm (which is /mnt/nas/VirtualLibraries on host)
MEDIA_SERVER_STRM_ROOT=/strm

# Media server sees the files at /media/VirtualLibraries
AI_LIBRARY_PATH_PREFIX=/media/VirtualLibraries/aperture/
```

#### Streaming URLs vs Direct Paths

By default, Aperture uses streaming URLs in STRM files:

```
STRM_USE_STREAMING_URL=true
```

This means STRM files contain URLs like:

```
http://emby-server:8096/Videos/12345/stream?api_key=...
```

If you prefer direct file paths (requires the media server to have direct access to your media files):

```
STRM_USE_STREAMING_URL=false
MEDIA_SERVER_LIBRARY_ROOT=/path/to/your/media
```

#### Using Symlinks Instead of STRM

For setups where both Aperture and your media server share the same filesystem (common with NAS), you can use symlinks instead of STRM files. Symlinks preserve all metadata and allow the media server to treat files exactly as originals.

**Requirements:**

- Aperture must have write access to the STRM directory
- Both containers must see the same paths for media files
- The filesystem must support symlinks (most Linux filesystems do)

Configure via **Admin → Settings → Output & AI → User Recommendations Output Format**.

**Top Picks** also support symlinks, configured separately in **Admin → Settings → Top Picks → Output Configuration**.

**Library Sorting**: Top Picks libraries and collections are automatically assigned sort titles that place them at the top of your library/collection lists (using `!!!!!!` prefix). This ensures your trending content is always easily accessible.

## Background Jobs

### Movie Jobs

| Job                        | Description                            | Schedule     |
| -------------------------- | -------------------------------------- | ------------ |
| `sync-movies`              | Sync movies from media server          | Configurable |
| `generate-embeddings`      | Generate AI embeddings                 | Manual       |
| `sync-watch-history`       | Delta sync of watch history            | Configurable |
| `full-sync-watch-history`  | Full resync of watch history           | Manual       |
| `generate-recommendations` | Generate personalized picks            | Configurable |
| `rebuild-recommendations`  | Clear and rebuild all recommendations  | Manual       |
| `sync-movie-libraries`     | Create movie libraries (STRM/symlinks) | Configurable |

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

| Job                 | Description                        | Schedule      |
| ------------------- | ---------------------------------- | ------------- |
| `refresh-top-picks` | Refresh popularity-based libraries | Daily at 6 AM |

The `refresh-top-picks` job:

1. Calculates popularity scores based on recent watch history
2. Writes STRM/symlink files to the Top Picks libraries
3. Creates/updates virtual libraries in your media server
4. Grants all users access to the libraries
5. Triggers library refresh and waits for scan completion
6. Creates collections and playlists (if enabled) using the scanned library items
7. Sets rank-based sort names on collection items for proper ordering

### Job Scheduling Options

- **Daily**: Run at a specific time each day
- **Weekly**: Run on a specific day and time
- **Interval**: Run every N hours (1, 2, 3, 4, 6, 8, or 12)
- **Manual**: Only run when triggered manually

## API Reference

### Authentication

| Endpoint                | Description                                |
| ----------------------- | ------------------------------------------ |
| `POST /api/auth/login`  | Authenticate with media server credentials |
| `POST /api/auth/logout` | End session                                |
| `GET /api/auth/me`      | Get current user                           |

### Users

| Endpoint                                              | Description                     |
| ----------------------------------------------------- | ------------------------------- |
| `GET /api/users`                                      | List all users (Admin)          |
| `GET /api/users/:id`                                  | Get user details                |
| `GET /api/users/:id/stats`                            | Get user statistics             |
| `GET /api/users/:id/watch-history`                    | Get movie watch history         |
| `GET /api/users/:id/watch-stats`                      | Get watch stats with breakdowns |
| `GET /api/users/:id/taste-profile`                    | Get movie taste synopsis        |
| `POST /api/users/:id/taste-profile/regenerate`        | Regenerate movie taste          |
| `GET /api/users/:id/series-taste-profile`             | Get series taste synopsis       |
| `POST /api/users/:id/series-taste-profile/regenerate` | Regenerate series taste         |
| `PUT /api/users/:id`                                  | Update user settings            |

### Top Picks

| Endpoint                    | Description             |
| --------------------------- | ----------------------- |
| `GET /api/top-picks/movies` | Get top trending movies |
| `GET /api/top-picks/series` | Get top trending series |

### Movies

| Endpoint                      | Description                         |
| ----------------------------- | ----------------------------------- |
| `GET /api/movies`             | List movies (paginated, filterable) |
| `GET /api/movies/:id`         | Get movie details                   |
| `GET /api/movies/:id/similar` | Get similar movies (vector search)  |
| `GET /api/movies/genres`      | List all genres                     |

### Recommendations

| Endpoint                                                   | Description                      |
| ---------------------------------------------------------- | -------------------------------- |
| `GET /api/recommendations/:userId`                         | Get user's movie recommendations |
| `GET /api/recommendations/:userId/movie/:movieId/insights` | Get recommendation insights      |
| `GET /api/recommendations/:userId/history`                 | Get recommendation run history   |

### Channels

| Endpoint                          | Description                   |
| --------------------------------- | ----------------------------- |
| `GET /api/channels`               | List user's channels          |
| `POST /api/channels`              | Create channel                |
| `GET /api/channels/:id`           | Get channel details           |
| `PUT /api/channels/:id`           | Update channel                |
| `DELETE /api/channels/:id`        | Delete channel                |
| `POST /api/channels/:id/generate` | AI-generate channel content   |
| `POST /api/channels/:id/sync`     | Sync to media server playlist |

### Settings (Admin)

| Endpoint                                      | Description                |
| --------------------------------------------- | -------------------------- |
| `GET /api/settings/media-server`              | Get media server info      |
| `GET /api/settings/media-server/config`       | Get full config (Admin)    |
| `PATCH /api/settings/media-server/config`     | Update config              |
| `POST /api/settings/media-server/test`        | Test connection            |
| `GET /api/settings/libraries`                 | Get library configurations |
| `POST /api/settings/libraries/sync`           | Sync from media server     |
| `PATCH /api/settings/libraries/:id`           | Enable/disable library     |
| `GET /api/settings/recommendations`           | Get algorithm config       |
| `PATCH /api/settings/recommendations/movies`  | Update movie config        |
| `PATCH /api/settings/recommendations/series`  | Update series config       |
| `GET /api/settings/embedding-model`           | Get embedding model        |
| `PATCH /api/settings/embedding-model`         | Set embedding model        |
| `GET /api/settings/text-generation-model`     | Get text gen model         |
| `PATCH /api/settings/text-generation-model`   | Set text gen model         |
| `GET /api/settings/top-picks`                 | Get Top Picks config       |
| `PATCH /api/settings/top-picks`               | Update Top Picks config    |
| `GET /api/settings/output-format`             | Get output format config   |
| `PATCH /api/settings/output-format`           | Update output format       |
| `GET /api/settings/ai-explanation`            | Get AI explanation config  |
| `PATCH /api/settings/ai-explanation`          | Update AI explanation      |
| `GET /api/settings/ai-explanation/user/:id`   | Get user override settings |
| `PATCH /api/settings/ai-explanation/user/:id` | Update user override       |
| `GET /api/settings/cost-inputs`               | Get cost estimation data   |

### Jobs (Admin)

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

### Database (Admin)

| Endpoint                       | Description             |
| ------------------------------ | ----------------------- |
| `GET /api/admin/purge/stats`   | Get database statistics |
| `POST /api/admin/purge/movies` | Purge all movie data    |

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

| Script             | Description                       |
| ------------------ | --------------------------------- |
| `pnpm dev`         | Start API and web dev servers     |
| `pnpm dev:api`     | Start only the API server         |
| `pnpm dev:web`     | Start only the web dev server     |
| `pnpm build`       | Build all packages                |
| `pnpm typecheck`   | Type check all packages           |
| `pnpm lint`        | Lint all packages                 |
| `pnpm db:migrate`  | Run database migrations           |
| `pnpm docker:up`   | Start Docker stack                |
| `pnpm docker:down` | Stop Docker stack                 |
| `pnpm docker:db`   | Start only the database container |

## Tech Stack

- **Backend**: Fastify, TypeScript, PostgreSQL, pgvector
- **Frontend**: React, Vite, MUI, React Router
- **AI**: OpenAI Embeddings & GPT models
- **Infrastructure**: Docker, pnpm workspaces

## License

MIT
