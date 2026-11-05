# Aperture mobile app shell

Mobile opens into Encore, with five primary destinations at the bottom: Discover, Library, Encore, Watching and You. Encore is also directly addressable at `/encore`. Installable home-screen metadata launches that route in standalone mode where the browser supports it.

## Everyday use

- Start with Encore's four conversation starters: tonight's pick, viewing plans, upcoming releases or a collection.
- Open history without leaving the conversation. Drafts and responses survive opening history, opening the workbench or switching primary destinations.
- Use the workspace button for Memory, Watch Plans, Collections, Curation and Connections. Each section has a URL, such as `/encore?view=plans`, and a Back to conversation action.
- Browse while Encore works. Its bottom button shows an activity dot and an accessible working label until the response finishes. Navigation within the app preserves the runtime; reloading, signing out or switching accounts ends it normally.
- You links to settings, appearance, Dashboard, Tonight, recommendations, playlists, history, requests and administrative screens when permitted. Existing settings remain in their canonical location.
- If Shows You Watch is disabled, the fourth destination opens Picks. Tonight is available only for Emby users, as before.

## Interaction and layout

The mobile shell owns the visible viewport, a compact header and a floating capsule dock. Four quiet, labelled destinations surround a raised circular Encore action. A shared set of line icons, a translucent surface and a fine rim give the dock its own shape without a full-width background strip or rectangular selection tiles. The Encore action retains its accessible name, current-page state and working indicator.

The dock respects safe areas, has at least 44px touch targets and reserves room for the composer and page content. Its width is capped in landscape; reduced-motion preferences disable press transitions. The page pane scrolls independently; browser Back restores its prior scroll position. The Media Graph sizes itself to the available pane rather than extending beneath navigation.

Mobile Encore tool results use the full transcript width, with the same side gutters as the composer. Recommendation carousels fit two complete cards across a phone and centre a single result. Paging controls sit above the artwork and disable at the ends. Card actions align even when titles or metadata differ. Desktop retains its assistant avatar column.

Library filters scroll with mobile content rather than sticking over posters inside the page pane. People loading placeholders retain poster proportions; failed People reads offer an in-page retry. Posters load lazily and the media image proxy bounds upstream headers and bodies to eight seconds, cancelling abandoned requests. A slow or missing image can fall back without occupying browser connection slots indefinitely and holding up other reads.

The software keyboard can shrink the visible area without shrinking the layout viewport. The shell follows `visualViewport` resize/scroll and focus events, keeps the composer in the usable area and hides the bottom bar while typing. Pinch zoom remains enabled and is not treated as a keyboard. [VisualViewport reference](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).

Safe-area insets protect controls around notches and home indicators. The viewport declares `viewport-fit=cover` and `interactive-widget=resizes-content`; a viewport listener handles browsers with different keyboard behavior. Form text stays at least 16px on mobile. [WebKit safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/), [viewport metadata reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport).

History and workbench controls use dismissible sheets. Conversation starters begin with a suggestion; existing write approval and recurring-curation opt-in rules still apply. Empty conversations start at the top, while actual message threads follow incoming responses.

## Desktop and account boundaries

Desktop keeps its sidebar and existing Dashboard landing. Encore becomes a full workspace route, reached from the sidebar or its floating entry button. One Encore surface per authenticated account owns its runtime across route changes; hidden transcripts are removed from layout and accessibility navigation. Changing accounts unmounts the old runtime.

Navigation definitions are shared between desktop and the account hub. Feature gating and selection rules are centralized. The shell does not grant new permissions or change backend action policy.

## Home-screen launch

A manifest supplies the application identity, standalone display mode, `/encore` start URL, and 192/512px icons. Apple touch metadata and a 180px icon support home-screen shortcuts. Existing appearance preferences remain authoritative. Installation availability follows the browser's support and secure-context rules. This release does not add offline media/AI operation or cache private API responses in a service worker.

## Validation

Automated regressions cover destination selection for deep links, feature/provider gates, viewport and keyboard changes, pinch zoom, orientation, listener/style cleanup and scroll restoration on Back. Browser verification uses the real app with an isolated API fixture to check drafts and streaming across navigation, history/workspace sheets, keyboard-accessible controls and small-screen layouts. Browser viewport emulation does not replace a physical iOS/Android device check for OS-specific keyboard and home-screen behavior.
