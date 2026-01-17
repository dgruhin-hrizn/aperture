# TMDb Integration

Connect to The Movie Database (TMDb) for enhanced metadata enrichment.

## Accessing Settings

Navigate to **Admin → Settings → Setup → Integrations**

---

## What TMDb Provides

| Data | Description |
|------|-------------|
| **Keywords** | Thematic tags (mind-bending, based on true story) |
| **Collections** | Franchise groupings (MCU, Star Wars) |
| **Cast/Crew** | Detailed credits with photos |
| **Backdrop Images** | High-quality fanart |
| **Translations** | Localized titles and descriptions |
| **Release Dates** | Regional release information |

---

## Getting an API Key

TMDb offers free API access for non-commercial use.

### Steps

1. Create account at [themoviedb.org](https://www.themoviedb.org/)
2. Go to Account Settings → API
3. Click **Create** under "Request an API Key"
4. Choose **Developer** type
5. Fill in application details:

| Field | Value |
|-------|-------|
| Application Name | Aperture |
| Application URL | Your Aperture URL (or localhost) |
| Description | Personal media recommendation system |

6. Accept terms and submit
7. Copy the **API Key (v3 auth)**

### API Key Types

| Type | Use |
|------|-----|
| **v3 auth (API Key)** | What Aperture uses |
| **v4 auth (Read Access Token)** | Not needed |

---

## Configuration

1. Navigate to Admin → Settings → Setup → Integrations
2. Find TMDb section
3. Enter your **API Key**
4. Click **Test Connection**
5. Click **Save**

---

## Enrichment Job

TMDb data is fetched by the `enrich-metadata` job:

### What It Does

1. Identifies movies/series without TMDb metadata
2. Searches TMDb for matches
3. Downloads keywords, collections, credits
4. Stores in Aperture database

### Running Enrichment

- **Automatic:** Every 6 hours (default)
- **Manual:** Admin → Jobs → enrich-metadata → Run

### Priority

Items are enriched in order:
1. Recently added content
2. Items missing keywords
3. Items missing collections

---

## Data Usage

### Keywords in Recommendations

Keywords improve recommendation matching:

> "Mind-bending" keyword connects Inception, Memento, The Matrix

### Collections for Franchises

Collections group related films:

> MCU Collection contains all Marvel movies

### Credits for People Pages

Detailed cast/crew enable:
- Actor filmographies
- Director pages
- "More from this actor" suggestions

---

## Troubleshooting

### "Invalid API key"

- Verify key is correct (no spaces)
- Check key is v3 type
- Ensure account is verified

### Enrichment Not Running

- Check job schedule in Admin → Jobs
- Verify API key is saved
- Look for rate limit errors in logs

### Missing Data

Not all TMDb entries have complete data:
- Keywords may be sparse for older/obscure titles
- Some items may not exist in TMDb
- Regional content may have limited metadata

---

## Rate Limits

TMDb limits:
- 40 requests per 10 seconds
- Aperture respects this automatically
- Large enrichment jobs take time

---

## Matching Accuracy

TMDb matches using:
1. **TMDb ID** if available from media server
2. **IMDb ID** as fallback
3. **Title + Year** as last resort

### Improving Matches

- Ensure media has correct year
- Use IMDb IDs in filenames if possible
- Check for typos in titles

---

**Previous:** [Trakt Integration](trakt.md) | **Next:** [OMDb Integration](omdb.md)
