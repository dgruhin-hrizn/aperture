# Generated libraries and other outputs

Aperture can publish per-user movie/TV AI Picks and global Top Picks to the media server. Generated libraries use STRM files or symlinks that reference original videos; they do not duplicate the video bytes.

Administrators choose formats and paths. Compatibility depends on output storage, server-readable target paths, permissions and deployment. Neither format guarantees Direct Play. See [Output formats](../admin/output-format.md) for the operating-system/filesystem matrix, sidecars and verification steps.

AI Recommendations can also use private native Emby playlists (preview), referencing original items. Recipients must sign into Aperture with Emby before the next sync. Top Picks supports library, collection and playlist outputs according to its configuration and media-server capabilities.

Shows You Watch uses the saved followed-series list and media-server favorites synchronization; the current implementation does not create a separate Watching STRM library. See [Shows You Watch](shows-you-watch.md).

Generated libraries create separate media-server entries and can affect duplicate titles or Continue Watching behavior. Private playlists referencing original items are an alternative where supported. Playback and optional subtitle/trickplay behavior should be checked on the actual client.

Saving output settings does not immediately republish files. Run the corresponding publishing job or wait for its schedule. Incremental publishing preserves unchanged files, removes obsolete generated links and requests targeted refreshes for changes. Access is rechecked before publishing; a user's source-library permissions remain authoritative.
