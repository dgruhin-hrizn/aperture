# Schema compliance

Zod is already the canonical runtime schema library for Encore and a number of HTTP inputs. The supported baseline is Zod 3.25.76, matching the AI SDK v7 peer requirement; API, core and workspace override declarations agree with the lockfile.

## Enforced boundaries

| Boundary | Source and enforcement | Regression coverage |
| --- | --- | --- |
| Native Encore | Shared Zod tool definitions, serialized and checked before a provider request | All 42 input schemas compile; real provider serialization and streamed tool round trips |
| HTTP/stdio MCP | The same definitions and runtime guard, followed by MCP's JSON-schema validator | All 44 tools discovered over real HTTP with a full-scope disposable connection; scope/ownership/revocation journeys |
| Provider adapters | The configured adapter serializes the shared catalog | OpenAI, Anthropic, Google, Groq, DeepSeek, OpenRouter, Ollama, OpenAI-compatible and Hugging Face |
| Existing HTTP contracts | Fastify compiles registered request validators and response serializers; Zod validates the published OpenAPI envelope and references are resolved | Offline boot of the entire API, currently 431 HTTP operations |

The shared tool guard requires provider-safe names and object input roots without top-level unions. It runs before any model request and before MCP registration, so an invalid tool is identified by name locally. CI also compiles each exported tool schema with the API validator.

`proposePlaylist` advertises a flat object and validates it against the canonical create/update union before execution. Creation still requires a valid name and non-empty selection; updates still require a managed collection ID. Home operations remain separate. Ownership, catalog checks and explicit write approvals continue to apply.

The connection test in AI settings establishes connectivity with the configured model. A successful connection test does not exercise Encore's complete tool catalog; the transport regressions cover that additional boundary without sending user data or billable model requests.

## HTTP audit scope

`pnpm test:schemas` registers the complete API without initializing uploads, compiles all declared request/response schemas and checks every published local OpenAPI reference. It also verifies that `/api/version` agrees with the documented application version.

This gate validates existing contracts. Some legacy REST handlers use manual checks or TypeScript-only body types and have no declared OpenAPI request body. A complete conversion of those handlers and their response DTOs into shared Zod contracts requires a separate route-by-route migration. Bodyless actions, multipart uploads and protocol-validated JSON-RPC endpoints must be classified appropriately during that migration. They are not automatically treated as JSON-body validation failures.

## Checks

- `pnpm test:encore`: exported tool schemas, nine provider adapters, streamed tool round trips and the existing conversation/planning/MCP journeys. Set `ENCORE_TEST_DATABASE_URL` to a disposable pgvector database to include the database-backed journeys.
- `pnpm test:schemas`: offline HTTP schema compilation, published references and version-contract consistency.
- `pnpm validate` and `pnpm build`: lint, types and production artifacts.

Both schema suites run in release CI. Provider wire tests use local fixtures and exercise the real SDK adapters. The full-scope MCP integration uses a disposable database and mocked media server; it does not modify a live library.

[OpenAI function-calling schemas](https://developers.openai.com/api/docs/guides/function-calling) · [OpenAI schema root constraints](https://developers.openai.com/api/docs/guides/structured-outputs#root-objects-must-not-be-anyof-and-must-be-an-object)
