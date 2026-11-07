# Encore chat models

Configure chat in **Admin → Settings → AI / LLM**. This guide reflects Aperture 1.0.1 and the current dev build; model availability, prices and provider capabilities change independently of Aperture releases.

## Choose and test a model

Select a provider, configure its credentials/base URL, refresh the model list where available, and choose a chat model. Aperture discovers models when the provider supports discovery and combines that with its capability registry and configured custom models. Use **Test Connection** for the selected configuration. A successful connection is not a guarantee that every tool or planning task will succeed; try a library lookup and a short follow-up in Encore.

Use the model selector and cost estimator instead of a fixed model-name or price table in this document. Different AI functions can use different providers. Local inference avoids per-token API billing but still uses your hardware and electricity. Avoid calling one provider universally fastest or best without testing your workload.

## Response styles

**Quick** suits title lookups and short questions. **Standard** suits everyday conversations. **Expanded** gives comparisons and constrained watch plans more room. Admins set a default; a per-reply selection resets after sending. Native reasoning controls are used where supported; other models use response instructions and tool limits. A larger style is not a quality guarantee.

The estimator includes supported published rates and recent measured usage when available. Cached-input and reasoning-token accounting depends on the selected provider/model. Estimates are not an invoice or a promised monthly bill.

## What Encore can do

Encore supports saved conversations, library search, exact title details, recommendations, release lookups, editable memory, watch plans, approved private Emby playlist actions and opt-in recurring curation. Results distinguish local library items from external discoveries. Web search is optional and depends on configured provider support.

Playback actions open a media-server/client route. Encore does not bypass media-server library access, and actions that modify playlists/Home require the supported Emby integration and approval. A model's advertised context length does not promise unlimited conversation history.

See the [Encore workspace guide](../encore-rebuild.md), [MCP connections](../encore-mcp.md), and [user assistant guide](../features/ai-assistant.md).

## Troubleshooting

- Connection succeeds but chat fails: check tool support, model configuration and the full error. Retry a smaller task with Standard or Quick.
- Slow replies: inspect current tool progress, provider latency and selected style before changing models.
- Rate limits: check the provider account and usage; local retries do not increase the provider quota.
- Output limit: use the offered retry or narrow the question. Provider continuation data is separate from the visible transcript.
- Unexpected memory: inspect, edit or remove saved entries in Encore's Memory area.
