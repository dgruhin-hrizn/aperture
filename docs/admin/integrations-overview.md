# Integrations Overview

Aperture integrates with several external services to enhance metadata, enable rating sync, and power discovery features.

## Accessing Settings

Navigate to **Admin → Settings → Setup → Integrations**

---

## Available Integrations

| Integration | Purpose | Required |
|-------------|---------|----------|
| [Trakt](trakt.md) | Rating sync, watchlist sync | Optional |
| [TMDb](tmdb.md) | Metadata enrichment | Recommended |
| [OMDb](omdb.md) | Rotten Tomatoes, Metacritic scores | Optional |
| [MDBList](mdblist.md) | Curated lists, Top Picks source | Optional |
| [Jellyseerr](jellyseerr.md) | Discovery requests | Optional |

---

## Integration Priority

### Essential

| Integration | Why |
|-------------|-----|
| **AI Provider** | Powers all AI features (configured in AI/LLM tab) |

### Highly Recommended

| Integration | Why |
|-------------|-----|
| **TMDb** | Best metadata source, keywords, collections |

### Recommended

| Integration | Why |
|-------------|-----|
| **OMDb** | RT and Metacritic scores for better filtering |
| **Trakt** | Rating sync if users use Trakt |

### Optional

| Integration | Why |
|-------------|-----|
| **MDBList** | Only needed for MDBList-based Top Picks |
| **Jellyseerr** | Only needed for Discovery request feature |

---

## Configuration Status

Each integration shows status indicators:

| Status | Meaning |
|--------|---------|
| ✓ Connected | Integration working |
| ⚠ Warning | Configuration issue |
| ✗ Not configured | API key missing |
| 🔄 Testing | Connection test in progress |

---

## API Error Alerts

Integration errors are displayed prominently:

### Error Types

| Type | Severity | Action Needed |
|------|----------|---------------|
| **Authentication** | Error | Check/update API key |
| **Rate Limit** | Warning | Wait for reset |
| **Service Outage** | Info | Automatic recovery |

### Auto-Dismiss

Service outage alerts automatically clear when:
- Connection test succeeds
- Service recovers

See [API Errors](api-errors.md) for details.

---

## Integration Data Flow

```
Media Server → Aperture → TMDb (metadata)
                       → OMDb (scores)
                       → Trakt (ratings)
                       → MDBList (rankings)
                       → Jellyseerr (requests)
```

### What Each Integration Provides

**TMDb:**
- Keywords and themes
- Collections/franchises
- Cast and crew details
- Backdrop images

**OMDb:**
- Rotten Tomatoes critic score
- Metacritic score
- Awards information

**Trakt:**
- User ratings (bidirectional)
- Watchlist sync
- Discovery suggestions

**MDBList:**
- Curated movie/TV lists
- Popularity rankings
- Genre-specific lists

**Jellyseerr:**
- Request management
- Availability status
- User request permissions

---

## Setup Order

Recommended setup order for new installations:

1. **AI Provider** (required for core features)
2. **TMDb** (enhances metadata immediately)
3. **OMDb** (adds critic scores)
4. **Trakt** (if users use Trakt)
5. **MDBList** (if using for Top Picks)
6. **Jellyseerr** (if using Discovery)

---

## API Key Management

### Security

- API keys are stored encrypted in the database
- Never exposed in logs or UI after saving
- Use service-specific keys (not personal)

### Key Rotation

To rotate an API key:
1. Generate new key in the service
2. Update in Aperture settings
3. Test connection
4. Revoke old key in the service

### Rate Limits

| Service | Typical Limits |
|---------|----------------|
| TMDb | 40 requests/10 seconds |
| OMDb | 1,000/day (free), unlimited (paid) |
| Trakt | 1,000/5 minutes |
| MDBList | Varies by tier |

Aperture respects rate limits and queues requests appropriately.

---

## Troubleshooting

### Integration Not Working

1. Check API key is entered correctly
2. Click **Test Connection**
3. Review error message
4. Check service status (may be down)

### Rate Limited

- Wait for rate limit reset
- Check if job is making excessive requests
- Consider upgrading API tier

### Data Not Updating

- Run enrichment job manually
- Check job logs for errors
- Verify integration is connected

---

## Disabling Integrations

To disable an integration:
1. Clear the API key field
2. Click Save
3. Features depending on that integration become unavailable

### Impact of Disabling

| Integration | Impact When Disabled |
|-------------|---------------------|
| TMDb | No keyword/collection enrichment |
| OMDb | No RT/Metacritic scores |
| Trakt | No rating sync |
| MDBList | Can't use MDBList for Top Picks |
| Jellyseerr | No request functionality |

---

**Previous:** [File Locations](file-locations.md) | **Next:** [Trakt Integration](trakt.md)
