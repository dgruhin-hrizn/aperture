# AI Explanations

Configure whether AI-generated explanations appear with recommendations.

![Admin Settings - AI Recommendations](../images/admin/admin-settings-ai-recommendations.png)

## Accessing Settings

Navigate to **Admin → Settings → AI Recommendations → AI Features**

---

## What Are AI Explanations?

Natural language text explaining why each item was recommended:

> "This psychological thriller shares the mind-bending narrative structure and atmospheric tension you enjoyed in Christopher Nolan's work, with a similarly complex protagonist navigating reality-bending circumstances."

---

## Where Explanations Appear

| Location | Display |
|----------|---------|
| **Aperture UI** | "Why This Pick?" section |
| **NFO Files** | Plot field in metadata |
| **Media Server** | Description when browsing |

---

## Configuration

### Global Toggle

| Setting | Effect |
|---------|--------|
| **Enabled** | Explanations generated for all users |
| **Disabled** | No explanations generated |

### User Override Permission

When enabled, admins can grant specific users the ability to toggle their own preference.

| Setting | Effect |
|---------|--------|
| **Allowed** | Users can enable/disable in their settings |
| **Not Allowed** | Global setting applies to all |

---

## Per-User Configuration

### Admin Configuration

On each user's detail page (Admin → Users → [User]):

| Setting | Effect |
|---------|--------|
| **Allow Override** | User can toggle their own preference |
| **Force Enabled** | Explanations always generated |
| **Force Disabled** | Explanations never generated |

### User Configuration

If override is allowed, users configure in:
User Settings → Preferences → AI Explanations

---

## Generation Process

### When Generated

Explanations are created during recommendation jobs:
- `generate-movie-recommendations`
- `generate-series-recommendations`

### What's Included

Each explanation considers:
- User's watch history
- Similar content connections
- Genre matches
- Actor/director overlap
- Thematic similarities

### Batch Processing

Aperture generates explanations in batches:

| Provider | Batch Size | Tokens |
|----------|------------|--------|
| Large context (OpenAI) | 10 items | 3,000 |
| Medium context (Groq) | 5 items | 1,500 |
| Small context (Ollama) | 3 items | 1,000 |

---

## Cost Impact

### With Explanations

| Library Size | Users | Additional Cost |
|--------------|-------|-----------------|
| 50 recs | 5 | ~$0.10-$0.50 |
| 50 recs | 20 | ~$0.40-$2.00 |

### Without Explanations

No additional text generation costs.

---

## Quality Factors

### Better Explanations

- More detailed metadata
- Complete watch history
- Rich keyword data
- More capable AI model

### Explanation Examples

**Good (rich metadata):**
> "Based on your appreciation for psychological thrillers with unreliable narrators like Memento and Shutter Island, this film offers a similar exploration of fractured memory and identity..."

**Basic (limited metadata):**
> "This thriller matches your interest in suspenseful movies with twist endings."

---

## Troubleshooting

### Explanations Not Appearing

1. Check global setting is enabled
2. Verify user override allows it
3. Confirm recommendation job ran after enabling
4. Check AI model is configured

### Poor Quality Explanations

- Upgrade to better AI model
- Improve metadata via enrichment
- Ensure watch history is synced

### Explanations Too Long/Short

AI automatically adjusts, but consider:
- Different model may produce different length
- Batch size affects available tokens

---

## Disabling for Performance

If recommendation jobs are slow:

1. Disable explanations globally
2. Run recommendations
3. Jobs complete faster
4. Re-enable later if desired

Explanations are the slowest part of recommendation generation.

---

## Privacy Considerations

Explanations are generated using:
- User's watch history
- Rated content
- Viewing patterns

This data is sent to AI provider (unless using local Ollama).

---

**Previous:** [Library Titles](library-titles.md) | **Next:** [Algorithm Tuning](algorithm-tuning.md)
