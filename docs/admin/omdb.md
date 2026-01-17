# OMDb Integration

Connect to the Open Movie Database (OMDb) for Rotten Tomatoes and Metacritic scores.

## Accessing Settings

Navigate to **Admin → Settings → Setup → Integrations**

---

## What OMDb Provides

| Data | Description |
|------|-------------|
| **Rotten Tomatoes Score** | Critic aggregate percentage |
| **Metacritic Score** | Weighted critic average |
| **Awards** | Oscar/Emmy information |
| **Box Office** | Revenue data |

---

## Why OMDb?

Rotten Tomatoes and Metacritic don't offer public APIs. OMDb aggregates this data legally and provides it via API.

### Score Types

| Score | Scale | Meaning |
|-------|-------|---------|
| **Rotten Tomatoes** | 0-100% | Percentage of positive reviews |
| **Metacritic** | 0-100 | Weighted average of reviews |

---

## Getting an API Key

### Free Tier

1. Go to [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx)
2. Select **FREE! (1,000 daily limit)**
3. Enter your email
4. Verify email and get key

### Paid Tiers

| Tier | Daily Limit | Price |
|------|-------------|-------|
| Free | 1,000 | $0 |
| Patreon Basic | 100,000 | $1/month |
| Patreon Premium | Unlimited | $5/month |

For larger libraries, consider a paid tier.

---

## Configuration

1. Navigate to Admin → Settings → Setup → Integrations
2. Find OMDb section
3. Enter your **API Key**
4. Click **Test Connection**
5. Click **Save**

---

## Enrichment

OMDb data is fetched during the `enrich-metadata` job:

### What Happens

1. Movies without RT/Metacritic scores identified
2. OMDb queried for each
3. Scores stored in database

### Running Enrichment

- **Automatic:** Every 6 hours (default)
- **Manual:** Admin → Jobs → enrich-metadata → Run

---

## Using Scores

### Browse Filtering

On the Browse page, users can filter by:
- Minimum Rotten Tomatoes score
- Minimum Metacritic score

### Display

Scores appear:
- On movie/series detail pages
- In list view mode
- In Discovery cards

### Recommendations

Scores can influence recommendations:
- Higher-rated content may rank higher
- Depends on algorithm weight for "Rating"

---

## Coverage

### Movies

OMDb has good coverage for:
- Hollywood releases
- International theatrical releases
- Popular indie films

Limited coverage for:
- Direct-to-video releases
- Very old films
- Obscure titles

### TV Series

OMDb covers:
- Major network shows
- Popular streaming originals
- Some cable series

Limited for:
- Web series
- Foreign TV
- Reality shows

---

## Rate Limits

### Free Tier

- 1,000 requests per day
- Resets at midnight UTC

### Handling Limits

If rate limited:
- Job pauses until reset
- Enrichment continues next day
- No data loss

### Monitoring Usage

Check job logs for rate limit messages.

---

## Troubleshooting

### "Invalid API key"

- Verify key is correct
- Check if key was activated (email verification)
- Ensure you're using the correct key format

### Scores Not Appearing

1. Run enrichment job
2. Check job completed without errors
3. Verify OMDb has data for that title

### Rate Limited Frequently

- Upgrade to paid tier
- Reduce enrichment frequency
- Prioritize which content gets enriched

---

## Data Accuracy

### Freshness

OMDb updates scores periodically:
- New releases update frequently
- Older titles update less often

### Discrepancies

Slight differences from RT/Metacritic websites possible:
- Timing differences
- Rounding variations

---

**Previous:** [TMDb Integration](tmdb.md) | **Next:** [MDBList Integration](mdblist.md)
