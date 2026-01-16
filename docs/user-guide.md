# User Guide

This guide covers all the features available to Aperture users.

## Table of Contents

- [Logging In](#logging-in)
- [AI Assistant (Encore)](#ai-assistant-encore)
  - [Opening the Assistant](#opening-the-assistant)
  - [What You Can Ask](#what-you-can-ask)
  - [Conversation History](#conversation-history)
  - [Content Cards](#content-cards)
- [Dashboard](#dashboard)
  - [Quick Stats Bar](#quick-stats-bar)
  - [Your Movie Picks](#your-movie-picks)
  - [Your Series Picks](#your-series-picks)
  - [Trending Movies](#trending-movies)
  - [Trending Series](#trending-series)
  - [Recently Watched](#recently-watched)
  - [Recent Ratings](#recent-ratings)
- [Browsing Content](#browsing-content)
  - [Browse Movies](#browse-movies)
  - [Browse TV Series](#browse-tv-series)
  - [Top Movies & Top Series](#top-movies--top-series)
- [Rating Content](#rating-content)
  - [Rating from Posters](#rating-from-posters)
  - [Rating from Detail Pages](#rating-from-detail-pages)
  - [How Ratings Affect Recommendations](#how-ratings-affect-recommendations)
  - [Disliked Content Behavior](#disliked-content-behavior)
- [Understanding Recommendations](#understanding-recommendations)
  - [Match Score Breakdown](#match-score-breakdown)
  - [Genre Analysis](#genre-analysis)
  - [Evidence Trail](#evidence-trail)
- [Similarity Graphs](#similarity-graphs)
  - [Viewing the Graph](#viewing-the-graph)
  - [Interacting with the Graph](#interacting-with-the-graph)
  - [Fullscreen Mode](#fullscreen-mode)
  - [Creating Playlists from Graphs](#creating-playlists-from-graphs)
  - [Graph Preferences](#graph-preferences)
- [Creating Channels](#creating-channels)
- [Watch History](#watch-history)
- [Watch Stats](#watch-stats)
- [User Settings](#user-settings)
  - [Preferences Tab](#preferences-tab)
  - [Taste Profile Tab](#taste-profile-tab)
- [Managing Watch History](#managing-watch-history)
- [Trakt Integration](#trakt-integration)
- [Virtual Libraries in Your Media Server](#virtual-libraries-in-your-media-server)

---

## Logging In

1. Open Aperture in your browser
2. Enter your **Emby or Jellyfin username and password**
3. Aperture authenticates against your media server — no separate account needed

---

## AI Assistant (Encore)

Aperture includes **Encore**, an AI-powered conversational assistant that helps you discover content, get recommendations, and explore your library using natural language.

### Opening the Assistant

Click the **sparkle button** (✨) in the bottom-right corner of any page to open Encore. The assistant opens in a modal dialog where you can:

- Type questions or requests
- View content results as interactive cards
- Expand to fullscreen for conversation history

### What You Can Ask

Encore understands natural language and can help with:

**Recommendations & Discovery**

- "What should I watch tonight?"
- "Show me my AI recommendations"
- "Find something like Inception"
- "Suggest mind-bending sci-fi movies"
- "What are the highest-rated comedies in my library?"

**Similar Content**

- "Movies similar to The Dark Knight"
- "Shows like Breaking Bad"
- "Find me something like Parasite but scarier"

**Search & Browse**

- "Show me 90s action movies"
- "Find horror movies rated above 7"
- "What Christopher Nolan movies do I have?"
- "Search for movies with Tom Hanks"

**Your Activity**

- "What have I watched recently?"
- "Show my ratings"
- "What movies have I rated 10 hearts?"
- "How many movies have I watched?"

**Library Stats**

- "How many movies are in my library?"
- "What's the longest movie I have?"
- "Which series has the most episodes?"
- "What are my top genres?"

**People & Studios**

- "What movies does Margot Robbie appear in?"
- "Show me Steven Spielberg's filmography"
- "What studios have I watched the most?"

**Help**

- "How do recommendations work?"
- "How do ratings affect my picks?"
- "Help me understand Aperture"

### Conversation History

Click the **fullscreen button** to expand the assistant and reveal the conversation sidebar:

- **Previous chats** — All your past conversations are saved
- **New chat** — Start a fresh conversation anytime
- **Rename** — Click the edit icon to rename a conversation
- **Delete** — Remove old conversations you no longer need

Conversations auto-title based on your first message.

### Content Cards

When Encore finds content for you, results appear as interactive cards with:

- **Poster image** — Visual identification
- **Title and year** — Basic info with genre tags
- **Rating** — Community rating (if available)
- **Rank badge** — Gold/Silver/Bronze for top recommendations
- **Actions** — "Details" to view in Aperture, "Play" to open in your media server

---

## Dashboard

Your dashboard shows a unified view of personalized and trending content:

### Quick Stats Bar

- **Movies Watched** — Total movies in your watch history
- **Series Watched** — Total series you've started
- **Ratings Given** — Number of items you've rated
- **Total Watch Time** — Cumulative viewing time

### Your Movie Picks

A two-row carousel of AI-recommended movies based on your taste. Each poster shows:

- **Rank Badge** — Gold (#1), Silver (#2), Bronze (#3) for top recommendations
- **Heart Rating** — Click the heart to rate directly from the poster
- Click any poster to see detailed insights

### Your Series Picks

A two-row carousel of AI-recommended TV series with the same ranking and rating features.

### Trending Movies

A carousel of popular movies across all users, ranked by community activity.

### Trending Series

A carousel of popular TV series across all users.

### Recently Watched

Content you've recently watched with smart time formatting:
- **"2d ago"** — Watched 2 days ago (first watch)
- **"2d ago · 3x"** — Watched 2 days ago, 3 total plays
- **"2d ago · Rewatched"** — Recently rewatched

### Recent Ratings

Your most recent ratings with the heart fill indicator.

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

Navigate to **Top Movies** or **Top Series** in the sidebar to see trending content:

- **Rank Badges** — Gold (#1), Silver (#2), Bronze (#3) badges for top 3
- **Grid View** — Browse all trending content with posters
- **Quick Actions** — One-click play buttons for each title

> **Note**: Top Picks can be based on your server's watch history, external rankings from MDBList, or a combination of both. Your admin configures the source and ranking criteria.

---

## Rating Content

Aperture uses a 10-heart rating system compatible with Trakt.tv:

### Rating from Posters

Every movie and series poster displays a heart icon in the bottom-right corner:

1. **Click the heart** — A popper opens with 10 hearts to choose from
2. **Select your rating** — Click any heart (1-10) to rate
3. **Visual feedback** — The single heart fills proportionally to show your rating
4. **Rate anywhere** — Works on dashboard, browse pages, recommendations, and more

### Rating from Detail Pages

On movie and series detail pages, you can also rate using the larger heart display.

### How Ratings Affect Recommendations

- **High ratings (7-10)** — Boost similar content in future recommendations
- **Low ratings (1-3)** — Exclude or penalize similar content (configurable in settings)

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

## Similarity Graphs

Aperture includes an interactive graph visualization that shows how movies and series in your library are connected through directors, actors, genres, collections, and more.

### Viewing the Graph

On any movie or series detail page, look for the **Similar** section:

1. **List View** — Traditional grid of similar content posters
2. **Graph View** — Interactive force-directed graph showing connections

Click the **Graph** tab to switch to the visualization.

### Interacting with the Graph

The graph displays movies/series as poster nodes with color-coded lines showing why they're connected:

| Color | Connection Type |
|-------|----------------|
| 🔵 Blue | Same director |
| 🌊 Teal | Shared actors |
| 🥇 Gold | Same collection/franchise |
| 💜 Purple | Shared genres |
| 💗 Pink | Shared keywords/themes |
| 🟠 Orange | Same studio |
| 🟢 Green | Same network (TV) |
| 🩶 Gray | AI similarity |
| 💚 Emerald | AI discovery |

**Mouse/Touch Controls:**

- **Click a poster** — Refocus the graph on that item (explore deeper!)
- **Double-click** — Navigate to that movie/series detail page
- **Drag posters** — Rearrange the layout
- **Scroll** — Zoom in and out
- **Hover on lines** — See detailed connection reasons

**Breadcrumb Navigation:**

As you click through posters, a breadcrumb trail appears showing your exploration path. Click any breadcrumb to jump back to that point.

### Fullscreen Mode

Click the **fullscreen button** (⛶) in the top-right of the graph to expand it:

- **Deeper exploration** — Graph expands to 3 levels deep (connections of connections of connections)
- **More items** — Up to 35 nodes displayed
- **Create Playlist button** — Save your discoveries as a playlist
- **Same interactions** — Drag, zoom, click all work the same

### Creating Playlists from Graphs

In fullscreen mode, you can save your graph exploration as a playlist:

1. Explore the graph until you have a collection you like
2. Click **Create Playlist** in the dialog header
3. Enter a name or click ✨ for an **AI-generated name**
4. Enter a description or click ✨ for an **AI-generated description**
5. Click **Create**

The playlist syncs to your media server (Emby/Jellyfin) with all the items from the graph. Graph playlists appear on the **Playlists** page marked with a hub icon.

### Graph Preferences

Customize how the similarity graph works in **Settings → Preferences**:

**Hide Watched Content** (Default: ON)
- When enabled, movies/series you've already watched won't appear in the graph
- Helps you discover new content rather than seeing things you've already seen

**Full Franchise Mode** (Default: OFF)
- When enabled, shows entire franchises without limits
- Normally, the graph limits items per collection to encourage diverse discovery
- Turn on when you want to see all 26 James Bond films or all Marvel movies

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

### Preferences Tab

**Library Names**
- **Movies Library Name** — Customize your AI recommendations movie library name
- **Series Library Name** — Customize your AI recommendations series library name

Both library names are optional — leave empty to use the global default templates set by your admin.

**Recommendations**
- **Disliked Content Behavior** — Choose how low-rated content affects recommendations
- **AI Explanation Preference** — If your admin has enabled this option, toggle whether AI explanations appear in your recommendation descriptions

**Similarity Graph**
- **Hide Watched Content** — When ON, filters out already-watched items from similarity graphs
- **Full Franchise Mode** — When ON, shows entire franchises without collection limits

### Taste Profile Tab

View your AI-generated taste profiles:

- **Movie Taste** — A natural language description of your film preferences based on your watch history
- **TV Taste** — A description of your series preferences
- Click the **refresh button** to regenerate your profile with the latest watch data

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
2. Look for a new library called **"AI Picks - YourUsername"** (or similar, depending on admin configuration)
3. This library contains your personalized recommendations
4. Play directly from here — it streams from your actual media files

The library updates automatically when new recommendations are generated.

### Library Features

- **Excluded from Global Search** — AI recommendation libraries don't appear in search results, keeping your searches clean and showing only results from your main libraries
- **Sorted by Date Added** — Newest recommendations appear first by default when you open the library
- **No Duplicate Continue Watching** — Playing content from recommendation libraries won't create duplicate entries in your Continue Watching row
- **Custom Posters** — Top recommendations display rank badges (🥇🥈🥉) on their posters

