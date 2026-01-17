# Embedding Models

Configure which AI model generates embeddings for similarity matching and recommendations.

## Accessing Settings

Navigate to **Admin → Settings → AI / LLM → Embedding Model**

---

## What Are Embeddings?

Embeddings are numerical representations of content:

- Each movie/series is converted to a vector of numbers
- Similar content has similar vectors
- Enables "find similar" and recommendation features

---

## Available Models

### OpenAI Models

| Model | Dimensions | Quality | Cost |
|-------|------------|---------|------|
| **text-embedding-3-small** | 1536 | Good | $0.02/1M tokens |
| **text-embedding-3-large** | 3072 | Best | $0.13/1M tokens |
| text-embedding-ada-002 | 1536 | Legacy | $0.10/1M tokens |

**Recommended:** `text-embedding-3-small` for most users.

### Ollama Models

| Model | Dimensions | Quality |
|-------|------------|---------|
| **nomic-embed-text** | 768 | Good |
| mxbai-embed-large | 1024 | Better |

**Recommended:** `nomic-embed-text` for local setups.

### Google AI Models

| Model | Dimensions | Quality |
|-------|------------|---------|
| **text-embedding-004** | 768 | Good |

---

## Selecting a Model

### Considerations

| Factor | Small Model | Large Model |
|--------|-------------|-------------|
| Quality | Good enough | Best |
| Cost | Lower | Higher |
| Speed | Faster | Slower |
| Storage | Less | More |

### For Most Users

Use `text-embedding-3-small`:
- Best balance of quality and cost
- Well-tested
- Sufficient for library sizes up to 10,000+

### For Quality Focus

Use `text-embedding-3-large`:
- Better similarity matching
- More nuanced recommendations
- Worth the extra cost for large libraries

### For Local/Privacy

Use `nomic-embed-text` with Ollama:
- No API costs
- Data stays local
- Good quality for most use cases

---

## Changing Models

**Warning:** Changing embedding models requires regenerating ALL embeddings.

### Process

1. Select new model
2. Click Save
3. Run `generate-movie-embeddings` job
4. Run `generate-series-embeddings` job
5. Wait for completion (can take hours for large libraries)

### Why Regeneration?

Different models produce incompatible vectors:
- Old embeddings can't be compared with new ones
- All must use the same model
- Partial regeneration causes matching failures

---

## Dimensions

Embedding dimension affects:

| Aspect | Lower Dimensions | Higher Dimensions |
|--------|------------------|-------------------|
| Quality | Less nuanced | More detailed |
| Storage | Smaller database | Larger database |
| Search speed | Faster | Slightly slower |

Aperture automatically handles dimension-specific storage.

---

## Multi-Dimension Support

Aperture supports multiple embedding dimensions:

- Embeddings stored in dimension-specific tables
- `embeddings_768`, `embeddings_1536`, `embeddings_3072`
- Automatic table selection based on model

This allows testing different models without data loss.

---

## Embedding Content

### What Gets Embedded

For each movie/series:
- Title
- Overview/description
- Genres
- Keywords (if available)
- Cast/crew highlights

### Embedding Quality

Better embeddings come from:
- Complete metadata
- Detailed descriptions
- Accurate keywords

Run enrichment jobs to improve metadata before embedding.

---

## Monitoring

### Generation Progress

During embedding jobs:
- Progress bar shows completion
- Count of items embedded
- Estimated time remaining

### Storage Usage

Check embedding storage:
- Admin → Settings → System → Database
- Shows embedding count and table sizes

---

## Troubleshooting

### "Model not available"

- Verify API key is valid
- Check model name is correct
- Ensure provider supports embeddings

### Generation Taking Too Long

- Large libraries take time
- Consider running overnight
- Check for rate limiting

### Poor Similarity Results

- Verify same model used for all content
- Check metadata quality
- Consider higher-dimension model

---

## Cost Estimation

### OpenAI Embedding Costs

| Library Size | text-embedding-3-small | text-embedding-3-large |
|--------------|------------------------|------------------------|
| 500 items | ~$0.10 | ~$0.65 |
| 2,000 items | ~$0.40 | ~$2.60 |
| 10,000 items | ~$2.00 | ~$13.00 |

*Approximate, depends on description length.*

### Local (Ollama)

- No API costs
- Hardware costs (electricity, GPU)
- Time investment

---

**Previous:** [AI Providers](ai-providers.md) | **Next:** [Text Generation Models](text-models.md)
