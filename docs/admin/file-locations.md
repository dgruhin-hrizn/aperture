# File locations and path mapping

Configure paths during setup or in the media-server settings. These are paths seen by applications, not necessarily paths on the Docker host.

## Two mappings

1. **Aperture Libraries Path**: where the media server sees the folder that Aperture mounts at `/aperture-libraries`. Both must refer to the same physical output storage. Aperture writes here; the media server reads here.
2. **Media Server Path Prefix**: the original-media prefix seen by the server, mapped into Aperture's optional `/media/` mount. This is used when reading original artwork and sidecars. Generated pointers retain the original server paths.

Example: Emby sees `/mnt/Movies/Example/Example.mkv`, while Aperture sees `/media/Movies/Example/Example.mkv`. The prefix is `/mnt/`. If the host output folder is `/mnt/user/Media/ApertureLibraries` and Emby mounts `/mnt/user/Media` at `/mnt`, set the output path to `/mnt/ApertureLibraries`.

Do not copy `/mnt/user/...` or `/volume1/...` from a host example unless that is also the path inside your media-server process/container. A media server on another machine needs its own working share mount or accessible path to the same output.

## Auto-detection

Auto-detection compares catalog paths with Aperture's readable source mount. It can fail before catalog import, without a source mount, or with unrelated roots/multiple mappings. Different underlying filesystems are not inherently a problem. Configure paths manually when detection is unavailable.

## Windows

For Aperture in Linux Docker with native Windows Emby, select STRM for movies and TV. Set the output path to the Windows location, such as `C:\ApertureLibraries`, and use original paths that the Emby service can read. Desktop drive mappings and service accounts may differ. See the [Windows guide](windows-docker-desktop.md).

If both applications use Linux containers, use their container paths and verify the exposed filesystem rather than inferring compatibility from the Windows/macOS host.

## Verification

In 1.0.2-dev.1, save paths and run **Check output compatibility**. Local output writing, local symlink creation and Emby-side path visibility are separate checks. Missing optional source access is a warning. A successful directory check does not verify playback: publish one movie and episode, then test them in the media server.

Read the [output-format guide](output-format.md) for the filesystem matrix, network-share limitations, sidecars, permissions and switching formats. Test after changing paths or mounts. Existing generated files change on the next publishing run, not immediately when a setting is saved.
