# Appearance implementation and validation

## Compatibility contract

The default is **Classic**. `createAppTheme(direction)` preserves the original theme options; Studio options are created separately. Appearance never selects another route, replaces a page, changes feature flags, or changes business data. Theme updates do not key/remount the page providers. RTL direction is independent of theme and mode.

`AppearanceProvider` is inside authentication and outside `RtlProviders`. It loads the authenticated account’s preferences, isolates state by account ID, cancels outstanding requests when that account changes, and keeps the previous appearance until a save succeeds. It does not use a shared browser cache. The unauthenticated screen uses Classic. The OS color scheme is observed with MUI `useMediaQuery` when Studio is set to follow the device.

## Storage and API

The existing authenticated preferences API stores an optional field in `user_settings.settings_json.ui`:

```json
{
  "appearance": { "theme": "studio", "mode": "system" }
}
```

`theme` accepts `classic` or `studio`; `mode` accepts `light`, `dark`, or `system`. A PATCH containing `appearance` must include both fields. Invalid enum values or incomplete pairs are rejected by the API schema. GET returns the stored field alongside existing UI preferences. Missing/unknown legacy data normalizes to Classic in the client. No database migration is required.

The UI sends only this field when saving appearance, using the existing partial preference merge. It does not send a snapshot of other preferences, call media-server settings, or start a publication job.

## Styling new components

Prefer MUI palette roles (`background.paper`, `text.secondary`, `divider`, `action.hover`) for normal controls. Studio component overrides cover cards, typography, buttons, tabs, tables, form fields, menus, dialogs, drawers, tooltips, alerts, skeletons, and progress bars, including portal content.

For existing dark-only surfaces and SVG/chart/assistant content, Studio’s `MuiCssBaseline` supplies `--ap-*` semantic variables. Each migrated use includes its exact Classic value as a CSS fallback. Removing Studio removes those variables and restores the fallback, including in portals. Leave white text on dark image overlays intact. Use explicit foreground/background pairs for colored badges. Do not recolor categorical graph edges or chart series merely to match the accent.

Manrope and Barlow Condensed use the existing Google Fonts delivery mechanism with sans-serif fallbacks. Barlow Condensed is restricted to Studio media titles. Classic retains its previous typography. On small Studio screens, the brand icon replaces the longer header wordmark to keep search, mode, and account controls accessible.

## Automated checks

From the repository root:

```sh
apps/api/node_modules/.bin/tsx --test apps/web/src/appearance/theme.test.cts apps/api/src/routes/auth/appearance.test.ts packages/core/src/lib/appearancePreferences.test.ts
pnpm --filter @aperture/web build
pnpm --filter @aperture/api typecheck
```

The seven focused tests cover legacy/malformed preferences, automatic/explicit modes, Classic’s serialized theme compatibility, Studio component/token coverage in LTR and RTL, text/action contrast, API enum validation, and preservation of unrelated settings through an appearance-only update. Core persistence is tested with a mocked database pool; no production database is involved. The web theme test uses `.cts` to match MUI’s CommonJS entry points under Node; the browser uses Vite’s ESM build.

## Isolated browser fixture

```sh
node apps/web/scripts/appearance-preview.mjs
```

Open `http://127.0.0.1:3460/settings?tab=preferences`. This serves the real application with synthetic data. The fixture binds only to loopback, removes the normal API proxy, and intercepts all API requests. Unknown requests return 404 instead of reaching a real service. It does not connect to a database, Unraid, Emby, or an AI provider. Some unrelated integration panels can show their normal unavailable/error states because this fixture is intentionally limited.

The initial synthetic account is **Gru** (admin). To test isolation, sign out and sign in with **Sample** (regular user); passwords are unnecessary in this fixture. These names do not use real accounts. Fixtures reset on restart.

Manual review checklist:

1. Start on Classic. Select Studio, choose each mode, save, and reload. Return to Classic and confirm its original palette, font, sidebar width, and absence of Studio CSS variables. Return to Studio and check the remembered mode.
2. In Recommendations, switch movie/TV tabs and grid/list layouts. Check ranks, trailers, ratings, match scores, and Pin/Unpin controls. Check the existing controls rather than mockup-only interactions.
3. Visit Dashboard, Tonight, settings, and the admin settings categories. Check search, sidebar collapse, account menu, and assistant opening. Check dark-only surfaces and labels in both modes.
4. Sign out/in between synthetic accounts. A regular user can select appearance but must not gain admin navigation. The other account’s selection must remain unchanged.
5. At 320px and desktop widths, check header controls, mobile drawer, theme picker, dialogs, and form labels. Check an Arabic or Hebrew locale for mirrored chrome and readable labels.
6. Simulate a failed preference save with `curl -X POST -H 'Content-Type: application/json' --data '{"count":1}' http://127.0.0.1:3460/_qa/fail-preferences`, then use the header toggle. It must show an error and keep the prior mode. The fixture’s `/_qa/state` endpoint exposes only synthetic preferences and recorded patches for inspection.

These checks validate the theme and representative existing controls. They do not claim to exercise every external integration or media-server action. Deployment and a live-server smoke check remain separate from this implementation.

## Recorded validation

The implementation was checked with synthetic accounts in the real application on the local fixture:

- Studio light and dark saved successfully and survived a page reload; quick switching left the other preferences intact.
- Switching to Classic restored the original body background (`#0f0f0f`) and removed Studio’s root CSS tokens. The saved Studio mode remained available.
- An injected save failure displayed an error and retained the active dark mode. An injected load failure disabled the appearance controls; Retry restored the saved Studio choice.
- Admin and regular-user preferences remained independent across sign-out/sign-in. The regular user retained no admin navigation. Recorded appearance requests contained only `appearance`; existing sort preferences remained intact.
- Desktop Recommendations retained its movie/TV tabs, grid/list controls, trailer actions, scores, and Emby Home controls. Administration retained its overview/users/jobs/settings tabs and all seven settings categories.
- The settings screen was inspected at 320px and desktop widths. Arabic Studio light rendered with RTL direction and no horizontal page overflow. The mobile header retained navigation, search, mode switching, and the avatar.

Lint, web production build, API/core/UI type checks, and the seven focused tests pass. The production build reports the existing assistant dependency `toJSONSchema` warning and large-bundle warning. No release, deployment, or live-server integration test is implied by these results.
