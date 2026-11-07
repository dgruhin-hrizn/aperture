# Text-generation models

Configure Text Generation separately from Chat and Embeddings in **Admin → Settings → AI / LLM**. This guide reflects Aperture 1.0.2.

Text generation produces recommendation explanations, taste-profile descriptions and other generated text. Encore conversations use the Chat configuration; vector retrieval uses Embeddings. Changing one function does not automatically select a compatible model for every other function.

## Configuration

1. Choose a provider and supply its required credentials or base URL.
2. Refresh the available models where supported, or configure the exact custom model identifier.
3. Select the model for Text Generation and run its connection test.
4. Save, then generate a small sample before running recommendations for all users.

Use the live model list, capability information and cost estimator. Static lists of recommended models, context sizes and token prices become outdated quickly. Current provider defaults are implementation defaults, not a guarantee of the best model for your hardware or workload.

Where the selected model supports effort controls, the settings expose them. Compatibility behavior and output budgeting vary by provider. Explanations are descriptions generated from available evidence, not a guarantee of enjoyment or a calibrated probability.

## Local models and failures

Local inference needs sufficient RAM/VRAM and a reachable inference service. `localhost` inside Aperture's container identifies that container, not the host machine. Use a base URL reachable from Aperture and test it there.

Models used for structured tasks must follow the requested output shape. Aperture handles supported fenced JSON and common escaping issues, but malformed or incomplete responses can still fall back or fail. Check logs and the selected model's output budget. Reduce the task or choose a model that handles the required schema reliably rather than assuming every local model is interchangeable.

## Costs and refreshes

Use **Cost Estimator** and measured usage from your installation where available. Rates and context limits depend on the exact model; estimates exclude unrelated infrastructure costs and are not promised monthly spending.

A setting change does not rewrite every saved explanation immediately. Regenerate the relevant recommendations or profile as needed, then run publishing to update generated media-server descriptions. Keep the database and uploaded-artwork backup before broad regeneration or provider changes.

See [AI providers](ai-providers.md), [Encore models](chat-models.md), and [embedding models](embedding-models.md).
