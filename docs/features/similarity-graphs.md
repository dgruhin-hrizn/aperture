# Similarity Graphs

Similarity graphs appear on movie and series detail pages, showing related content in an interactive visualization.

![Movie Detail Page](../images/features/movie-detail.png)

## Accessing Similarity Graphs

1. Navigate to any movie or series detail page
2. Scroll to the "Similar Movies" or "Similar Series" section
3. Click the **Graph** tab (vs **List**)

---

## Graph vs List View

### Similar Items Section

This section shows two views:

| Tab | Display |
|-----|---------|
| **List** | Traditional grid/list of similar items |
| **Graph** | Interactive node-based visualization |

Toggle between them to suit your preference.

---

## Graph Features

### Nodes

Each node represents a movie or series:

| Element | Description |
|---------|-------------|
| **Image** | Poster thumbnail |
| **Border** | Color indicates connection type |
| **Size** | Larger = higher similarity |
| **Glow** | Current selection highlighted |

### Edges

Lines connecting nodes show relationships:

| Line Style | Meaning |
|------------|---------|
| **Solid thick** | Strong connection |
| **Solid thin** | Moderate connection |
| **Dashed** | Weak but present connection |

### Colors

Connection type indicated by color:

| Color | Relationship |
|-------|--------------|
| **Blue** | Shared cast members |
| **Green** | Shared director/creator |
| **Orange** | Genre similarity |
| **Purple** | Thematic similarity |
| **Gray** | Embedding similarity |

---

## Interaction

### Hover

Hover over a node to see:

- Title and year
- Similarity percentage
- Connection reason
- Your rating (if rated)

### Click

Click a node to:

- Navigate to that item's detail page
- Or view in sidebar panel (depending on settings)

### Drag

Drag nodes to rearrange the visualization:

- Organize the layout
- Separate clusters
- Better understand relationships

### Zoom

- **Scroll** — Zoom in/out
- **Pinch** (touch) — Zoom in/out
- **Double-click** — Reset zoom

---

## Understanding Connections

### Why Items Connect

The graph shows various relationship types:

#### Cast Connections
> "Both feature Tom Hanks in a leading role"

#### Director Connections
> "Both directed by Steven Spielberg"

#### Genre Connections
> "Both are psychological thrillers"

#### Thematic Connections
> "Both explore themes of isolation and survival"

#### Embedding Similarity
> "AI detected similar narrative patterns and tone"

### Connection Strength

Stronger connections have:

- Thicker lines
- Closer proximity
- Multiple edge types (multi-colored)

---

## Using Similarity Graphs

### Quick Discovery

See at a glance what's related to something you like.

### Understanding "Why"

Hover over edges to see exactly why items are connected.

### Finding Patterns

Notice clusters of similar content and understand the threads.

### Rating from Graph

Click a node, then rate it in the detail panel without leaving the page.

---

## Settings

Similarity graph behavior can be customized in [Preferences](user-settings/preferences.md):

| Setting | Effect |
|---------|--------|
| **Auto-expand** | Graph starts expanded or collapsed |
| **Hide watched** | Exclude items you've seen |
| **Connection types** | Which relationships to show |

---

## Performance

For items with many connections:

- Graph limits displayed nodes
- Strongest connections shown first
- "Load more" option for additional nodes
- Performance scales with your device

---

## Comparison: Graph vs Explore

| Feature | Similarity Graph | Explore |
|---------|------------------|---------|
| **Scope** | Single item's connections | Entire library |
| **Location** | Detail page section | Dedicated page |
| **Depth** | One level | Unlimited drilling |
| **Purpose** | Quick similar items | Extended discovery |

Use similarity graphs for quick "what's similar" answers.
Use Explore for extended discovery sessions.

---

**Next:** [Shows You Watch](shows-you-watch.md)
