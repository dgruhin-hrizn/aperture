# Upcoming Episodes loading

The Dashboard carousel and Shows You Watch share Watching data. Previously their initial `/api/watching` response waited for every watched show's TMDb fallback in a sequential loop. Each fallback also reread TMDb settings. The global provider started this work even on pages without Upcoming Episodes. A cold large list could outlast the browser's 15-second read deadline and stay empty despite a fast database query.

## List first, forecasts progressively

The UI requests `/api/watching?includeUpcoming=false`. This returns the current user's saved list and locally synced future episodes without making any TMDb requests. The existing endpoint's default full-enrichment behavior remains compatible for other callers.

Upcoming lookups start only while Dashboard or Shows You Watch subscribes to them. Other pages can use membership and watching controls without starting forecast requests. Leaving the last episode view cancels queued/active browser reads; changing accounts also prevents late results from reaching the new account.

Forecast requests use authenticated `GET /api/watching/upcoming?seriesIds=...`, accepting at most 20 UUIDs. The browser sends batches of ten, with two requests at a time. The API intersects every batch with the caller's current `user_watching_series` membership before loading anything. Rows no longer in that membership are removed from browser state and its cache. User lists and access decisions are never shared between users.

The list's loading state is independent of forecast loading. Local and already resolved episodes remain visible as more batches arrive. Dashboard keeps available cards visible; Shows You Watch exposes its list/filter controls immediately. A small progress indicator shows remaining work. Partial failures preserve known episodes and show a warning with a read-only Refresh action. Confirmed absence clears an old forecast; an unavailable upstream response does not masquerade as "no upcoming episode."

## Shared upstream work

- Public TMDb forecasts are cached for **30 minutes**, with a **2,000-entry** bound and shared in-flight requests. Confirmed "no upcoming episode" responses are cached too, avoiding repeated lookups for ended or between-season shows.
- Cache keys contain TMDb credentials, TMDb series ID and UTC day. Configuration changes or date rollover cannot reuse an incompatible result. Current local episodes are always checked first. Past TMDb episode dates are excluded.
- A process-wide limit allows **four** concurrent upcoming TMDb reads across all users and batches. Each interactive lookup has a **five-second** upstream timeout and a single attempt; errors, timeouts and rate-limit responses are not cached as empty forecasts.
- TMDb configuration is read once per batch rather than once per show. The shared TMDb client reserves distinct 25ms request-start slots before waiting, so parallel callers respect the existing global pacing instead of waking together. Other workflows retain their timeout/retry defaults.
- Ended shows are still checked: synced status can be stale, so skipping them could hide a returning series or special.

The browser retains the dev.11 account-scoped, membership-validated metadata cache for up to 24 hours. Forecast freshness is tracked separately for 30 minutes and rechecked across UTC day boundaries. Refreshing forecasts does not extend metadata lifetime. Incomplete or failed batches do not mark the entire list freshly checked. A process restart clears the server forecast cache; cold forecasts still load progressively.

Aborting a browser read prevents stale publication and stops its next batches. Already-started server lookups may finish and populate the bounded public cache for other readers.

## Measurements

Read-only investigation of Gru's existing list found **202 shows**, **two** with local future episodes and **198** requiring remote fallback. The diagnostic SQL took **8ms**. No schema/index change was needed.

A full comparison of the 200 TMDb-linked shows returned the **same 22 upcoming episodes**. The other two Watching entries have no TMDb ID and do not make remote calls.

| Full-list sample | Backend time | Upstream calls | Settings reads | Peak upcoming concurrency |
| --- | ---: | ---: | ---: | ---: |
| Previous sequential code | 13,302ms | 198 | 198 | 1 |
| Optimized, cold cache | 5,008ms | 197 | 1 | 4 |
| Optimized, warm cache | 6ms | 0 | 1 | 0 |
| Local-only episode query | 4ms | 0 | 0 | 0 |

The cold lookup makes one fewer call because two Aperture entries share a TMDb ID. The initial list does not wait for the full cold lookup: an authenticated local HTTP read returned all 202 saved series and two local episodes in **45ms**. A local browser preview against the existing list displayed all **202 series**, all **22 upcoming shows**, and completed **21 ten-series forecast batches** successfully (the final batch contained two entries).

These are read-only backend samples and browser checks, not end-to-end speed guarantees. Removing remote work from initial list loading is the main perceived improvement; caching also reduces work for other users following the same shows.

## Validation

Run `pnpm test:upcoming` for 20 tests covering local-first loading, legacy API compatibility, ownership/input limits, remote concurrency and in-flight sharing, negative caching, credentials changes, past dates, timeout/error recovery, independent browser batches, account changes, view cancellation, cache freshness, membership revocation and preserved metadata age. Run the existing UI performance, Discovery and appearance suites plus `pnpm validate` and `pnpm build` for compatibility.

Browser validation uses Gru's existing data through a temporary read-only local preview. Preference writes, favorites synchronization and list mutations are blocked. The dev.12 release updates only the app image. Release validation compares configuration fingerprints, saved preferences and Emby Home sections before and after deployment. No settings change, favorites change, taste-profile update or database migration is part of this optimization.
