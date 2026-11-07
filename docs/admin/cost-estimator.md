# Cost estimation

Open the cost estimator in **Admin → Settings → AI / LLM**. It compares configured functions and, for Encore, Quick/Standard/Expanded styles using supported model prices and recent measured usage where available.

Aperture 1.0.1 includes cached-input accounting for supported published rates and includes reasoning tokens in output costs. Per-style chat estimates can use the last 30 days of measured token usage; sparse samples remain uncertain. Daily usage aggregates contain counts rather than conversation text.

The estimator is a planning aid. Provider prices, account tiers, caching eligibility, tools and actual prompts can change the bill. It does not promise a monthly total or include your hosting, storage or local inference hardware costs. Check your provider's official billing information before making a spending decision.

See [chat models](chat-models.md), [text models](text-models.md), and [AI providers](ai-providers.md).
