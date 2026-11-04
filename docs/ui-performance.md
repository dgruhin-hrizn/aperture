# UI loading and request efficiency (dev.11)

This release extends the dev.10 Discover work to Recommendations, Top Picks, Playlists, Browse, details, My Requests and shared navigation. It adds no settings or database migrations and does not change recommendation scoring, library configuration, playlists, ratings, watch history or Emby Home sections.

## Recommendations, Top Picks and activity

Recommendations, Top Picks and Watch History load the selected movie or TV tab. Hidden lists wait until selected. Changing tabs or accounts cancels obsolete reads; late responses cannot replace the active result. Their existing filters, regeneration, pagination and actions remain available.

Public TMDb popular, trending and top-rated chart pages have a five-minute process cache, in-flight deduplication and a 500-entry limit. Keys include the configured API key and complete endpoint (including page and time window). Missing configuration returns no chart results. Local library matching still runs on each request; personalized recommendations are not cached as public charts. Chart order and configured counts are retained. MDBList and local-watch ranking retain their existing behavior.

## Browse correctness and pagination

Previously the list length was a dependency of the first-page request. Receiving rows changed the dependency, starting another first-page request and potentially replacing appended pages. The dependency now represents the query itself; pagination advances only after a successful response and calculates remaining pages from the page size and total. Equivalent filter-range initialization does not restart the query.

Only the selected Movies, Series or People tab loads its list. Movie and TV filter metadata wait until that tab is first opened. Switching tabs does not reset manually chosen ranges. Saved sort preferences use the shared preference snapshot; no sort or preset is written merely by opening Browse. Searches are debounced and prior requests are cancelled. Page-two and later rows append to the current query, rather than restarting page one.

## Progressive title details and exact watched status

The primary movie/series response controls the main loading placeholder. Similar titles, insights, watch statistics, episodes, ratings and server links settle independently. Optional failures leave the title usable. Navigation cancels obsolete work; rating responses from a previous title cannot update the new title.

Movie watched status now uses an exact authenticated `GET /api/users/:id/watch-history/movies/:movieId` lookup. Previously a movie outside the first 100 history rows could incorrectly appear unwatched. The new query checks both user and movie, respects enabled library visibility and distinguishes incomplete playback from completed watches. Only the account owner or an admin can request it. TV details request the specific title rating instead of downloading the complete ratings list for that section.

## Watching cache correctness

The ownerless `aperture_watching_cache` is retired. Metadata is stored under a versioned key containing the account ID and is never rendered for another account. Its existing 24-hour metadata lifetime remains (membership checks do not extend it), but cached membership is checked through the existing authenticated `/api/watching/ids` endpoint before display. Changed membership fetches the full current list. Validation failure discards the cached result and shows an error; there is no unchecked offline fallback. Account changes abort old loads and immediately withhold the previous account's rows.

## Playlists

Cards request a preview only when near the viewport (250px margin), with `Limit=5` sent to Emby/Jellyfin. The authenticated channel and graph preview endpoints preserve the access rules of their full-item endpoints. Responses contain the small preview and the media server's current total; graph card counts can therefore reflect changes made in Emby rather than an old saved count. Full playlist contents remain available when the viewer opens. Successful edits refresh previews.

Channels and graph playlists settle independently. Genres load when the playlist editor opens, not on every page visit. Existing seed movie IDs are resolved in one authenticated `/api/movies/summaries?ids=...` query (maximum 100 UUIDs, minimal fields, caller order, enabled libraries). Closing the editor cancels pending seed lookup and cannot allow a late response to reopen it. Searches cancel obsolete requests.

## My Requests and Seerr

My Requests uses `GET /api/seerr/requests?includeLive=false` to show saved, paginated requests and library links first. A separate read-only `POST /api/seerr/requests/status/batch` enriches the badges. Request IDs are checked against the current user's saved requests before contacting Seerr. Pending or failed enrichment preserves saved status and does not hide the table. The existing GET default still includes live data for compatibility.

Seerr request-status reads share a 30-second cache keyed by server, API key and request ID, a five-request concurrency limit, five-second upstream deadlines and an eight-second batch scheduling budget. Cache entries are invalidated by Aperture request creation/deletion or Seerr configuration changes. External changes can take up to the TTL to appear on the next read. Statuses are not continuously polled for every title.

## Shared preferences and jobs

Appearance, view modes, navigation, language, Browse presets and similar-title view share one account-scoped preference request, with a 30-second cache. Concurrent saves are serialized per account and send only changed keys; server merging preserves unrelated and nested settings. A successful save seeds the shared snapshot and updates subscribers without another GET. Failed loading never triggers a default appearance write. No preferences are migrated or reset.

The admin shell and global jobs widget share active-job reads through the existing one-second user-scoped cache. Visible idle monitoring checks once per minute instead of the shell's previous three-second cadence; running work keeps two-second progress checks. Hidden tabs cancel polling and check immediately on return. Job start/cancel events request an immediate refresh. Regular users make no admin jobs requests.

## Request deadlines, routes and translations

The shared read helper combines navigation cancellation with a 15-second deadline so a stalled read can leave its loading state. Long manual Watching library reconciliation has a separate 120-second allowance. Existing generation workflows retain their job/progress behavior.

Routes load on demand with the navigation shell retained during page loading. The assistant and non-English translation dictionaries load separately. English remains the bundled fallback; all 14 existing languages and RTL support remain available. A tab holding an older bundle can reload once when a deployment replaces one of its route chunks; persistent failures cannot create a reload loop.

## Measurements and validation

Read-only samples against Gru's existing data, not end-to-end guarantees:

| Operation | Before | After |
| --- | --- | --- |
| Repeated Movies + TV TMDb chart reads within TTL | 8 upstream calls each time | 8 cold, 0 warm; same 25 movie / 22 TV results |
| Chart pair sample including fresh local matching | 8 calls again on repeat | 676ms cold, 178ms warm |
| Graph playlist card preview | 25 full entries downloaded, five shown | five upstream entries; full 25 load only on opening |
| Browse hook first page | repeated until probe stopped at six | one; appending page two preserves page one |
| Main entry JavaScript, gzip | about 1.53MB | about 267KB; route/language chunks load as needed |

Run `pnpm test:ui-performance` (27 tests), `pnpm test:discovery` (20 tests), and the seven appearance compatibility tests used in CI. The new suite covers request sharing, cancellation, tab selection, pagination, exact watch lookups, cache ownership, delayed optional reads, playlist preview limits, batched seed lookup, access checks, Seerr ownership and independent saved-request loading. Run `pnpm validate` and `pnpm build` before release.

Browser checks use Gru's existing data through a temporary read-only loopback gateway, blocking preference writes, playlist mutations, content requests and generation. Verify Recommendations/Top Picks tabs, Browse Movies/TV/People, playlist previews/full viewer/editor, title details, My Requests, Studio light/dark, Classic, French and RTL loading. Theme/language variants can be supplied only to the test gateway response without saving preferences.

Deployment verification records the GHCR digest and compares existing configuration tables, all saved user preferences, Gru's appearance and all Emby Home sections before and after updating only the Aperture app container. Container mounts, ports and restart policy are checked; the database container is retained.

## Upcoming Episodes follow-up

See [Upcoming Episodes loading](upcoming-episodes-performance.md) for the subsequent local-first, progressive forecast optimization, separate forecast freshness, request limits and measurements.
