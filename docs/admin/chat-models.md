# Chat Models

Configure which AI model powers the Encore conversational assistant.

## Accessing Settings

Navigate to **Admin → Settings → AI / LLM → Chat Model**

---

## What The Chat Model Does

Powers the Encore assistant for:

| Feature | Description |
|---------|-------------|
| **Conversational Search** | "Find me a funny movie from the 90s" |
| **Recommendations** | "What should I watch tonight?" |
| **Library Questions** | "How many Marvel movies do I have?" |
| **General Help** | "How do ratings affect my picks?" |

---

## Available Models

### OpenAI Models

| Model | Quality | Cost | Best For |
|-------|---------|------|----------|
| **gpt-4o-mini** | Good | Low | Most users |
| gpt-4o | Best | High | Complex queries |
| gpt-4-turbo | Great | Medium | Balanced |

### Ollama Models

| Model | Quality | Speed |
|-------|---------|-------|
| **llama3.2** | Good | Medium |
| mistral | Good | Fast |
| mixtral | Better | Slower |

### Anthropic Models

| Model | Quality | Cost |
|-------|---------|------|
| claude-3-haiku | Good | Low |
| **claude-3-sonnet** | Better | Medium |
| claude-3-opus | Best | High |

### Google AI Models

| Model | Quality | Cost |
|-------|---------|------|
| gemini-1.5-flash | Good | Low |
| **gemini-1.5-pro** | Better | Medium |

---

## Selecting a Model

### For Most Users

Use `gpt-4o-mini`:
- Good conversation quality
- Low cost per interaction
- Fast responses
- 1M token context

### For Better Understanding

Use `gpt-4o` or `claude-3-sonnet`:
- Better at nuanced requests
- Understands complex queries
- Higher cost per chat

### For Local/Privacy

Use `llama3.2` with Ollama:
- No per-query costs
- Data stays local
- Slightly less capable

---

## Chat Costs

### Understanding Chat Costs

Chat is **interactive**:
- Each message costs tokens
- Context accumulates in conversation
- More usage = more cost

### Cost Per Conversation

| Model | Short Chat (~5 msgs) | Long Chat (~20 msgs) |
|-------|---------------------|---------------------|
| gpt-4o-mini | ~$0.01 | ~$0.05 |
| gpt-4o | ~$0.10 | ~$0.50 |

### Monitoring Usage

- Check OpenAI/provider dashboard for costs
- Consider usage limits per user
- Monitor for unusual patterns

---

## Chat Capabilities

### What Encore Can Do

| Query Type | Example |
|------------|---------|
| Search | "Movies with Tom Hanks" |
| Similar | "Something like Inception" |
| Filter | "Comedies rated above 7" |
| Recommend | "What should I watch?" |
| Stats | "My top genres" |
| Help | "How do I rate things?" |

### What Encore Can't Do

- Play movies directly
- Modify settings
- Access content outside library
- Remember past sessions (by default)

---

## Context and Memory

### Conversation Context

Within a session:
- Encore remembers previous messages
- Can reference earlier in conversation
- Context resets on new chat

### Conversation History

Aperture saves chat history:
- Users can view past conversations
- Resume previous topics
- Delete old chats

---

## Configuration

### Model Selection

1. Select provider and model
2. Test with a sample query
3. Save configuration

### Testing Chat

Click **Test** to try:
- "What movies do you recommend?"
- Verify response quality
- Check response time

---

## System Prompt

The chat model uses a system prompt that:
- Explains Aperture's purpose
- Provides user context
- Sets response guidelines

Admins cannot currently customize this prompt.

---

## Rate Limiting

### Provider Limits

Each provider has rate limits:

| Provider | Typical Limit |
|----------|---------------|
| OpenAI | 10,000 RPM |
| Anthropic | 1,000 RPM |
| Ollama | No limit (local) |

### User Limits

Consider implementing:
- Max messages per day
- Cooldown between messages
- Premium tiers for heavy users

---

## Troubleshooting

### Slow Responses

- Try faster model
- Check provider status
- For Ollama, ensure adequate resources

### Poor Quality Answers

- Use more capable model
- Check if query is within capabilities
- Verify user context is loading

### "Rate Limited"

- Wait for limit reset
- Reduce usage
- Upgrade provider plan

---

## Disabling Chat

To disable Encore assistant:
- Remove or don't configure chat model
- Chat button won't appear
- All other features still work

---

**Previous:** [Text Generation Models](text-models.md) | **Next:** [Output Format](output-format.md)
