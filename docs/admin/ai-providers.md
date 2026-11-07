# AI providers

Open **Admin → Settings → AI / LLM**. Aperture configures Embeddings, Text Generation, Chat and Exploration independently. Provider/model availability and billing can change outside an Aperture release.

## Select a provider

The application supports provider adapters including OpenAI, Anthropic, Google AI, Groq, DeepSeek, Ollama and OpenAI-compatible endpoints. Not every adapter supports every function. Select a function first and use the models and capabilities offered by the current application. Model discovery is available for supported providers; custom endpoints may need an exact model identifier.

Supply credentials or a reachable base URL, choose a model, run the connection test, and save. Keep keys in the settings interface; do not include credentials in screenshots, issues or copied logs. `localhost` from a container refers to that container. A native host inference server must have an address reachable from Aperture.

## Choosing models

Use model discovery and the capability information shown in Settings. A static model-name table cannot establish current account access, prices, context limits or tool support. Test a small example of the actual task. A connection test is only one part of verifying the workflow.

- [Embeddings](embedding-models.md): vector retrieval and model/dimension compatibility.
- [Text generation](text-models.md): explanations and structured generation.
- [Chat](chat-models.md): Encore tools, response styles and conversations.
- [Cost estimation](cost-estimator.md): estimates and measured usage, where available.

Local inference uses your own compute and may require significant RAM/VRAM; cloud inference uses the selected provider account's limits and billing. Check current provider pricing through that provider's official documentation before making a spending decision.

## Changing providers

Save settings and test the affected function. Embeddings from different models are not interchangeable merely because their dimensions match. Existing profiles and embeddings follow the application's compatibility and refresh rules; do not delete the database to change a model. A locked incompatible profile requires an explicit administrator/user decision rather than silent reuse.

For Encore, Quick/Standard/Expanded adjust the response behavior. Supported models use native reasoning controls; compatible fallback instructions and tool budgets are used otherwise. See the [1.0.1 release notes](../release-notes/v1.0.1.md).
