# Schema compliance

Zod is already the canonical runtime schema library for Encore and a number of HTTP inputs. The supported baseline is Zod 3.25.76, matching the AI SDK v7 peer requirement; API, core and workspace override declarations agree with the lockfile.

## Enforced boundaries

| Boundary | Source and enforcement | Regression coverage |
| --- | --- | --- |
| Native Encore | Shared Zod tool definitions, serialized and checked before a provider request | All 42 input schemas compile; real provider serialization and streamed tool round trips |
| HTTP/stdio MCP | The same definitions and runtime guard, followed by MCP's JSON-schema validator | All 44 tools discovered over real HTTP with a full-scope disposable connection; scope/ownership/revocation journeys |
| Workbench and MCP execution | Validate canonical Zod refinements, transforms and defaults before invoking any selected tool | Invalid workbench UUIDs and incomplete MCP playlist branches; normalization/default checks |
| Provider adapters | The configured adapter serializes the shared catalog | OpenAI, Anthropic, Google, Groq, DeepSeek, OpenRouter, Ollama, OpenAI-compatible and Hugging Face |
| HTTP contracts | Fastify compiles registered request validators and response serializers; Zod validates the published OpenAPI envelope and references are resolved | Offline boot of the entire API, currently 431 HTTP operations |
| Legacy HTTP input gaps | 56 canonical Zod JSON body contracts, supplementary query/path contracts and explicit policies for every mutation | 191 mutation operations, 107 source-declared body types and 190 source-declared query fields; authenticated PostgreSQL writes |

The shared tool guard requires provider-safe names and object input roots without top-level unions. It runs before any model request and before MCP registration, so an invalid tool is identified by name locally. CI also compiles each exported tool schema with the API validator.

`proposePlaylist` advertises a flat object and validates it against the canonical create/update union before execution. Creation still requires a valid name and non-empty selection; updates still require a managed collection ID. Home operations remain separate. Ownership, catalog checks and explicit write approvals continue to apply.

The connection test in AI settings establishes connectivity with the configured model. A successful connection test does not exercise Encore's complete tool catalog; the transport regressions cover that additional boundary without sending user data or billable model requests.

## HTTP coverage

`pnpm test:schemas` registers the complete API without initializing uploads, compiles all declared request/response schemas and checks every published local OpenAPI reference. It also verifies that `/api/version` agrees with the documented application version.

The request-contract plugin runs before Swagger and route registration. Domain modules under `apps/api/src/contracts/` define canonical Zod inputs for legacy gaps. The same definitions produce documentation and validate complete inputs before handlers, including refinements and defaults that JSON Schema cannot express. Existing Fastify JSON-schema contracts remain in use where they already cover their handlers.

Every POST/PUT/PATCH/DELETE must declare a body contract or an explicit policy. Bodyless actions accept absent input or an empty object. Multipart image/backup uploads retain their file parsers and size/format checks. MCP delegates its envelope to the MCP SDK and its arguments to the canonical tool schema. The workbench delegates arguments to the selected shared tool. The retired transcript-write endpoint always returns 410. New unclassified mutations fail API registration and CI.

The source audit compares handler body fields and query fields with published contracts, catching schemas that compile but omit fields consumed by their handlers. Path parameter contracts must match route names; undeclared router strings receive a bounded string contract while existing UUID/enum validators remain in place. Supplementary queries preserve other documented query fields. The setup image envelope is documented as JSON with base64 data, distinct from multipart uploads.

Authenticated REST regressions save AI configuration, update users/conversations/channels and edit/delete franchise/genre preferences against a disposable database. Invalid batches are rejected before any item is persisted. These tests block external fetches, so they cannot send credentials or incur model costs.

The response gate compiles every **declared** response serializer and resolves every published reference. It does not invent response DTOs for legacy endpoints whose response documentation is currently descriptive. This is a runtime input-coverage and schema-validity guarantee, not a claim that every legacy response has been converted to a new Zod DTO.

## Checks

- `pnpm test:encore`: exported tool schemas, nine provider adapters, streamed tool round trips and the existing conversation/planning/MCP journeys. Set `ENCORE_TEST_DATABASE_URL` to a disposable pgvector database to include the database-backed journeys.
- `pnpm test:schemas`: HTTP schema compilation, published references, version-contract consistency, source input coverage and invalid-input journeys. Set `ENCORE_TEST_DATABASE_URL` to a disposable pgvector database to include authenticated REST writes.
- `pnpm validate` and `pnpm build`: lint, types and production artifacts.

Both schema suites run in release CI. Provider wire tests use local fixtures and exercise the real SDK adapters. The full-scope MCP integration uses a disposable database and mocked media server; it does not modify a live library.

[OpenAI function-calling schemas](https://developers.openai.com/api/docs/guides/function-calling) · [OpenAI schema root constraints](https://developers.openai.com/api/docs/guides/structured-outputs#root-objects-must-not-be-anyof-and-must-be-an-object)
