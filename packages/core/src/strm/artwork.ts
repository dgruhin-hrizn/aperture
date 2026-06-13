/**
 * Shared artwork symlink utilities
 * 
 * Creates symlinks for artwork files (banner.jpg, clearlogo.png, landscape.jpg, etc.)
 * from the original media folder to recommendation/top picks folders.
 */

import fs from 'fs/promises'
import path from 'path'
import { createChildLogger } from '../lib/logger.js'
import { getConfig } from './config.js'

const logger = createChildLogger('artwork-symlinks')

type PathPrefixes = {
  mediaServerPathPrefix: string
  localMediaPathPrefix: string
}

let pathPrefixOverride: PathPrefixes | null = null

/** @internal Override path prefixes in unit tests */
export function setPathPrefixOverrideForTests(override: PathPrefixes | null): void {
  pathPrefixOverride = override
}

async function getPathPrefixes(): Promise<PathPrefixes> {
  if (pathPrefixOverride) {
    return pathPrefixOverride
  }

  const config = await getConfig()
  return {
    mediaServerPathPrefix: config.mediaServerPathPrefix,
    localMediaPathPrefix: config.localMediaPathPrefix,
  }
}

export interface SymlinkArtworkOptions {
  /** Media server path to the original folder (what Emby sees, e.g., /mnt/Television/Show) */
  mediaServerPath: string
  /** Local path where symlinks should be created */
  targetPath: string
  /** Files to skip (we create these ourselves) */
  skipFiles?: string[]
  /** Whether to skip season/Season folders */
  skipSeasonFolders?: boolean
  /** Media type for logging */
  mediaType?: 'movie' | 'series'
  /** Title for logging */
  title?: string
}

/**
 * Default files to skip for series
 */
export const SERIES_SKIP_FILES = ['poster.jpg', 'fanart.jpg', 'tvshow.nfo', 'Season 00']

/**
 * Default files to skip for movies
 */
export const MOVIE_SKIP_FILES = ['poster.jpg', 'fanart.jpg', 'movie.nfo']

/**
 * Video file extensions to skip (we create our own symlink to the video file)
 */
const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg',
  '.ts', '.m2ts', '.vob', '.iso', '.divx', '.xvid', '.3gp', '.ogv', '.rmvb',
])

/**
 * Subtitle file extensions handled by basename-matched sidecar symlinks
 */
const SUBTITLE_EXTENSIONS = new Set([
  '.srt', '.sub', '.idx', '.ass', '.ssa', '.vtt', '.smi', '.pgs', '.sup',
])

/**
 * Other sidecar extensions keyed to the video basename (Emby trickplay, chapters, etc.)
 */
const VIDEO_BASENAME_SIDECAR_EXTENSIONS = new Set([
  '.bif',
  '.xml',
])

/**
 * Check if a file is a video file by extension
 */
function isVideoFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase()
  return VIDEO_EXTENSIONS.has(ext)
}

/**
 * Check if a file is a subtitle file by extension
 * Handles both simple (.srt) and language-tagged (.en.srt) extensions
 */
function isSubtitleFile(filename: string): boolean {
  const lowerName = filename.toLowerCase()
  for (const ext of SUBTITLE_EXTENSIONS) {
    if (lowerName.endsWith(ext)) return true
  }
  return false
}

/**
 * Sidecar files that must share the media file basename for Emby to associate them.
 */
export function isBasenameMatchedSidecar(filename: string): boolean {
  if (isSubtitleFile(filename)) {
    return true
  }

  const ext = path.extname(filename).toLowerCase()
  return VIDEO_BASENAME_SIDECAR_EXTENSIONS.has(ext)
}

/**
 * Check if a file is an NFO file (we create our own)
 */
function isNfoFile(filename: string): boolean {
  return path.extname(filename).toLowerCase() === '.nfo'
}

const POSTER_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

/**
 * Alternate local poster filenames Emby may prefer over our custom poster.jpg.
 * Skip symlinking these so the overlaid poster.jpg stays authoritative.
 */
export function isCompetingPosterFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  const ext = path.extname(lower)
  if (!POSTER_IMAGE_EXTENSIONS.has(ext)) {
    return false
  }

  // Already handled via explicit skip lists
  if (lower === 'poster.jpg' || lower === 'fanart.jpg') {
    return false
  }

  if (lower === 'folder.jpg' || lower === 'cover.jpg' || lower === 'poster.png') {
    return true
  }

  // season01-poster.jpg, show-poster.png, etc.
  if (/-poster\.(jpg|jpeg|png|webp)$/.test(lower)) {
    return true
  }

  return /(?:^|[-_.])(poster|folder|cover)(?:[-_.]|\.)/.test(lower)
}

function matchesOriginalBasename(filename: string, originalBasename: string): boolean {
  return filename.toLowerCase().startsWith(originalBasename.toLowerCase())
}

/**
 * Symlink artwork files from original media folder to target folder.
 * 
 * Uses local path (derived from config) to read the directory listing,
 * but creates symlinks pointing to media server paths so Emby can resolve them.
 * 
 * Automatically skips:
 * - Video files (.mp4, .mkv, etc.) - we create our own symlinks/STRMs
 * - NFO files - we create our own with custom metadata
 * - Basename-matched sidecars (.srt, .bif, etc.) - handled by symlinkBasenameMatchedSidecars
 * - Files in the skipFiles list (poster.jpg, fanart.jpg, etc.)
 * - Season folders (if skipSeasonFolders is true)
 * 
 * @returns Number of symlinks created
 */
export async function symlinkArtwork(options: SymlinkArtworkOptions): Promise<number> {
  const {
    mediaServerPath,
    targetPath,
    skipFiles = SERIES_SKIP_FILES,
    skipSeasonFolders = true,
    mediaType = 'series',
    title = 'unknown',
  } = options

  const { mediaServerPathPrefix, localMediaPathPrefix } = await getPathPrefixes()
  
  // Convert media server path to local path for reading directory
  const localPath = mediaServerPath.replace(
    mediaServerPathPrefix,
    localMediaPathPrefix
  )

  let symlinksCreated = 0

  try {
    const files = await fs.readdir(localPath)
    const skipSet = new Set(skipFiles.map(f => f.toLowerCase()))

    for (const file of files) {
      // Skip files we create ourselves
      if (skipSet.has(file.toLowerCase())) continue
      
      // Skip season folders if requested
      if (skipSeasonFolders && file.toLowerCase().startsWith('season ')) continue

      // Skip video files - we create our own symlinks/STRMs for the main video
      if (isVideoFile(file)) continue

      // Skip basename-matched sidecars - we create renamed symlinks separately
      if (isBasenameMatchedSidecar(file)) continue

      // Skip NFO files - we create our own with custom metadata
      if (isNfoFile(file)) continue

      // Skip alternate poster files so our custom poster.jpg with rank overlay wins
      if (isCompetingPosterFile(file)) continue

      // Check if it's a file (not a directory) - except for special folders we might want
      const localFilePath = path.join(localPath, file)
      try {
        const stats = await fs.stat(localFilePath)
        if (stats.isDirectory()) continue
      } catch {
        // Can't stat, skip
        continue
      }

      // Symlink target uses MEDIA SERVER path (what Emby sees)
      const originalFilePath = path.join(mediaServerPath, file)
      const symlinkPath = path.join(targetPath, file)

      try {
        // Remove existing file/symlink if present
        try {
          await fs.lstat(symlinkPath)
          await fs.unlink(symlinkPath)
        } catch {
          // Doesn't exist, fine
        }
        
        await fs.symlink(originalFilePath, symlinkPath)
        symlinksCreated++
        logger.debug({ file, mediaType, title }, 'Created artwork symlink')
      } catch (err) {
        logger.debug({ err, file, mediaType, title }, 'Failed to symlink artwork file')
      }
    }

    if (symlinksCreated > 0) {
      logger.debug({ title, mediaType, count: symlinksCreated }, '🎨 Symlinked artwork files')
    }
  } catch (err) {
    logger.debug({ err, title, mediaType, localPath }, 'Could not read original folder for artwork symlinks')
  }

  return symlinksCreated
}

/**
 * Get the series folder path from an episode path.
 * Goes up two levels: episode -> season folder -> series folder
 */
export function getSeriesFolderFromEpisodePath(episodePath: string): string {
  return path.dirname(path.dirname(episodePath))
}

/**
 * Get the series folder path from a season folder path.
 * Goes up one level: season folder -> series folder
 */
export function getSeriesFolderFromSeasonPath(seasonPath: string): string {
  return path.dirname(seasonPath)
}

/**
 * Get the movie folder path from a movie file path.
 * Goes up one level: movie file -> movie folder
 */
export function getMovieFolderFromFilePath(filePath: string): string {
  return path.dirname(filePath)
}

export interface SymlinkBasenameMatchedSidecarsOptions {
  /** Media server path to the original folder (what Emby sees) */
  mediaServerPath: string
  /** Local path where symlinks should be created */
  targetPath: string
  /** Base filename for our video (without extension), e.g. "Movie Name (2020) [id]" */
  targetBasename: string
  /** Original video filename (without extension) to match against sidecars */
  originalBasename: string
  /** Title for logging */
  title?: string
}

async function removeStaleMisnamedSidecars(
  targetPath: string,
  originalBasename: string,
  targetBasename: string
): Promise<void> {
  let targetFiles: string[]
  try {
    targetFiles = await fs.readdir(targetPath)
  } catch {
    return
  }

  for (const file of targetFiles) {
    if (!isBasenameMatchedSidecar(file)) continue
    if (!matchesOriginalBasename(file, originalBasename)) continue

    const suffix = file.substring(originalBasename.length)
    const expectedName = `${targetBasename}${suffix}`
    if (file === expectedName) continue

    try {
      await fs.unlink(path.join(targetPath, file))
      logger.debug({ file, expectedName }, 'Removed stale misnamed sidecar symlink')
    } catch {
      // Best-effort cleanup
    }
  }
}

/**
 * Symlink sidecar files from the original media folder, renaming to match our video file.
 *
 * Handles subtitles, Emby BIF trickplay files, chapter XML, and other basename-keyed sidecars.
 *
 * For example:
 * - Original: "Release.Name.2026.bif"
 * - Becomes: "Movie Name (2020).bif"
 *
 * @returns Number of sidecar symlinks created
 */
export async function symlinkBasenameMatchedSidecars(
  options: SymlinkBasenameMatchedSidecarsOptions
): Promise<number> {
  const {
    mediaServerPath,
    targetPath,
    targetBasename,
    originalBasename,
    title = 'unknown',
  } = options

  const { mediaServerPathPrefix, localMediaPathPrefix } = await getPathPrefixes()

  // Convert media server path to local path for reading directory
  const localPath = mediaServerPath.replace(
    mediaServerPathPrefix,
    localMediaPathPrefix
  )

  await removeStaleMisnamedSidecars(targetPath, originalBasename, targetBasename)

  let symlinksCreated = 0

  try {
    const files = await fs.readdir(localPath)
    const originalBasenameLower = originalBasename.toLowerCase()

    for (const file of files) {
      if (!isBasenameMatchedSidecar(file)) continue

      const fileLower = file.toLowerCase()
      if (!fileLower.startsWith(originalBasenameLower)) continue

      const suffix = file.substring(originalBasename.length)
      const newFilename = `${targetBasename}${suffix}`

      const originalFilePath = path.join(mediaServerPath, file)
      const symlinkPath = path.join(targetPath, newFilename)

      try {
        try {
          await fs.lstat(symlinkPath)
          await fs.unlink(symlinkPath)
        } catch {
          // Doesn't exist, fine
        }

        await fs.symlink(originalFilePath, symlinkPath)
        symlinksCreated++
        logger.debug({ original: file, renamed: newFilename, title }, 'Created basename-matched sidecar symlink')
      } catch (err) {
        logger.debug({ err, file, title }, 'Failed to symlink basename-matched sidecar file')
      }
    }

    if (symlinksCreated > 0) {
      logger.debug({ title, count: symlinksCreated }, '📝 Symlinked basename-matched sidecar files')
    }
  } catch (err) {
    logger.debug({ err, title, localPath }, 'Could not read original folder for basename-matched sidecar symlinks')
  }

  return symlinksCreated
}

/** @deprecated Use symlinkBasenameMatchedSidecars */
export type SymlinkSubtitlesOptions = SymlinkBasenameMatchedSidecarsOptions

/** @deprecated Use symlinkBasenameMatchedSidecars */
export async function symlinkSubtitles(options: SymlinkSubtitlesOptions): Promise<number> {
  return symlinkBasenameMatchedSidecars(options)
}
