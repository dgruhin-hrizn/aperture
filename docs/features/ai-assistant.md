# Encore media consultant

On mobile, Aperture opens into Encore; its central bottom navigation button returns to the conversation. On desktop, open Encore from the sidebar or floating entry button. Encore combines conversation, user-scoped library tools, semantic retrieval, external movie/TV metadata, release forecasts and a personal workbench.

## Conversation and discoveries

Ask for a mood, title, person, franchise or viewing constraint. For example:

- “Find thoughtful science fiction I haven't watched, under 90 minutes.”
- “Compare this film with something in my library.”
- “What is coming next for the shows I follow?”
- “Show films directed by this person, including ones outside Emby.”

Conversation history is stored on the server and restored when you return. Tool results include poster cards, detail panels, taste/history/statistics, regional provider options and release timelines. You can stop a response, retry a failure, rename or delete a conversation. Library results are checked against your account's current media-server visibility. Semantic search uses the active embedding model and supports hard runtime, genre, rating, year and watched-status constraints.

External discovery uses TMDb; release information uses TMDb and TVmaze. Cards distinguish local results, external finds, upcoming releases and unknown availability. Regional dates are forecasts with source/freshness information, not proof that an episode is playable. Streaming-provider information is attributed to JustWatch through TMDb and does not verify your subscription.

## Memory

State a lasting preference or ask Encore to remember something. Use the Memory tab to inspect, correct, expire or forget a fact. Examples: “Remember that I avoid future-episode spoilers,” or “For this month, we only have short viewing windows.” Passing moods and another person's preferences should remain in the current request rather than becoming your permanent taste.

Persistent preference facts use Aperture's existing Taste Profile interests, including embeddings when configured. Temporary context, spoiler preferences and constraints remain memory records. Forgetting removes the linked interest only if it has not been changed elsewhere. Existing genre/franchise weights and profile settings remain under Taste Profile. Facts retain their Encore or MCP provenance. This is application memory, not model training.

## Watch plans

Give Encore the titles or shows you want to watch, available dates/times, window lengths and timezone. It uses exact local movie/episode IDs and checks live availability, runtime and playback progress. Episodes keep their sequence; breaks consume time. Unknown runtimes, unavailable titles, watched items and titles that do not fit are explained. Overlapping windows and ambiguous/nonexistent daylight-saving times are rejected for correction.

Plans begin as drafts. The Watch Plans tab lets you edit windows, recheck progress, save and export an ICS calendar. Saving rechecks eligibility. Exported events are independent copies: editing or deleting an Aperture plan does not update your calendar automatically.

## Emby playlists and Home rows

Ask Encore to prepare a playlist. Review the exact titles and operation in the conversation or Collections tab, then approve it. Encore creates and tracks a private playlist using your own Emby credentials. It never replaces an unrelated playlist simply because its name matches. Existing managed playlists can be updated, and supported Emby servers/clients can display them as Home rows.

Every action has persisted state and a receipt. Successful retries return the existing receipt. Interrupted membership changes reconcile actual entries. An uncertain creation will not create another copy: identify the existing playlist through its Emby details link and verified management rights. Home changes target the exact managed section and preserve unrelated Home configuration. Media files are never deleted. Managed playlist/Home writes currently require Emby; consultation and watch planning also support Jellyfin.

Manual playlist additions stay manual even when they match a later automated selection. Removing a managed title records an exclusion so later recipe changes do not silently re-add it. Adding it back in Emby clears that exclusion on a future reconciliation.

## Recurring curation

Suggestions are the default. A recurring rule starts paused and requires an explicit “Enable recurring updates” action. Choose an existing managed playlist, movie theme/filters or exact-show episode recipe, title limit, runtime/rating/watched constraints and a daily or weekly local schedule. A mood/theme uses the configured embedding provider; filter-only recipes do not need a chat-model call.

Editing pauses the rule for renewed opt-in. The Curation tab provides enable, pause, run now, edit and remove controls, next/last run, selected titles, membership changes and failures. Runs recheck account access and preserve manual edits. Empty eligibility or provider/permission failure pauses the rule and leaves a visible result. A rule authorized through MCP pauses when that connection expires or is revoked; enabling it directly in Encore grants your account's standing authorization instead.

The scheduler checks due rules each minute. Leases prevent concurrent workers from claiming the same run, and persisted action IDs recover completed writes after a process interruption. An already executing write may finish before a pause returns. Daily/weekly wall-clock schedules shift forward across a spring daylight-saving gap and choose the first occurrence of a repeated fall time. Calendar plans remain stricter and require an unambiguous viewing time.

## Claude, Codex and other MCP clients

Open Connections to create a named, scoped, expiring credential. The token is shown once and stored only as a hash. Connections can be revoked independently. Read permissions are the default; memory, plans, playlists, Home and curation permissions are separately selectable. Some operations need the associated read permissions as well.

Use the Streamable HTTP endpoint or download the standalone local stdio bridge from a release. Local clients can reach a private Aperture address; cloud-hosted connectors need network reachability from their provider. [MCP setup](../encore-mcp.md) includes configuration examples. Full external chats are not automatically copied. Aperture retains only information submitted through its capabilities.

## Configuration and privacy

Admins configure the chat, embedding and metadata providers in existing Aperture settings. Chat is optional for external MCP metadata/library tools; semantic search needs embeddings, and external metadata/schedules need their relevant provider credentials. Provider downtime is reported rather than replaced with invented facts.

Your configured AI providers receive the conversation/context and tool results needed to answer requests, and embedding inputs when enabled. Conversations, memories, plans, connections and managed resources are scoped to your Aperture account. No direct SQL, shell, filesystem administration or general Emby administration is exposed as an agent capability. Use Memory and conversation controls to manage what Aperture retains; imported calendar copies and external-client retention are managed in those applications.

The [mobile app guide](../mobile-app.md) covers primary navigation, conversation continuity, workspace sheets and home-screen launch.
