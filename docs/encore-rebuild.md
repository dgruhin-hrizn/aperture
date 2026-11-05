# Encore 0.8 implementation and release plan

Encore is a media consultant backed by user-scoped Aperture capabilities. The same services power the native interface and the MCP server. The default is to suggest plans; recurring curation requires an explicit standing instruction.

## Stage 1 — modern runtime and redesigned conversation workspace

Upgrade the AI SDK, provider adapters, assistant-ui integration and Node runtime together. Replace browser-owned history and streaming workarounds with server-owned, idempotent message storage. Ship an accessible, responsive Encore workspace with conversation navigation, rich result surfaces, cancellation, retry and visible failures. Repair numeric-title validation and semantic ranking.

## Stage 2 — shared capabilities and MCP

Move media consultation into a shared core service. Enforce current user/library visibility before returning catalog data. Supply library and external discovery, personal history/profile and sourced release schedules through the same contracts used by Encore and an authenticated MCP endpoint. Provide a local stdio client bridge and self-hosted connection instructions. Add an Encore connections interface for individually scoped, revocable credentials.

## Stage 3 — lasting memory, watch plans and Emby actions

Store scoped, inspectable preferences with provenance and support correction/deletion. Connect appropriate preferences to existing taste controls. Create structured watch plans with timezone, viewing windows, runtime and availability checks. Add owned playlist/home-row operations with persisted action state, idempotency and partial-failure recovery. Ship dedicated memory, plan, schedule and action interfaces inside Encore.

## Stage 4 — opt-in recurring curation

Persist explicitly enabled standing instructions and execute them through the same services in the scheduler. Refresh owned collections, reconcile availability, and preserve manual edits and user permissions. Provide pause/resume/delete, last/next run, results and failure reporting in Encore. Cover the complete journey with deterministic integration tests and scenario evaluations.

## Release discipline

Each stage is a separate PR into dev, followed by a prerelease (0.8.0-dev.1–4) and its versioned container build. Rebase against current dev before each merge. Keep all app version locations synchronized. Run lint/type checks, the production build, Encore tests and existing regression suites. Wait for CI and container publication before reporting a release as complete. No production Emby collection or account is modified during development validation.
