# Curation and Gap Analysis review

Review date: 2026-11-04. This covers the implementation following `v0.7.11-dev.8`. The corrections described below are development changes, not a claim that they have been released or deployed. No new settings, default ranking weights, profile locks, or user appearance preferences are changed.

## What each system actually does

| Surface | Retrieval and ranking | Personalization | Important limit |
| --- | --- | --- | --- |
| Similar Movies / Series | Nearest neighbors of the selected title in the active embedding model | The direct list and title graph now honor the viewer's Similar “hide watched” setting | A cosine score describes content resemblance, not a calibrated probability that this user will enjoy it |
| Expanded similarity graph | Neighbor expansion, metadata checks, franchise limits and optional AI escape suggestions | Watched filtering in title graphs; some Explore expansion paths still lack user context | AI escape edges use a fixed score; cross-media expansion is not implemented by the same-type neighbor queries |
| AI Picks | Weighted history profile → vector retrieval → quality/novelty/themes → genre/franchise/interest boosts → diversity selection | Favorites, viewing engagement, recency, ratings, explicit preferences, source groups and repeat history | Preferences applied after retrieval cannot recover a title omitted from the candidate pool |
| Movie Collection Gaps | Synced movie collection IDs → released TMDb collection members → local ownership and optional Seerr status | Server-wide administration, not personal taste ranking | It does not detect missing TV episodes/seasons or recommend which missing film a particular viewer will enjoy |

Primary code: `packages/core/src/similarity/{index,diverse,reasons}.ts`, `packages/core/src/taste-profile/{index,builder}.ts`, `packages/core/src/recommender/{movies,series,shared}`, `packages/core/src/gap-analysis/index.ts`, and the corresponding API routes.

## Correctness fixes included in this review

### Similar titles and search

- Pass the authenticated user into both direct Similar APIs and the single-level graph API. Previously these paths silently ignored the configured watched preference.
- Exclude watched title IDs **before the nearest-neighbor limit**. Reuse the expanded movie/series watched-ID helpers, including duplicate copies identified through external IDs and playback at least 5% complete. Favorites alone are positive taste signals, not proof of playback. A series is considered started when any episode meets the same playback rule. The selected center remains visible even when watched.
- Reuse a request-scoped watched set during title-graph expansion rather than reloading it for each node. Clamp direct neighbor limits and title-graph depth; enforce the node ceiling for AI escape additions as well.
- Stop hiding database/provider errors behind a successful empty Similar response. Missing embeddings still return an empty list through the normal core result.
- For mixed movie/TV semantic search, retrieve up to the requested count from **each** pool before merging by similarity. A fixed half-movie/half-TV retrieval quota previously missed stronger results and left slots empty when a pool was sparse. This remains semantic search, not personalized taste ranking, and requires at most twice the requested number of candidate rows.
- Semantic search's watched check now requires actual played/in-progress evidence instead of treating every synced history row as watched. Its direct SQL still lacks external-ID duplicate expansion; that remains a follow-up.
- AI connection validation now accepts whitespace/fenced YES/NO replies. Provider failures or unrecognized replies are temporary unverified results, never cached as permanent rejections. Previously cached `AI validation error` entries are ignored without deleting administrator data. Cache model/version freshness remains a follow-up.

### Taste profiles

- Normalize each source embedding before averaging. Engagement weights should determine influence; embedding magnitude is not a preference signal. This matters when a provider returns non-unit vectors. Skip nonfinite, zero, mismatched-dimension or nonpositive-weight inputs; a cancelling/empty vector yields no profile.
- Bound recency at the present. Future playback timestamps cannot inflate weights; invalid timestamps cannot introduce NaNs into the profile.
- Check model compatibility even when a profile is already stale. Do not reuse an old vector after rebuilding for a new model fails. A locked profile belonging to a different/unknown model produces an actionable error rather than being silently reused or overwritten. A same-model locked profile stays locked and usable.
- These corrections apply when a profile is next built/read; there is no bulk regeneration or forced unlocking. Existing same-model stored profiles retain their normal refresh cadence.

### Gap Analysis

- Preserve the last complete snapshot while a refresh runs, including in the UI polling path. First-ever scans can still stream partial results. A failed scan removes only its own partial results.
- Treat unavailable TMDb collections or unverifiable configured Seerr status as scan failures, retaining the last useful snapshot. Explicit TMDb 404 responses mean a collection was removed and can be skipped; they are distinguished from outages.
- Prune old snapshots only after a successful scan: keep the latest two completed snapshots and latest five failed run records; never prune running scans. Cleanup failure does not invalidate successfully completed results. Failed runs can accumulate until the next successful scan.
- Validate calendar dates strictly, including leap years. Unknown/future releases are excluded. Parse only positive PostgreSQL-range TMDb IDs; malformed collection metadata no longer crashes an integer cast.
- Deduplicate each collection's members before counting and persist one chunk with `jsonb_to_recordset`, replacing one write per part. Counts now match persisted rows.
- Overlay current local ownership and active requests consistently across the missing-title list, collection summaries and collection-part details. A newly synced or requested movie disappears from actionable gaps without another TMDb scan. Cached Seerr availability and previously recorded ownership still require a scan to detect removals or externally changed status.
- Bind collection-part details to the displayed snapshot with an optional `runId`, avoiding mixed-run cards during refresh. Older callers can omit it to use the latest completed run.
- Bound pagination to finite integer values and add stable release-sort tie breakers.
- Reject invalid request IDs/titles, treat an available request as blocking, and mark pre-submission exceptions failed rather than leaving requests pending indefinitely. If Seerr already confirmed submission, a subsequent local save error does not mark it retryable. Network ambiguity and cross-user/concurrent request deduplication still need reconciliation support.

The live server was inspected only through read-only database sessions. Scan, request, recommendation generation and deployment were not run there. Integration writes and simulated HTTP responses use a separate local fixture database, never the live server or paid AI providers.

## Remaining work, in priority order

### 1. Share eligibility policy across all discovery surfaces

The AI Picks pipeline and STRM publication already check Emby source access; basic similarity, semantic search and AI title-to-library matching do not use that same policy. Their SQL can inspect the wider synced catalog. Do not equate recommendation publication protection with consistent browsing eligibility.

Build one request-scoped eligibility context covering enabled source libraries, Emby user policy, parental restrictions and explicit dislike behavior. Apply it to initial candidates **and every expansion/fallback path**, including semantic graphs and AI escape title matching. Verify exact source items before playback/publication, retaining the existing fail-closed STRM protection. Avoid a network permission lookup per graph edge. Library exclusions currently mean “ignore this history in my taste,” and should not silently become an unrelated “hide this catalog” setting.

### 2. Invalidate profiles when meaningful inputs change

`getUserTasteProfile` uses the saved refresh interval; the default is 30 days. Rating mutation routes do not call `invalidateProfile`. A fresh explicit rating therefore affects candidate dislike handling sooner than it changes the saved history centroid. Watch-history imports, favorite changes and excluded-history-library changes should also participate in invalidation.

Use a history/preference revision or a coalesced dirty marker, preserving profile locks. Cover manual and bulk/Trakt rating updates, imports and deletes. Rebuild once per generation rather than once per individual imported rating. No such invalidation is forced by this review.

### 3. Improve candidate recall before tuning ranking weights

The main centroid can blur very different interests. Custom interests currently boost only the top 100 candidates already retrieved and scored; low-history accounts are stopped before ratings/interests can provide independent seeds. Candidate dislike exclusions are mostly row-ID based, leaving edition duplicates as a further audit target.

Test a bounded union of candidates from:

1. The engagement-weighted history centroid.
2. Recent favorites and highly rated seeds, deduplicated by canonical identity.
3. Explicit custom-interest vectors, using the same model and eligibility rules.
4. A small exploration pool with a relevance floor.

Merge/deduplicate first, then score. Keep source-title resemblance dominant in Similar views, with only a bounded personal rerank. Do not turn a user opening one title into an unrelated general-purpose AI Picks list.

### 4. Separate preference strength from engagement volume

The current persistent profile gives a 1/10 rating a multiplier of 0.575 and a 10/10 rating 1.25. A strongly watched but disliked film can still contribute positively to the taste centroid. Favorites, logarithmic episode count and recency are useful signals, but multiplying them together is a heuristic, not validated enjoyment prediction.

Compare a positive-only centroid with a separately normalized negative profile; use explicit low ratings as the negative signal, not “Not tonight.” That action is temporary session feedback and must keep its existing no-taste-change promise. Keep enduring favorites separate from current mood so recency does not erase them. TV completion should count genuinely played episodes, not favorite-only rows, and distinguish continuing/ended shows and available/released episodes. Movie legacy fallback history orders favorites/play counts before recency, unlike the persistent builder; reconcile those definitions.

### 5. Improve diversity without discarding good matches

Current selection uses genre presence and TV networks as diversity proxies. Once several genres are present, further genre-based distinctions flatten out. Franchise caps do not apply uniformly to initial graph neighbors, and title-pattern/shared-genre gates can reject meaningful thematic or cross-genre connections, particularly with incomplete metadata. `fullFranchiseMode` and AI escape should have explicit compatible semantics. `includeCrossMedia` currently does not make same-type queries retrieve the opposite type.

Compare a maximal marginal relevance reranker using candidate embedding redundancy plus explicit edition/franchise caps, with a minimum relevance floor. Show evidence grounded in shared metadata, relevant watched seeds and expressed interests; do not present a raw cosine score or the graph's fixed AI escape score as a percentage likelihood of liking the title. Version validation caches by model and metadata fingerprint, with expiry. Check filtered nearest-neighbor recall and query plans on each supported pgvector version; an approximate index can still underfill after filtering unless its scan settings and candidate budget are appropriate.

### 6. Evolve gaps into useful acquisition decisions

Keep “collection completeness” distinct from “recommended acquisition.” Provide a completeness view for collectors and an opt-in view ranking missing films by the intended audience's interests, request state and source/content restrictions. Completing a collection is not evidence its remaining titles are desirable.

TV needs a separate model: stable series identity, released seasons/episodes, specials, episode numbering and regional release dates. Do not infer a TV gap solely from a TMDb series count. Distinguish unknown metadata/upstream status from verified missing content, and retain a visible last-success timestamp. Add a database-backed scan lease with crash recovery; the current job guard is process-local, and stale `running` rows can outlive a restart. Before submitting acquisition requests, recheck current ownership/request status and use atomic cross-user deduplication plus reconciliation for uncertain Seerr outcomes.

## How to establish that curation is better

No ranking-quality improvement percentage has been established in this review. Code correctness tests and query timing do not measure enjoyment.

Use an evaluation dataset with a fixed time cutoff, then score subsequent positive plays/ratings. Reconstruct profiles, exclusions, library availability, ratings and learned boosts **as of that cutoff**. Current `watch_history` is an aggregated state with `last_played_at`, not an immutable playback-event log: rewatches and later edits can leak future information. Label any retrospective result using this snapshot as exploratory. Add minimal event/exposure history before claiming a rigorous temporal benchmark.

Compare the current algorithm against simple popularity, recent-seed similarity and centroid-only baselines, then change one component at a time. Measure retrieval Recall@100/500 and ranking NDCG@10/Recall@10, along with unique-title/franchise coverage, repeat exposure, diversity and list fill. Report per-user results and segments (sparse history, heavy watchers, mixed household tastes, movie/TV, custom interests); avoid letting prolific viewers dominate the aggregate. Unwatched titles are unknown, not automatically negatives. Compare old/new embedding providers separately rather than assuming cosine scores are calibrated across them.

Before changing defaults, run a small opt-in online comparison using starts, meaningful completion and explicit feedback, alongside technical guardrails: zero inaccessible items, no duplicates, cooldown/group rules respected, no unexpected setting changes. Offline ranking gains alone do not establish user satisfaction.

Research context: [Gunawardana and Shani, Evaluating Recommender Systems](https://www.microsoft.com/en-us/research/publication/evaluating-recommender-systems/) explains why evaluation must match the property being assessed. [Ji et al., A Critical Study on Data Leakage in Recommender System Offline Evaluation](https://arxiv.org/abs/2010.11060) supports respecting the global timeline. [Goldstein and Carbonell, MMR](https://aclanthology.org/X98-1025/) provides the relevance-versus-redundancy approach proposed here as an experiment, not an established Aperture improvement.

## Validation

Executed locally on 2026-11-04: `pnpm validate` passed, and 22 relevant recommendation, taste-profile, similarity, gap and API tests passed with zero failures or skips, including both PostgreSQL fixture suites. Simulated upstream responses prevented real acquisition or AI calls.

`pnpm validate` runs repository lint, package builds and all workspace type checks. The Docker workflow also runs the new unit/API safeguards. The PostgreSQL integration fixture is opt-in and intentionally rejects nonlocal databases:

```sh
apps/api/node_modules/.bin/tsx --test \
  packages/core/src/similarity/index.test.ts \
  packages/core/src/taste-profile/curation.test.ts \
  packages/core/src/gap-analysis/index.test.ts \
  apps/api/src/routes/gap-analysis/index.test.ts

# First create an empty local database whose name begins with aperture_test.
APERTURE_TEST_DATABASE_URL=postgresql://localhost/aperture_test_curation \
  apps/api/node_modules/.bin/tsx --test packages/core/src/gap-analysis/index.test.ts
```

The fixture creates/drops its own random schema. It exercises real PostgreSQL inserts, counts, snapshot retention, failure cleanup, active requests and live ownership overlays with TMDb/Seerr HTTP mocked. Unit/API cases cover watched-preference plumbing, mixed-search fill, vector scale invariance, invalid timestamps, model-lock compatibility, validation outage caching and request-failure retry behavior. No new migrations are required.
