# Documentation review: 1.0.1 baseline and 1.0.2 development

Reviewed 2026-11-07. Stable baseline: `v1.0.1`; development additions are identified as dev features. Historical release notes and dated benchmark reports retain their original context rather than being rewritten as current instructions.

## Corrections

| Area | Current reference / correction |
|---|---|
| Setup and generated output | [Output formats](admin/output-format.md), [paths](admin/file-locations.md), and [wizard](admin/setup-wizard.md): distinguish output filesystem, original target, server OS, container namespace and optional source mapping. |
| Storage compatibility | Remove universal STRM claims, hard-link-style same-filesystem restrictions, whole-season Emby symlink descriptions and format-based Direct Play promises. Explain Windows/native/container differences, network shares and optional sidecars. |
| Validation | Distinguish local creation, Emby visibility, sampled directory-link resolution and unverified playback. Source mount absence is advisory; Top Picks participates in setup checks. |
| Model instructions | [Providers](admin/ai-providers.md), [chat](admin/chat-models.md), [text](admin/text-models.md), [embeddings](admin/embedding-models.md) and [costs](admin/cost-estimator.md): use live discovery/capabilities and estimates instead of dated model rankings and prices. |
| Encore and navigation | [Assistant](features/ai-assistant.md), user index and architecture now describe the workspace, saved conversations, memory, plans, scoped MCP and approved actions. |
| Retired outputs | [Generated libraries](features/virtual-libraries.md): Watching uses favorites synchronization rather than a separate STRM library. |
| Operations | Correct backup default to 02:00 in current guides/Compose comments; clarify tag-driven image publishing, stable/dev versions, preserved mounts and refresh steps. |
| Windows recovery | Replace casual volume-deletion reset advice with supported backup/restore guidance; correct the YAML secret explanation. |
| API references | Mark prose as an overview; runtime OpenAPI and schemas are authoritative. Correct output-path property descriptions. |

## Verification and limits

`node scripts/check-doc-links.mjs` checks local file references across the README and current Markdown guides, excluding historical release notes. It does not verify external websites or screenshot freshness. Feature descriptions above were checked against current routes, setup state, publishing code, model registry/configuration and release workflow.

The compatibility tests use real isolated temporary files and simulated media-server directory responses. They establish cleanup, local pointer behavior, warning/failure distinctions behavior; they do not establish every operating-system/filesystem combination or client playback. Actual server-side behavior must be verified on an installation. No live Jellyfin installation was used.

New shared UI guidance uses English pending translations. Existing dated research/performance reports are evidence from their original runs, not current performance guarantees. Screenshots remain illustrative; text and the runtime application take precedence where layouts differ.

Live dev.1 verification found that a private temporary-directory mode blocked a separate Emby account. Dev.2 matches normal publication permissions and adds a regression assertion for traversal/read access.

The completed changes ship in stable **1.0.2**. Live verification on Emby 4.11.0.13 passed output visibility and sampled original-directory resolution, with no temporary probe directories remaining. Playback was deliberately left as a separate manual check.
