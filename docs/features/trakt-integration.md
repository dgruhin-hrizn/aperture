# Trakt Integration

Connect your Trakt.tv account to sync ratings, access personalized Discovery suggestions, and maintain a unified viewing history.

## What Is Trakt?

[Trakt.tv](https://trakt.tv) is a platform that tracks what you watch across all your devices and services. Connecting Trakt to Aperture enables:

- **Rating sync** — Ratings flow between Aperture and Trakt
- **Discovery source** — Trakt's personalized recommendations
- **Unified history** — Watch history from all sources

---

## Connecting Trakt

### Prerequisites

1. A Trakt.tv account (free tier works)
2. Admin must have enabled Trakt integration
3. Trakt API configured on your server

### Connection Steps

1. Go to **Settings** → **Profile**
2. Find the **Trakt** section
3. Click **Connect Trakt**
4. You'll be redirected to Trakt
5. Log in to Trakt (if not already)
6. Authorize Aperture
7. Redirected back to Aperture
8. Connection confirmed

### Verification

After connecting, you'll see:

- Green "Connected" indicator
- Your Trakt username
- Last sync timestamp

---

## Rating Sync

### How It Works

Ratings synchronize bidirectionally:

| Action | Result |
|--------|--------|
| Rate in Aperture | Pushed to Trakt |
| Rate in Trakt | Pulled to Aperture |
| Change rating in either | Synced to the other |

### Rating Scale

Both use 10-point scales:

| Aperture | Trakt |
|----------|-------|
| 1-10 hearts | 1-10 rating |

Direct 1:1 mapping, no conversion needed.

### Sync Timing

- **Aperture → Trakt:** Immediate (on rating)
- **Trakt → Aperture:** Periodic sync (typically hourly)
- **Manual sync:** Available in settings

---

## Discovery Integration

### Trakt as Discovery Source

When connected, Discovery includes Trakt sources:

| Source | Description |
|--------|-------------|
| **Trakt Trending** | Currently popular on Trakt |
| **Trakt Popular** | All-time popular |
| **Trakt Recommended** | Personalized for your Trakt history |

### Personalized Recommendations

Trakt's recommendations are based on:

- Your Trakt watch history (all services)
- Your Trakt ratings
- Similar users' preferences

This supplements Aperture's library-based suggestions.

### Source Badges

In Discovery, items show their source:

- 🎬 TMDb source
- 📺 Trakt Trending
- ⭐ Trakt Recommended

---

## Watch History

### What Syncs

Your watch history from Trakt includes watches from:

- Other media servers
- Streaming services (via Trakt scrobbling)
- Manual entries

### How It's Used

Aperture considers Trakt history for:

- Excluding already-watched content
- Building your taste profile
- Discovery filtering

### Privacy Note

Your Trakt history remains on Trakt. Aperture reads it but doesn't store a complete copy.

---

## Disconnecting Trakt

### How to Disconnect

1. Go to **Settings** → **Profile**
2. Find the **Trakt** section
3. Click **Disconnect**
4. Confirm the action

### What Happens

- No more rating sync
- Trakt Discovery sources disabled
- Existing ratings in Aperture preserved
- Trakt account unchanged

### Reconnecting

You can reconnect at any time by following the original connection steps.

---

## Troubleshooting

### "Connection Failed"

| Cause | Solution |
|-------|----------|
| Trakt is down | Wait and retry |
| Admin hasn't configured Trakt | Ask admin to set up |
| Authorization denied | Try connecting again |

### Ratings Not Syncing

1. Check connection status in Settings
2. Try manual sync if available
3. Verify rating exists in both places
4. Check Trakt API status

### Missing Discovery Suggestions

- Trakt suggestions require watch history on Trakt
- New accounts may have fewer personalized picks
- Check if Trakt is enabled as a Discovery source

---

## Privacy & Data

### What Aperture Accesses

- Your Trakt username (public)
- Your ratings (to sync)
- Your watch history (read-only)
- Your Trakt recommendations (read-only)

### What Aperture Doesn't Access

- Your Trakt password
- Your Trakt social connections
- Your private lists (unless you share)

### Revoking Access

You can revoke Aperture's access from Trakt:

1. Go to Trakt.tv
2. Settings → Applications
3. Find Aperture
4. Click Revoke

This immediately stops all sync.

---

## Benefits Summary

| Feature | Without Trakt | With Trakt |
|---------|---------------|------------|
| Ratings | Local only | Synced everywhere |
| Discovery | TMDb only | TMDb + Trakt |
| Watch history | Media server only | All sources |
| Cross-device | No | Yes |

---

**Next:** [Collapsible Sidebar](collapsible-sidebar.md)
