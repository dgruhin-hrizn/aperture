# Connect a private Aperture instance to Claude or Codex

Encore and the MCP server use the same media tools. Catalog search, joins and counts are restricted to exact movie/series IDs returned by the connected user's media-server view. The server never grants a client direct SQL or administrative Emby access.

## Create a connection

Open Encore → Connections. Name the client, choose its scopes and expiration, and create a connection. Copy the token once; only its SHA-256 hash is stored. You can revoke a connection from the same panel. Disabled accounts, expired tokens and revoked tokens cannot use MCP. Reconnect your Emby/Jellyfin account if its user token has expired.

`library:read` permits accessible catalog search and public discovery. `profile:read` permits taste and personal history; tools combining catalog and personal progress require both. `schedules:read` permits release schedules. A connection only sees tools for its granted scopes.

The endpoint is `<your Aperture address>/mcp`, using Streamable HTTP. Send `Authorization: Bearer <token>`. MCP does not accept a browser session cookie or an administrator's media-server API key as a substitute.

## Codex: direct HTTP

Add a Streamable HTTP server in your client's MCP settings, or configure:

```toml
[mcp_servers.aperture]
url = "http://YOUR_PRIVATE_APERTURE:3456/mcp"
bearer_token_env_var = "APERTURE_MCP_TOKEN"
```

Set `APERTURE_MCP_TOKEN` in the environment used by the client. Use your actual private address; HTTPS is appropriate when connecting over an untrusted network. Authentication and endpoint reachability must work from the machine running the MCP client.

## Claude Desktop and other local stdio clients

Download `aperture-mcp.mjs` and its checksum file from the Aperture release. The bridge is a bundled, standalone file requiring Node 22+; a source checkout or package installation is unnecessary. It makes authenticated HTTP calls to your existing Aperture server and writes only MCP protocol messages to stdout.

```json
{
  "mcpServers": {
    "aperture": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/aperture-mcp.mjs"],
      "env": {
        "APERTURE_URL": "http://YOUR_PRIVATE_APERTURE:3456",
        "APERTURE_MCP_TOKEN": "YOUR_CONNECTION_TOKEN"
      }
    }
  }
}
```

The same stdio entry can be used in clients supporting local MCP processes. For source installations, `pnpm --filter @aperture/mcp build` creates the bundle. The container also includes it at `/app/packages/mcp/dist/aperture-mcp.mjs`.

Claude's web/custom remote connectors connect from Anthropic infrastructure. Reaching a server from your laptop does not make it reachable from the web connector. Local stdio and locally configured HTTP connections support private LAN installations. This release provides bearer-token connections; it does not implement an OAuth connector registration flow.

## Media knowledge and schedules

Local search and recommendations use Aperture metadata and embeddings. Semantic search supports hard genre, runtime, rating, year, content-rating and watched-status constraints. A movie's full runtime and a series' average episode runtime are different quantities; watch plans verify individual runtimes before scheduling.

External discovery, credits and details use TMDb. Streaming/rental/purchase listings are regional, attributed to JustWatch via TMDb, and do not establish subscription entitlement or episode-level availability. Filmography responses identify truncation when they exceed the bounded result count.

Schedules combine locally synced/next-episode TMDb forecasts for followed series, regional TVmaze broadcast/streaming calendars, and region-specific TMDb theatrical/digital movie releases. Dates retain day precision. Unknown data and refresh failures are reported explicitly. A forecast does not mean a file is available to play.

Aperture's configured provider pays for embedding requests made by semantic tools. Your external client's model runs the conversation; MCP does not require Aperture's chat model to answer every tool call.

## Conversation privacy

MCP does not copy a client's whole conversation into Aperture. It receives tool calls and the information submitted through them. Encore's own transcripts remain owned by their Aperture user. Future preference-writing tools require separate write scopes.

## Verification

Ask for a numeric title such as “1917,” compare accessible library counts, and query a title available only to another user. Restricted titles must not appear. Revoke the connection and verify the next request fails. `pnpm test:encore` runs deterministic checks; set `ENCORE_TEST_DATABASE_URL` to a disposable PostgreSQL/pgvector database to run the real database, vector-ranking, HTTP and bundled-stdio integration scenario. CI supplies an isolated database for this test.

## Memory, plans and approved actions

Stage three adds individually selectable `memory:write`, `plans:write`, `playlists:write` and `home:write` permissions. Creating/updating a watch plan or preparing a playlist also requires `library:read`; execute an action with library read, playlist permission, and Home permission when the proposal pins/unpins a row. Native writes require the inline approval button. External clients must obtain explicit human approval before calling `executeEncoreAction` with the exact previewed proposal ID.

Memory tools retain only the fact submitted to Aperture, together with the connection's provenance. Persistent preference facts participate in the existing Taste Profile interest system; temporary facts can expire. Inspect or forget them in Encore → Memory. A complete external chat is never copied implicitly. Connected clients can list plans and export structured schedules; the authenticated native UI also exports ICS calendar copies.

Playlists are tracked by exact IDs, never adopted by matching an arbitrary name. Unknown creation outcomes require reconciliation through an explicitly selected Emby details link and verified management rights. Emby Home support varies by server and client. Only the exact managed row is unpinned; media files are never removed.
