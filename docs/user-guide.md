# User Guide

This guide covers all the features available to Aperture users.

## Logging In

1. Open Aperture in your browser
2. Enter your **Emby or Jellyfin username and password**
3. Aperture authenticates against your media server — no separate account needed

---

## Home Page

Your home page shows:

### Quick Stats

- **Movies Watched** — Total movies in your watch history
- **Favorites** — Movies you've marked as favorites
- **AI Recommendations** — Number of personalized picks available

### Taste Profiles

Two AI-generated cards describe your viewing preferences:

- **Movie Taste** — A natural language description of your film preferences
- **TV Taste** — A description of your series preferences

Click the **refresh button** to regenerate your profile with the latest watch data.

### Your Top Picks

A carousel of AI-recommended movies based on your taste. Each poster shows:

- **Match Score** — A percentage indicating how well it fits your preferences
- Click any poster to see detailed insights

### Recently Watched

Movies you've recently watched, with play counts and favorite indicators.

---

## Browsing Content

### Browse Movies

Navigate to **Movies** in the sidebar to browse your entire library:

- **Search** — Find movies by title
- **Filter by Genre** — Show only specific genres
- **Similar Movies** — On any movie detail page, see AI-powered similar titles

### Browse TV Series

Navigate to **Series** in the sidebar:

- **Search** — Find series by title
- **Filter by Genre** — Show only specific genres
- **Filter by Network** — Filter by TV network (HBO, Netflix, etc.)
- **Series Details** — Click any series to view seasons, episodes, and metadata

### Top Movies & Top Series

Navigate to **Top Movies** or **Top Series** in the sidebar to see global trending content:

- **Rank Badges** — Gold (#1), Silver (#2), Bronze (#3) badges for top 3
- **Popularity Metrics** — View count, unique viewers, and popularity scores
- **Grid View** — Browse all trending content with posters
- **Quick Actions** — One-click play buttons for each title

---

## Rating Content

Aperture uses a 10-heart rating system compatible with Trakt.tv:

- Click on any movie or series poster to access the detail page
- Use the **heart rating** to rate content from 1-10 hearts
- Ratings influence your future recommendations:
  - **High ratings (7-10)** boost similar content
  - **Low ratings (1-3)** can exclude or penalize similar content (based on your preference)

### Disliked Content Behavior

Navigate to **Settings** to configure how low-rated content affects recommendations:

- **Exclude** (default) — Content similar to items you've rated 1-3 hearts won't appear in recommendations
- **Penalize** — Content similar to disliked items will appear less often but won't be completely excluded

---

## Understanding Recommendations

Click on any recommended movie or series to see **why it was picked for you**:

### Match Score Breakdown

- **Taste Match** — How similar this is to content you've enjoyed
- **Discovery** — How much it expands your horizons
- **Quality** — Community and critic ratings
- **Variety** — How it adds diversity to your recommendations

### Genre Analysis

See which genres in this title match your preferences and which are new territory.

### Evidence Trail

View the specific movies/series from your watch history that influenced this recommendation. "Because you watched X, Y, and Z..."

---

## Creating Channels

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

---

## Watch History

Navigate to **History** to see everything you've watched:

- Sort by **recent** or **most played**
- See **play counts** and **last watched** dates
- **Favorites** are highlighted with a heart icon

---

## Watch Stats

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

---

## User Settings

Navigate to **Settings** (user icon in sidebar):

- **Movies Library Name** — Customize your AI recommendations movie library name
- **Series Library Name** — Customize your AI recommendations series library name
- **Disliked Content Behavior** — Choose how low-rated content affects recommendations
- **AI Explanation Preference** — If your admin has enabled this option, toggle whether AI explanations appear in your recommendation descriptions

Both library names are optional — leave empty to use the global default templates set by your admin.

---

## Managing Watch History

If your admin has enabled watch history management for your account:

- **Mark Movies Unwatched** — On any movie detail page or in your watch history, click "Mark Unwatched" to remove it from your watch history
- **Mark Episodes Unwatched** — Remove individual episodes from your watch history
- **Mark Seasons Unwatched** — Remove an entire season at once
- **Mark Series Unwatched** — Remove all episodes of a series from your watch history

Changes sync to both Aperture and your media server.

---

## Trakt Integration

If your admin has configured Trakt.tv integration:

1. Navigate to **Settings**
2. Click **Connect Trakt Account**
3. Authorize Aperture in the Trakt popup
4. Your Trakt ratings will sync to Aperture

Ratings sync bidirectionally:
- Ratings you add in Aperture push to Trakt
- Ratings you add in Trakt sync to Aperture (on a schedule)

---

## Virtual Libraries in Your Media Server

Once recommendations are generated and STRM files are synced:

1. Open your **Emby or Jellyfin** app
2. Look for a new library called **"AI Picks - YourUsername"**
3. This library contains your personalized recommendations
4. Play directly from here — it streams from your actual media files

The library updates automatically when new recommendations are generated.

