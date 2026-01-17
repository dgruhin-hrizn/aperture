# Text Generation Models

Configure which AI model generates taste profiles and recommendation explanations.

![Admin Settings - AI/LLM](../images/admin/admin-settings-ai-llm.png)

## Accessing Settings

Navigate to **Admin → Settings → AI / LLM → Text Generation Model**

---

## What Text Generation Does

| Feature | Description |
|---------|-------------|
| **Taste Profiles** | Generates user identity descriptions |
| **Explanations** | Creates "Why this pick?" text |
| **Playlist Names** | AI-generated playlist titles |
| **Playlist Descriptions** | AI-generated playlist summaries |

---

## Available Models

### OpenAI Models

| Model | Quality | Cost | Context |
|-------|---------|------|---------|
| **gpt-4o-mini** | Good | Low | 128K |
| gpt-4o | Best | High | 128K |
| gpt-4-turbo | Great | Medium | 128K |

**Recommended:** `gpt-4o-mini` for most users.

### Ollama Models

| Model | Quality | Speed |
|-------|---------|-------|
| **llama3.2** | Good | Medium |
| mistral | Good | Fast |
| mixtral | Better | Slower |

### Groq Models

| Model | Quality | Speed |
|-------|---------|-------|
| **llama3-8b-8192** | Good | Very Fast |
| llama3-70b-8192 | Better | Fast |

### Anthropic Models

| Model | Quality | Cost |
|-------|---------|------|
| **claude-3-haiku** | Good | Low |
| claude-3-sonnet | Better | Medium |
| claude-3-opus | Best | High |

---

## Selecting a Model

### For Most Users

Use `gpt-4o-mini`:
- Best balance of quality and cost
- Large context window
- Reliable output format

### For Quality Focus

Use `gpt-4o` or `claude-3-sonnet`:
- Better writing quality
- More nuanced explanations
- Higher cost

### For Local/Privacy

Use `llama3.2` or `mistral` with Ollama:
- No API costs
- Data stays local
- Slightly lower quality

### For Speed

Use Groq models:
- Extremely fast inference
- Good quality
- Free tier available

---

## Context Window

Context window determines how much content the model can process at once.

### Why It Matters

Recommendation explanations include:
- Movie/series metadata
- User watch history excerpt
- Evidence trail

Larger context = better explanations.

### Automatic Adaptation

Aperture adapts batch sizes based on context:

| Provider | Batch Size | Max Output |
|----------|------------|------------|
| Large context (OpenAI, Anthropic) | 10 items | 3,000 tokens |
| Medium context (Groq) | 5 items | 1,500 tokens |
| Small context (Ollama) | 3 items | 1,000 tokens |

---

## Text Generation Tasks

### Taste Profiles

User identity descriptions:

> "You gravitate toward complex narratives with unreliable narrators, particularly psychological thrillers and mind-bending science fiction..."

Generated when users click "Analyze Watch History."

### Recommendation Explanations

Why-this-pick text:

> "This psychological thriller shares the mind-bending narrative style you enjoyed in Inception and Memento..."

Generated during recommendation jobs if enabled.

### Playlist Content

When creating graph playlists:
- AI generates thematic names
- Creates descriptive summaries

---

## Configuration

### Selecting Model

1. Choose your provider (OpenAI, Ollama, etc.)
2. Select specific model from dropdown
3. Test generation
4. Save

### Testing

Click **Test** to verify:
- Model is accessible
- Generates valid output
- Response time is acceptable

---

## Cost Estimation

### OpenAI Text Costs

| Model | Input Cost | Output Cost |
|-------|------------|-------------|
| gpt-4o-mini | $0.15/1M | $0.60/1M |
| gpt-4o | $2.50/1M | $10.00/1M |

### Usage Per Feature

| Feature | Tokens Per Use |
|---------|----------------|
| Taste profile | ~2,000 |
| Per explanation | ~500 |
| Playlist name | ~200 |

### Typical Monthly Cost

| Users | Explanations | gpt-4o-mini | gpt-4o |
|-------|--------------|-------------|--------|
| 5 | Weekly | ~$0.50 | ~$5.00 |
| 20 | Weekly | ~$2.00 | ~$20.00 |

---

## Troubleshooting

### Poor Quality Output

- Try a more capable model
- Check input metadata quality
- Verify prompt isn't truncated

### Slow Generation

- Consider faster model
- Check rate limits
- For Ollama, ensure adequate hardware

### JSON Parse Errors

Aperture handles common issues:
- Strips markdown code blocks
- Handles preamble text
- Retries on failures

If persistent, try different model.

---

**Previous:** [Embedding Models](embedding-models.md) | **Next:** [Chat Models](chat-models.md)
