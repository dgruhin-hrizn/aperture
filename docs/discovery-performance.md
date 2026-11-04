# Discover loading and caching

Introduced in **0.7.11-dev.10**. These optimizations add no settings or database migrations and preserve recommendation scoring, existing filters, requests, library permissions and appearance preferences.

## Loading behavior

1. The page checks the current user's Discovery permission and flags. It loads the selected popular Movies or Series list, rather than both. Genre and Streaming views do not fetch the saved popular lists behind the scenes.
2. Saved suggestions finish loading independently of Seerr. Availability/request badges update in the background; a slow or unavailable Seerr does not hold the page on skeletons. Candidate and status requests have deadlines, and candidate errors end the loading state with an error message.
3. Changing account, tab or filters cancels obsolete list/status work. Filter expansion runs only for the visible filtered list. Expansion does not change taste preferences or run as a side effect of opening an unrelated section.

## Seerr status checks

- A process-local, bounded cache retains successful statuses for **30 seconds**, keyed by server URL, credentials, media type and TMDb ID. Movies and TV may share a numeric ID; typed keys prevent collisions.
- Simultaneous callers share a lookup. A shared limiter allows at most **five** upstream status calls at a time. Configuration is read in one SQL query per batch, rather than three queries per title. The old fixed delay between batches is removed.
- Each upstream status lookup has a **five-second** deadline. Batches stop scheduling new lookups after **eight seconds**; queued work checks that deadline before calling Seerr. Missing statuses remain optional and can be retried; failures are not cached as successful availability.
- Request creation, cancellation and Seerr configuration changes clear the cache. A locally submitted request immediately updates its badge, and earlier status responses cannot overwrite it.
- The batch and strip APIs retain legacy numeric status objects and add typed objects (`statusesByMedia` / `seerrStatusesByMedia`). The UI uses typed keys.
- External changes made directly in Seerr may take up to the status TTL to appear on a subsequent check. The browser does not continuously poll every title.

## Genre and Streaming rows

Rows remain lazy-loaded near the viewport, with at most **two concurrent row requests**. Active and queued keys are deduplicated. Resetting or leaving a section aborts requests and prevents late completions from writing into a replacement view.

Provider configuration and labels, genre-row configuration, and localized genre labels share a short **60-second**, user-scoped browser cache. Provider labels are reused when changing language or the missing-only filter; configuration is loaded before starting provider rows, avoiding an initial request for default rows followed by a second request for configured rows.

Raw TMDb genre-discovery pages are cached for **five minutes**, with in-flight deduplication and a 500-entry bound. This cache contains public catalog results, not personalized output. Library, watched and request exclusions are queried fresh for each user's row. Localized TMDb genre lists have a bounded one-hour process cache. Existing JustWatch and poster caches remain in use.

## Saved suggestion cache and permissions

The previous unscoped browser cache is retired. Up to **eight** candidate responses are retained for one hour, keyed by user, media type and canonical filters. Equivalent filter orderings share a key without modifying saved preferences.

Cached rows are **not displayed before validation**. The browser sends their ETag; the authenticated endpoint checks Discovery access, reads current candidates with current library exclusions and counts, and hashes the actual response inputs before returning 304. A changed library or list returns fresh rows even when the discovery run ID is unchanged. Access failures discard the cached list. Refresh/job completion invalidates the user's cached candidates; no offline permission fallback is used.

## Job monitoring

Idle polling changes from every five seconds to every **60 seconds**: approximately **60 rather than 720 checks per hour** for an idle visible tab. Hidden tabs stop polling and close the progress stream. Returning to the tab checks immediately and revalidates Discovery status and the visible candidate list.

The global jobs widget also backs off to one minute while idle and pauses while hidden. It shares identical active-job requests with Discover through a one-second user-scoped cache, instead of adding its previous two-second polling traffic. Starting or cancelling a job from the Jobs page immediately invalidates this shared response and notifies the monitors. Regular users do not poll admin-only job endpoints.

Running jobs retain SSE progress and a five-second watchdog/reconnect poll (the global widget keeps its two-second active progress cadence). Completion handling deduplicates successful notifications; a job that finishes while hidden can be checked when the tab becomes visible. Polling uses scheduled timeouts to avoid overlapping interval requests.

## Measurements and validation

Read-only backend samples against Gru's existing Unraid data (50 movies and 50 series), excluding HTTP page delivery and rendering:

| Operation | Before | Optimized sample |
| --- | ---: | ---: |
| Saved candidate rows, counts and runs | 11 ms | 21 ms |
| 100 Seerr statuses, cold process cache | 1,505 ms | 593 ms |
| Seerr settings queries across two core batches | 300 | 2 |
| Repeat status check within TTL | 100 upstream calls | 0 calls, 1 ms |

These single samples are not an end-to-end speed guarantee. The largest perceived improvement comes from removing status work from the list's loading state; an initial Movies view also avoids the 50 hidden TV status lookups.

Run `pnpm test:discovery` for the focused automated suite. It covers loading with pending/offline Seerr; selected sections and user changes; access denial and conditional responses; filter cache keys; configuration request sharing and cancellation; row concurrency/reset; successful, failed and invalidated status caching; fresh exclusions on shared genre pages; and idle/hidden polling and SSE completion. Repository lint, type checks and production builds are also required before release.

Deployment verification records the published image digest and compares all existing configuration tables, user preferences and Gru's Emby Home sections with the pre-update snapshot. Browser checks use existing data and block preference writes, content requests, refresh and expansion actions.
