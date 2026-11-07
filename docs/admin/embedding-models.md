# Embedding models

Choose the Embeddings provider and model in **Admin → Settings → AI / LLM**. Embeddings are vectors used for semantic retrieval, Similar titles and recommendation profiles. They are separate from Text Generation and Encore Chat.

## Select and verify

Use the current model selector, supported dimension information and connection test. Provider discovery and custom-model settings determine the available models. Avoid relying on an old documentation table for prices, quality rankings, context limits or account availability.

Choose according to your actual retrieval results, inference throughput, memory and storage budget. A larger vector or model is not automatically a better recommendation system. Test a small catalog sample and representative queries before generating embeddings for the whole server.

## Changing models

Vectors from different models are not interchangeable simply because they have the same dimension. Aperture tracks model compatibility and supports its configured dimension-specific storage. Generate compatible embeddings for the chosen model and rebuild affected profiles through the supported jobs. A failed rebuild must not silently reuse an incompatible old profile. Locked incompatible profiles require explicit resolution; do not unlock or delete all user data as a routine model change.

Existing recommendation runs and published files are not automatically rewritten by changing the model. Run the appropriate generation and publishing jobs after verifying the new configuration. Back up the database first, and budget provider usage for broad regeneration.

## Troubleshooting

- Missing embeddings: check the configured model, dimensions, job state and errors.
- Local server unavailable: verify the URL is reachable from Aperture's container; container localhost is not the host.
- Unexpected search results: test title matching separately from semantic matching and check the current library access/filter settings.
- Costs: use the [cost estimator](cost-estimator.md) and current provider billing information.
