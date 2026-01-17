# Library Configuration

Configure which media libraries Aperture analyzes for recommendations.

![Admin Settings - Media Server](../images/admin/admin-settings-setup-media.png)

## Accessing Settings

Navigate to **Admin → Settings → Setup → Media Server** (Libraries section)

---

## Library Overview

Libraries are the source of content for Aperture:

| Library Type | Content |
|--------------|---------|
| **Movies** | Feature films, documentaries |
| **TV Shows** | Series, episodes |

Aperture only syncs content from **enabled** libraries.

---

## Syncing Libraries

### Initial Sync

1. Click **Sync Libraries** button
2. Aperture fetches all libraries from your media server
3. Libraries appear in the list

### Refresh

Click **Sync Libraries** again to:
- Discover newly created libraries
- Update library information
- Detect deleted libraries

---

## Enabling/Disabling Libraries

### Toggle Controls

Each library shows:
- **Library name** from media server
- **Type** (Movies or TV Shows)
- **Enable toggle** (ON/OFF)

### What Enabling Does

| State | Effect |
|-------|--------|
| **Enabled** | Content synced, included in recommendations |
| **Disabled** | Content ignored, not synced |

### Changes Take Effect

After toggling:
1. Run the appropriate sync job (sync-movies or sync-series)
2. Content from newly enabled libraries is imported
3. Content from disabled libraries is removed

---

## Library Selection Strategy

### Recommended: Enable

- Primary movie library
- Primary TV shows library
- 4K/HDR variants (if separate)

### Recommended: Disable

| Library Type | Reason |
|--------------|--------|
| Kids libraries | Different taste profile |
| Music videos | Not movie/TV content |
| Home videos | Personal content |
| Training/educational | Different purpose |

### Multiple Libraries

If you have multiple libraries of the same type:

**Same content, different quality:**
- Enable all (Aperture deduplicates)
- Or enable only preferred quality

**Different content:**
- Enable all you want in recommendations
- Disable any you want excluded

---

## Library Types

### Movies

Aperture syncs:
- Movie title and year
- Genres, cast, crew
- Ratings (community, RT, Metacritic)
- Poster and backdrop images
- Runtime, resolution, audio

### TV Shows

Aperture syncs:
- Series title and year
- All seasons and episodes
- Episode metadata
- Series status (Continuing, Ended)
- Network information

---

## Sync Behavior

### What Gets Synced

| Data | Sync Behavior |
|------|---------------|
| New items | Added on next sync |
| Deleted items | Removed on next sync |
| Updated metadata | Updated on sync |
| Watch status | Separate watch history sync |

### Sync Frequency

Configure in Admin → Jobs:

| Job | Default Schedule |
|-----|------------------|
| sync-movies | Daily at 2 AM |
| sync-series | Daily at 2 AM |

### Manual Sync

Run immediately from Admin → Jobs:
1. Find `sync-movies` or `sync-series`
2. Click **Run**
3. Monitor progress

---

## Troubleshooting

### Libraries Not Appearing

**Check:**
- Media server connection is working
- Libraries exist in media server
- Click **Sync Libraries** to refresh

### Content Not Syncing

**Check:**
- Library is enabled
- Sync job completed without errors
- Content exists in the library

### Wrong Content Type

If movies appear as series or vice versa:
- Check library type in media server settings
- Recreate library with correct type
- Re-sync in Aperture

---

## Best Practices

### Naming Conventions

Clear library names help identify content:
- "Movies" not "stuff"
- "TV Shows" not "shows"
- "4K Movies" for quality variants

### Organization

| Approach | Pros | Cons |
|----------|------|------|
| Single library per type | Simple | All content in recommendations |
| Multiple libraries | Granular control | More management |
| Separate by audience | Targeted recommendations | Requires user assignment |

### Regular Maintenance

- Sync libraries weekly minimum
- Check for sync errors
- Update after major library changes

---

**Previous:** [Media Server Configuration](media-server.md) | **Next:** [File Locations](file-locations.md)
