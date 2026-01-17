# Movie Details

The Movie Detail page shows comprehensive information about a specific movie.

![Movie Detail Page](../images/features/movie-detail.png)

## Page Sections

### Header

- **Backdrop** — Full-width fanart image
- **Poster** — Movie poster with heart rating overlay
- **Title & Year** — Movie name and release year
- **Metadata** — Runtime, rating, genres
- **Play Button** — Opens in your media server

### Overview

The movie's plot synopsis and description.

### Ratings

| Rating | Source |
|--------|--------|
| **Community Rating** | From your media server |
| **Rotten Tomatoes** | Critic score (if available) |
| **Metacritic** | Metascore (if available) |
| **Your Rating** | Your personal heart rating |

### Cast & Crew

- **Director** — Click to view their filmography
- **Writers** — Screenplay and story credits
- **Cast** — Top actors with photos, click to view their page

### Technical Info

| Field | Description |
|-------|-------------|
| **Resolution** | Video quality (4K, 1080p, etc.) |
| **Audio** | Audio format and channels |
| **Studio** | Production studio (clickable) |
| **Release Date** | Full release date |

### Collections

If the movie belongs to a franchise:

- Shows the collection name
- Link to view all movies in the franchise
- Your position in the collection

---

## Similar Movies

Below the main info, you'll find AI-powered similar movie suggestions:

### List View

A grid of similar movies with:

- Poster thumbnails
- Title and year
- Match percentage
- Heart rating

### Graph View

Click the **Graph** tab to see an interactive visualization:

- Movies shown as poster nodes
- Color-coded connection lines
- Hover to see why items are connected
- Click to explore deeper

See [Similarity Graphs](similarity-graphs.md) for details.

---

## Movie Insights

If this movie was recommended to you, click **Why This Pick?** to see:

### Match Score Breakdown

| Factor | Description |
|--------|-------------|
| **Taste Match** | How well it matches your preferences |
| **Discovery** | How much it expands your horizons |
| **Quality** | Community and critic ratings |
| **Variety** | How it diversifies your recommendations |

### Evidence Trail

Movies from your watch history that influenced this recommendation:

- "Because you watched X, Y, and Z..."
- Shows the connection strength
- Links to those movies

### AI Explanation

If enabled, a natural language explanation of why this was picked for you.

---

## Actions

### Rating

Click the heart to rate the movie (1-10 hearts):

- Rating affects future recommendations
- Syncs with Trakt if connected
- Shows on your dashboard

### Play

Click **Play** to open the movie in your media server app.

### Mark Unwatched

If your admin has enabled this:

- Click **Mark Unwatched** to remove from watch history
- Useful for movies you started but didn't finish
- Updates both Aperture and your media server

---

## Navigation

- Click **Back** or use browser back to return
- Click any person's name to view their page
- Click the studio to see other movies from them
- Click the collection to see the full franchise

---

**Next:** [Series Details](series-detail.md)
