# Web i18n conventions

## Usage

- Import `useTranslation` from `react-i18next` and call `const { t } = useTranslation()`.
- User-visible strings use `t('namespace.key')` or `t('namespace.key', { var: value })` for interpolation.
- Prefer plain `t()` over `<Trans>` unless you need inline markup; then use `Trans` from `react-i18next`.

## Key naming

- Use nested objects in `locales/*/translation.json` (e.g. `admin.dashboard.systemStatus`).
- Prefix admin-only copy with `admin.` or `settingsSection.` for settings panels.
- Keep keys stable once shipped; rename only with a migration pass across all locale files.

## Locales

- **Source of truth**: `locales/en/translation.json`.
- Other languages under `locales/<code>/translation.json` should keep the **same key structure** as English. Until every key is localized, i18next still falls back to English for missing keys; you can also **copy** missing keys from English into each locale so files stay structurally aligned (see below).

### Syncing missing keys from English

From `apps/web`:

1. **`pnpm i18n:sync`** — Deep-merges English into each non-English locale. **Existing translations are never overwritten.** New keys get English text until a translator replaces them.
2. **`pnpm i18n:delta`** (requires git) — Writes `scripts/i18n/delta/missing-from-en.json` (subtree that was absent in the **last committed** non-English locale vs current English; same shape for every locale) and splits it into `delta/chunk-NN.json` (~20KB each) for batched translation.
3. After a model or translator produces `chunk-01-de.json` (same shape as `chunk-01.json`), apply it:

   `node scripts/i18n/apply-translated-chunk.mjs de scripts/i18n/delta/chunk-01-de.json`

   Repeat for each chunk and each locale. Commit English + locale updates before re-running `i18n:delta` so the git diff reflects only new gaps.

### Linguistic translation at scale

Filling **all** missing strings (~1.4k per locale × 13 non-English locales) is done in batches: translate each `chunk-NN.json` per target language, then apply with `apply-translated-chunk.mjs`. Cursor subagents or an MT API with a glossary for product terms (`Aperture`, `TMDb`, `Seerr`, etc.) work well; preserve `{{…}}` interpolation and `_plural` keys exactly.

## Pluralization

- Use `_plural` suffix keys where needed (e.g. `admin.runningJobs` / `admin.runningJobs_plural`).

## RTL (Arabic, Hebrew)

- **RTL locale list** is defined in web as [`localeDirection.ts`](./localeDirection.ts) and must stay aligned with `isRtlLocale` / `RTL_LOCALE_CODES` in [`packages/core/src/lib/locales.ts`](../../packages/core/src/lib/locales.ts) (core is not imported in the browser bundle). The app sets `document.documentElement.dir` and uses MUI **`direction`** plus Emotion **`stylis-plugin-rtl`** via [`RtlProviders`](../RtlProviders.tsx).
- Prefer **logical CSS** in new UI: `marginInline*`, `paddingInline*`, `borderInline*`, `insetInlineStart` / `insetInlineEnd` instead of `left`/`right` where mirroring matters.
- **Menus and anchored overlays**: if you hardcode `anchorOrigin` / `transformOrigin` with `horizontal: 'right'`, flip to `'left'` when `theme.direction === 'rtl'` (see `Layout` user menu).
- **Horizontal scroll / carousels**: `scrollBy({ left })` is not mirrored by CSS; use `theme.direction` or test in RTL and invert deltas where needed (see `BaseCarousel`, `ContentCarousel`, `Home` carousels).
- **Canvas/SVG graphs** (e.g. similarity graph) may stay LTR for coordinates; treat full mirroring as a follow-up if needed.

## English-only exceptions

- **`apps/web/src/pages/setup/constants/waitingMessages.ts`** — Large rotating list of humor/cultural-reference strings used during setup job waits. Do **not** move these into `translation.json` unless there is a deliberate project to translate or replace them; i18n tooling should not flag this file as “missing keys.”

## API error messages (frontend)

- The API often returns **English** `error` / `message` strings. Full backend localization is separate (e.g. `Accept-Language` and server catalogs).
- **Pragmatic pattern**: keep the **raw server text** for debugging, and optionally frame it with translated chrome:
  - Use `withServerMessageDetail(t, message)` from `lib/withServerMessageDetail.ts`, which maps to `common.errors.serverMessage` (`{{message}}` in English; other locales may add a prefix or label).
  - For assistant tool failures, use `assistant.toolErrorTitle` + `assistant.toolErrorBody` (see `ToolResultError`).
- **Optional**: if an endpoint returns a **stable machine-readable `code`**, you can map `code → i18n key` in a small object next to the caller and show `t('errors.<code>')` with a fallback to `withServerMessageDetail`. Do not invent codes; only map what the API actually returns.
