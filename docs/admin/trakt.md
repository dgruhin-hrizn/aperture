# Trakt Integration

Connect Aperture to Trakt.tv for bidirectional rating sync and enhanced Discovery suggestions.

## Accessing Settings

Navigate to **Admin → Settings → Setup → Integrations**

---

## What Trakt Provides

| Feature | Description |
|---------|-------------|
| **Rating Sync** | Ratings sync between Aperture and Trakt |
| **Discovery Source** | Trakt personalized recommendations |
| **Trending Data** | Trakt trending/popular content |
| **User Watchlists** | Access to Trakt watchlists |

---

## Server Configuration

### Creating a Trakt Application

1. Go to [trakt.tv/oauth/applications](https://trakt.tv/oauth/applications)
2. Click **New Application**
3. Fill in the form:

| Field | Value |
|-------|-------|
| Name | Aperture |
| Description | AI movie recommendations |
| Redirect URI | `urn:ietf:wg:oauth:2.0:oob` |

4. Click **Save App**
5. Copy the **Client ID** and **Client Secret**

### Entering Credentials in Aperture

1. Navigate to Admin → Settings → Setup → Integrations
2. Find the Trakt section
3. Enter:
   - **Client ID** from your Trakt app
   - **Client Secret** from your Trakt app
4. Click **Save**

---

## User Connection

After admin configuration, users connect their individual Trakt accounts:

### User Steps

1. Go to **User Settings → Profile**
2. Find Trakt section
3. Click **Connect Trakt**
4. Authorize in Trakt popup
5. Connection confirmed

### What Happens

- User's Trakt account linked to their Aperture account
- Ratings begin syncing
- Trakt becomes a Discovery source for that user

---

## Rating Sync

### How It Works

| Direction | Behavior |
|-----------|----------|
| Aperture → Trakt | Immediate push when user rates |
| Trakt → Aperture | Periodic sync (configurable) |

### Rating Scale

Both use 10-point scales - direct 1:1 mapping.

### Sync Job

The `sync-trakt-ratings` job handles Trakt → Aperture sync:

- Default schedule: Every 2 hours
- Configure in Admin → Jobs

### Conflict Resolution

If a rating exists in both:
- Most recent rating wins
- Timestamps are compared

---

## Discovery Integration

When users have Trakt connected:

### Additional Discovery Sources

| Source | Description |
|--------|-------------|
| **Trakt Trending** | Currently trending on Trakt |
| **Trakt Popular** | All-time popular |
| **Trakt Recommended** | Personalized for user's Trakt history |

### Enhanced Matching

Discovery considers:
- User's Trakt watch history
- Trakt ratings
- Similar users' preferences

---

## Troubleshooting

### "Invalid credentials"

- Verify Client ID and Secret are correct
- Check for extra spaces when copying
- Ensure Trakt app is still active

### Ratings Not Syncing

1. Check user has connected their account
2. Verify `sync-trakt-ratings` job is running
3. Check job logs for errors
4. Ensure rate limits aren't exceeded

### User Can't Connect

- Admin must configure Client ID/Secret first
- Check Trakt redirect URI is correct
- Try different browser if popup blocked

---

## Rate Limits

Trakt API limits:
- 1,000 requests per 5 minutes
- Aperture queues requests appropriately

If rate limited:
- Wait for reset period
- Job will retry automatically

---

## Privacy Considerations

### What Aperture Accesses

- User's ratings
- User's watch history (for Discovery)
- User's Trakt recommendations

### What's Shared with Trakt

- Ratings made in Aperture (pushed to Trakt)

### Disconnecting

Users can disconnect anytime:
1. User Settings → Profile
2. Click **Disconnect Trakt**
3. All sync stops
4. Existing ratings in Aperture preserved

---

**Previous:** [Integrations Overview](integrations-overview.md) | **Next:** [TMDb Integration](tmdb.md)
