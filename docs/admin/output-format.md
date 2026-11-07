# Recommendation output formats

This guide describes **Aperture 1.0.2**, including the output compatibility guidance and checks refined during the 1.0.2 development builds.

Configure generated movie and TV libraries in **Admin → Settings → AI Recommendations → Output**, or during setup. Top Picks has its own output settings and can also use collections and playlists.

## Choose an output

| Output | What it creates | When to choose it |
|---|---|---|
| Generated library with STRM | Small text pointers plus generated metadata/artwork | Native Windows media server, incompatible symlink storage, or mixed deployments |
| Generated library with symlinks | Filesystem links plus generated metadata/artwork | Verified compatible output storage and media-server target paths |
| Private Emby playlist (preview) | References to original Emby items | Prefer original item identity over a separate generated library; recipients must sign into Aperture with Emby before sync |
| Off | Removes the corresponding managed recommendation output on sync | Keep recommendations in Aperture without publishing that media type |

Neither STRM nor symlinks copy the original videos. Neither guarantees Direct Play, faster playback, or better picture quality. The source codecs, tracks, client and network determine playback. Generated libraries are separate entries and can affect duplicate-title or Continue Watching behavior; native playlists reference original items.

## STRM

A STRM file contains a media-server path or supported direct media URL, for example:

```text
D:\Movies\Example (2024)\Example.mkv
```

Emby reads this address using its own operating system and service credentials. A desktop mapped drive may not exist for a Windows service; use a server-accessible local path or UNC share as appropriate. URLs must return supported media, not an HTML video page, and expiring addresses can stop working.

Aperture still needs writable output storage shared with the media server. STRM avoids requiring a local copy of the media mount in Aperture for the video pointer itself; it does not remove the media server's access requirements. Optional source artwork and sidecars have separate requirements.

## Symlinks

Aperture writes a link containing the original **media-server** path. The output filesystem must support creating that link, and the media server must resolve and read its target. Aperture can separately map original media under `/media` for artwork and sidecars. Identical container paths are not required when those mappings are correct.

Symbolic links can cross filesystems, disks and mounts. They are not hard links. The original-video filesystem does not need to support creating symlinks: the link is stored on the **generated-output filesystem**.

For Emby, TV publishing links individually verified episodes. It does not link whole season directories. Other provider paths can differ; Jellyfin compatibility has not been established through a live installation in this release.

## Operating systems and storage

| Deployment or storage | Guidance |
|---|---|
| Linux / Unraid, compatible local output | Symlinks can work with resolvable targets and appropriate permissions. ext4, XFS, Btrfs and ZFS generally support native links. |
| Linux Aperture container + native Windows Emby | Choose STRM using Windows paths or accessible UNC shares. Windows NTFS symlinks do not make Linux-created pointers portable to this deployment. |
| Both apps in Linux containers on Windows/macOS | Test the filesystem exposed to the containers and their mount paths. Host OS alone does not decide compatibility. |
| Native macOS media server | Check the media-server paths and whether the shared output preserves links created by the Linux container. |
| FAT32 / exFAT generated output | No native symlinks. Choose STRM for video pointers; optional symlinked sidecars can still be unavailable. |
| NTFS / APFS output exposed through a VM, Docker or filesystem driver | Native filesystem features alone do not establish cross-environment compatibility. Test actual creation and server-side resolution. |
| NAS / SMB / NFS | Protocol, client/server implementation, mount/export settings and permissions determine link handling. Verify both ends. |
| Original videos on another volume, NAS or exFAT disk | This alone does not prevent links stored on compatible output storage. Targets must remain resolvable and readable. |

A read-only original-media mount is appropriate. Output storage must be writable by Aperture and readable by the media server.

## Artwork, subtitles and other sidecars

Generated metadata and downloaded artwork are distinct from original sidecars. Aperture reads accessible source folders to link supported artwork/subtitle files and match sidecar names to generated media names. Some TV publishing paths attempt sidecar links even when the video uses STRM. Missing source mounts, permissions or unsupported symlink storage can leave optional sidecars absent. Test external subtitles, alternate audio, seeking and any trickplay features on your actual client; do not assume complete feature equivalence with the original item.

## Paths: an example

| Role | Example |
|---|---|
| Host folder for generated output | `/mnt/user/Media/ApertureLibraries` |
| Aperture's mount for that output | `/aperture-libraries` |
| Emby's view of the same output | `/mnt/ApertureLibraries` |
| Original file as Emby sees it | `/mnt/Movies/Example/Example.mkv` |
| Optional Aperture view of that original | `/media/Movies/Example/Example.mkv` |

The output-path setting takes **Emby's view**, not the host path or Aperture's internal mount. Source-prefix mapping translates Emby's original paths to Aperture's optional `/media` mount. A single prefix mapping cannot describe arbitrary unrelated source roots; organize mounts accordingly.

## Check compatibility

In 1.0.2, use **Check output compatibility** beside the format controls. Save path changes first; the check uses saved paths and the selected format.

- Output write access: creates and removes an isolated temporary directory.
- Local symlink support: creates and follows a link on the output filesystem when selected.
- Emby output visibility: asks the administrator-only directory API to list the temporary output marker.
- Emby link resolution: when a catalog movie path is available, follows a temporary directory link and checks that the sampled original file is listed.
- Optional source access: an absent `/media` mount produces a warning, not an automatic STRM failure.
- Playback: remains unverified. Neither directory listing nor local link creation establishes that media bytes decode or play on your client.

Provider/API limitations or unavailable samples require manual verification. Warnings are distinct from failed required checks. Top Picks choices are checked when saved during setup, as well as AI Recommendation choices. Existing administrators can run the same check from their output settings.

Publish a small movie/TV selection and play both in Emby before enabling scheduled publishing. Verify that other accounts see only their authorized output. Aperture checks current source access before publishing, removes stale authorized-output links, and withholds output when verification fails.

## Changing modes and ongoing updates

Save the format, run the corresponding movie/TV publishing job, and inspect the updated library. Changing a toggle alone does not immediately rewrite existing output. Current publishing reconciles files so unchanged output retains timestamps and identities; obsolete generated links are removed. The Emby job queue and paced refreshes reduce overlapping work. Avoid triggering repeated full-library scans to test a mode change.

## References

- [Emby STRM documentation](https://emby.media/support/articles/Strm-Files.html)
- [Emby pointer paths and service credentials](https://emby.media/learn/articles/media-files/playlists-and-references/Media-STRM-Files.html)
- [Symbolic links and filesystem boundaries](https://www.man7.org/linux/man-pages/man7/symlink.7.html)
- [Microsoft filesystem comparison](https://learn.microsoft.com/en-us/windows/win32/fileio/filesystem-functionality-comparison/)
- [Linux SMB mount behavior](https://docs.kernel.org/admin-guide/cifs/usage.html)
- [File location configuration](file-locations.md)
