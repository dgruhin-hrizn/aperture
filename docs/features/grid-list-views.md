# Grid & List Views

Most content pages offer two display modes: Grid View and List View. Your preference is saved per page.

## Overview

### Where Views Are Available

| Page | Grid View | List View |
|------|-----------|-----------|
| Browse (Movies/Series) | ✓ | ✓ |
| Recommendations | ✓ | ✓ |
| Top Picks | ✓ | ✓ |
| Discovery | ✓ | ✓ |
| Watch History | ✓ | ✓ |
| Shows You Watch | ✓ | ✓ |

### Toggle Location

The view toggle appears in the page header:

- **Position:** Right side, after page title
- **Icons:** Grid icon (▦) and List icon (≡)
- **Current view:** Highlighted/filled icon

---

## Grid View

### Layout

Content displayed as a poster grid:

```
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│        │ │        │ │        │ │        │
│ Poster │ │ Poster │ │ Poster │ │ Poster │
│        │ │        │ │        │ │        │
└────────┘ └────────┘ └────────┘ └────────┘
  Title      Title      Title      Title

┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│        │ │        │ │        │ │        │
...
```

### Information Shown

Each grid item displays:

| Element | Location | Always Visible |
|---------|----------|----------------|
| Poster | Main area | Yes |
| Title | Below poster | Yes |
| Year | Below title | Yes |
| Rating badge | Top corner | On hover |
| Heart rating | Overlay | On hover |
| Rank badge | Top-left | Yes (where applicable) |

### Hover State

Hovering reveals additional info:

- Heart rating overlay
- Quick action buttons
- Additional metadata
- Visual highlight

### Best For

- **Visual browsing** — Scan many posters quickly
- **Recognition** — Find by poster image
- **Dense display** — Maximum items visible
- **Mobile** — Touch-friendly targets

---

## List View

### Layout

Content displayed as detailed rows:

```
┌──────────────────────────────────────────────────────┐
│ ┌────┐                                               │
│ │    │ Title (Year)              Rating: ★★★★☆      │
│ │    │ Genre • Runtime • Network                     │
│ │    │ Synopsis preview text that can span multiple  │
│ │    │ lines and show more detail about the content..│
│ └────┘                                    [♥ Rate]   │
└──────────────────────────────────────────────────────┘
```

### Information Shown

Each list item displays:

| Element | Description |
|---------|-------------|
| Thumbnail | Small poster |
| Title & Year | Primary identification |
| Genres | Category chips |
| Runtime/Seasons | Duration info |
| Community Rating | Star rating |
| Synopsis | Plot overview |
| Your Rating | Heart rating component |
| Page-specific data | Varies by page |

### Page-Specific Columns

| Page | Additional Info |
|------|-----------------|
| Browse | Resolution, Content Rating |
| Recommendations | Match %, Evidence |
| Top Picks | Viewers, Play Count |
| Discovery | Source, Request Status |
| Watch History | Last Watched, Play Count |
| Shows You Watch | Next Episode, Days Until |

### Best For

- **Detailed comparison** — More info at a glance
- **Reading synopses** — See what it's about
- **Metadata review** — Check ratings, runtime
- **Keyboard navigation** — Tab through rows

---

## Preference Persistence

### How It Works

1. Toggle to your preferred view
2. Preference saves automatically
3. Next visit uses saved preference
4. Per-page: each page remembers independently

### Storage

Preferences stored in your account:

- **Server-side** — Syncs across devices
- **Per-page** — Each page has its own setting
- **Instant save** — No explicit save needed

### Default View

If no preference saved:

- **Grid View** is the default
- New pages start in Grid
- Change to set your preference

### Resetting Preferences

To reset all views to Grid:

1. Go to Settings → Preferences
2. Click "Reset View Preferences"
3. All pages return to Grid default

---

## Responsive Behavior

### Grid View Responsiveness

| Screen Size | Columns |
|-------------|---------|
| Large (1400px+) | 6-8 columns |
| Desktop (1024-1399px) | 4-6 columns |
| Tablet (768-1023px) | 3-4 columns |
| Mobile (< 768px) | 2-3 columns |

### List View Responsiveness

| Screen Size | Behavior |
|-------------|----------|
| Desktop | Full row with all columns |
| Tablet | Condensed, some columns hidden |
| Mobile | Stacked layout, essential info only |

### Mobile Considerations

- Grid often better for mobile (easier tapping)
- List view truncates on small screens
- Both remain functional at all sizes

---

## Performance

### Grid View

- Loads poster images
- Lazy loading for off-screen items
- Efficient for browsing many items

### List View

- Loads smaller thumbnails
- More text content
- May feel faster to load
- Better for slower connections

### Infinite Scroll

Both views support infinite scroll:

- Scroll to bottom
- More items load automatically
- Progress indicator shown
- Works identically in both views

---

## Interaction Differences

### Rating

| View | Rating Method |
|------|---------------|
| Grid | Hover → Click heart overlay |
| List | Click inline heart component |

Both open the same rating picker.

### Navigation

| View | Click Behavior |
|------|----------------|
| Grid | Click poster → Detail page |
| List | Click row → Detail page |

### Hover Effects

| View | Hover Shows |
|------|-------------|
| Grid | Overlay with actions, slight zoom |
| List | Row highlight, action buttons |

---

## Tips

### Choosing the Right View

| Situation | Recommended |
|-----------|-------------|
| Browsing for something to watch | Grid |
| Comparing similar items | List |
| Working with filters | Either |
| Mobile browsing | Grid |
| Quick ratings session | List |
| Exploring unfamiliar content | List |

### Switching Mid-Session

- Toggle freely while browsing
- Scroll position may adjust
- Filters and sort preserved
- Selection state maintained

---

**Previous:** [Collapsible Sidebar](collapsible-sidebar.md)
