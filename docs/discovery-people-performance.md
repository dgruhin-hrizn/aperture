# Genre strips, Streaming and People loading

These changes remove unnecessary remote work and repeated database aggregation. They add no settings or migrations and preserve recommendation scoring, chart ranking, configured filters and saved preferences.

## Findings

Read-only warm requests on Unraid returned a movie genre strip in 616ms, a Streaming strip in 534ms and a 50-person page in 426ms. The library contained 14,768 movies, 2,693 series and 120,528 distinct actor/director names. These endpoints were responding; the slow UI was not explained by a stuck SQL query alone.

The People aggregation cost about 0.4 seconds on every page/search. Portraits had a separate waterfall: each rendered card tried Emby before TMDb, including offscreen cards. Browser tracing found portrait requests still waiting after ten seconds. Genre/Streaming cards also waited for optional Seerr checks. Streaming could request TMDb details for every uncached poster, waited for provider labels before starting rows, and waited for a JustWatch refresh even when saved public charts existed.

## Discovery rows

- The UI opts into `includeStatuses=false` on genre and Streaming endpoints. Cards render first; typed movie/TV status batches update badges afterward. Overlapping rows request each typed ID once per view. Account/view changes abort old work and reject late responses. Successful local requests take precedence over older status responses. Existing API clients keep inline status enrichment by default.
- Streaming uses `cachedPostersOnly=true`: cached TMDb posters are preferred, otherwise the existing JustWatch poster is used without a TMDb detail call. Rich title details still load on opening. Current library matching, missing-only filtering and chart ordering remain in place.
- Provider rows start while their display names load. Labels update headings without resetting loaded content. Searches cancel provider-row work while search results are shown; leaving search restores those rows. The visibility queue still limits content loads to two rows at once.
- Expired public JustWatch charts return immediately with a localized stale indicator while one background refresh runs per key. The indicator describes potentially outdated rankings in all 14 languages without incorrectly claiming a pending refresh has failed. Success replaces the saved payload; failure leaves it usable. Cold requests share a fetch and retain the existing unavailable error when no cache exists. Library matches and personal statuses stay outside this public cache.
- Raw genre pages retain their bounded five-minute cache. Keys now include TMDb credentials, so removing/changing a key cannot reuse incompatible pages. The key is read once per strip rather than once per uncached page. Four remote genre-page reads can run at once, each with a five-second single-attempt deadline. Existing global pacing remains; the extra 50ms delay after later pages is removed.
- Genre pages retain `vote_count.desc` order and continue until the target count is filled or the catalog is exhausted. Country, included/excluded genres and fixed/rolling years retain their semantics. Library, watched and request exclusions are queried fresh per user; personalized strip output is not shared in a server cache.
- Discovery poster cards use native lazy image loading and asynchronous decoding.

## People and portraits

People pages share a **30-second, 200-entry** process cache, including in-flight work. Search, sort, page and size use distinct keys. Every request reads current library configuration; enabled source IDs are part of the key, so disabling a source cannot reuse a page for the previous visibility set. Aggregation and database collation/order remain in SQL. Pages past the end now preserve the correct filtered total instead of reporting zero.

Cached TMDb portrait paths are attached in one small batch query for the returned page, outside the page cache. Browse cards/rows and Person Detail use TMDb portraits directly, with **no Emby actor-portrait requests**. Uncached portraits load near the viewport through shared account-scoped lookups and a short browser cache. Name/account changes and navigation cancel obsolete reads. Missing or failed photos show initials. Emby account avatars are separate.

People pagination prevents repeated intersection callbacks from starting duplicate appends. Account changes cancel old pages. The person-profile endpoint also avoids decoding an already parsed query a second time, preserving names containing literal percent signs.

## Measurements and validation

Read-only comparisons preserved names, credit counts, order and totals on the first/second pages, credit sorting and a name search. Representative final samples:

| Query | Previous | New cold page, including portrait lookup | Repeated page |
| --- | ---: | ---: | ---: |
| First page, name sort | 387ms | 419ms | 6ms |
| Second page | 369ms | 416ms | 2ms |
| Credit sort | 382ms | 408ms | 8ms |
| Name search | 153ms | 172ms | 5ms |

Cold aggregation remains about 0.4 seconds. The improvements remove repeated aggregation and the portrait/optional-metadata waterfalls. These backend samples are not end-to-end guarantees. Newly synced cast changes may take up to 30 seconds to appear in a cached page; library enable/disable changes are checked immediately. Cold uncached JustWatch data still depends on the upstream service.

Run `pnpm test:discovery`, `pnpm test:ui-performance`, `pnpm test:upcoming`, `pnpm test:browser-access`, the appearance suite, `pnpm validate` and `pnpm build`. Regression coverage includes deferred statuses, overlapping movie/TV IDs, account isolation/cancellation, zero upfront poster-detail calls, stale chart refresh/failure, People cache visibility/expiry, empty-page totals, lazy/cancelled portrait reads and duplicate pagination events. The expanded Discovery suite runs in the existing CI validation workflow.

Browser verification uses Gru's data through a read-only local preview. Settings writes, content requests, generation and favorites writes are blocked. This development work does not replace the installed Unraid image.

The final browser preview passed People browsing/search (120,528 total people; 914 matches for the sample search), movie and TV genre strips, and Streaming charts. The trace recorded **zero Emby person-portrait requests** and no failed API responses. Genre rows returned in 228–823ms cold and 37–38ms on repeat; cached/stale Streaming rows returned in 5–15ms, with optional status updates arriving separately. Gru's saved UI preferences matched their pre-test fingerprint. Unraid remained healthy on dev.13; these are local preview results, not a deployed release.

Lint, workspace type checks, production builds, Discovery (27 tests), UI performance (28), Upcoming Episodes (20), browser access (5) and appearance (7) checks passed during validation.
