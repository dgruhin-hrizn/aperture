# Collapsible Sidebar

The sidebar can be collapsed to save screen space while maintaining quick navigation access.

## Collapsing the Sidebar

### Toggle Methods

Multiple ways to collapse/expand:

| Method | Action |
|--------|--------|
| **Menu icon** | Click the hamburger (☰) icon at the top of sidebar |
| **Logo click** | Click the Aperture logo in the sidebar |
| **Keyboard** | Press `[` to toggle (if keyboard shortcuts enabled) |

### Visual States

| State | Appearance |
|-------|------------|
| **Expanded** | Full sidebar with icons and text labels |
| **Collapsed** | Narrow sidebar with icons only |

---

## Collapsed Mode

### Navigation

In collapsed mode:

- Icons remain visible
- Text labels hidden
- Click icons to navigate
- Hover for tooltips

### Tooltips

When collapsed, hovering over any icon shows:

- Page name tooltip
- Brief description (for some items)
- Appears after short delay

### Active Page Indicator

The current page is indicated by:

- Highlighted icon background
- Slightly larger icon size
- Color accent

---

## Persistence

### Your Preference Saved

Your collapsed/expanded preference is:

- Saved to your account
- Synced across devices
- Remembered between sessions

### How It's Stored

The preference is stored in your user settings:

- Server-side storage
- Part of your UI preferences
- Updates immediately on change

### Resetting

To reset to default (expanded):

1. Go to Settings → Preferences
2. Click "Reset UI Preferences"
3. Or manually expand the sidebar

---

## Mobile Behavior

### Drawer Mode

On mobile devices:

- Sidebar becomes a drawer
- Opens with hamburger menu tap
- Closes when you navigate
- Swipe to close

### Mobile Collapsed State

The collapsed preference affects mobile:

- **Collapsed** — Drawer is narrow when opened
- **Expanded** — Drawer is full-width when opened

### Responsive Breakpoints

| Screen Size | Sidebar Behavior |
|-------------|------------------|
| Desktop (1024px+) | Always visible, respects collapsed state |
| Tablet (768-1023px) | Drawer mode, opens on demand |
| Mobile (<768px) | Drawer mode, hamburger in header |

---

## Content Area

### Space Reallocation

When sidebar collapses:

- Content area expands to fill space
- Grids may show additional columns
- Images may display larger

### Transition

Smooth animation between states:

- Sidebar slides in/out
- Content reflows smoothly
- No jarring layout shifts

---

## Sidebar Contents

### Navigation Items

From top to bottom:

| Item | Icon | Purpose |
|------|------|---------|
| Dashboard | 🏠 | Home with stats and carousels |
| Recommendations | ✨ | Your AI picks |
| Shows You Watch | 📺 | Tracked series |
| Top Picks | 🔥 | Trending content |
| Playlists | 📝 | Your collections |
| Explore | 🕸️ | AI graph exploration |
| Discover | 🧭 | Find new content |
| Browse | 🎬 | Library browser |
| Watch History | 🕐 | Your viewing log |
| Watch Stats | 📊 | Analytics |

### Admin Items

Admins see additional items:

| Item | Purpose |
|------|---------|
| Admin Dashboard | Server overview |
| Users | User management |
| Jobs | Background tasks |
| Settings | Server configuration |

---

## Customization

### Currently Available

- Collapse/expand toggle
- Preference persistence

### Not Currently Customizable

- Icon order
- Hiding specific items
- Custom navigation items

These may be added in future versions.

---

## Tips

### When to Collapse

- **Browsing content** — More space for posters
- **Small screens** — Maximize content area
- **Focused work** — Fewer distractions

### When to Expand

- **Learning the app** — Labels help orientation
- **Infrequent use** — Quick reminder of options
- **Large monitors** — Space isn't constrained

### Keyboard Navigation

When collapsed, you can still use:

- Tab to move between icons
- Enter to select
- Arrow keys in some contexts

---

**Next:** [Grid & List Views](grid-list-views.md)
