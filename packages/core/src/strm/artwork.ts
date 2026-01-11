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
 * Subtitle file extensions to skip (we create our own symlinks with proper naming)
 */
const SUBTITLE_EXTENSIONS = new Set([
  '.srt', '.sub', '.idx', '.ass', '.ssa', '.vtt', '.smi', '.pgs', '.sup',
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
  // Check for direct subtitle extensions
  for (const ext of SUBTITLE_EXTENSIONS) {
    if (lowerName.endsWith(ext)) return true
  }
  return false
}

/**
 * Check if a file is an NFO file (we create our own)
 */
function isNfoFile(filename: string): boolean {
  return path.extname(filename).toLowerCase() === '.nfo'
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

  const config = await getConfig()
  
  // Convert media server path to local path for reading directory
  const localPath = mediaServerPath.replace(
    config.mediaServerPathPrefix,
    config.localMediaPathPrefix
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

      // Skip subtitle files - we create our own symlinks with proper naming
      if (isSubtitleFile(file)) continue

      // Skip NFO files - we create our own with custom metadata
      if (isNfoFile(file)) continue

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

export interface SymlinkSubtitlesOptions {
  /** Media server path to the original folder (what Emby sees) */
  mediaServerPath: string
  /** Local path where symlinks should be created */
  targetPath: string
  /** Base filename for our video (without extension), e.g. "Movie Name (2020) [id]" */
  targetBasename: string
  /** Original video filename (without extension) to match against subtitles */
  originalBasename: string
  /** Title for logging */
  title?: string
}

/**
 * Symlink subtitle files from original media folder, renaming to match our video file.
 * 
 * For example:
 * - Original: "Movie Name - Bluray-1080p.en.srt"
 * - Becomes: "Movie Name (2020) [id].en.srt"
 * 
 * Preserves language tags and subtitle type suffixes.
 * 
 * @returns Number of subtitle symlinks created
 */
export async function symlinkSubtitles(options: SymlinkSubtitlesOptions): Promise<number> {
  const {
    mediaServerPath,
    targetPath,
    targetBasename,
    originalBasename,
    title = 'unknown',
  } = options

  const config = await getConfig()
  
  // Convert media server path to local path for reading directory
  const localPath = mediaServerPath.replace(
    config.mediaServerPathPrefix,
    config.localMediaPathPrefix
  )

  let symlinksCreated = 0

  try {
    const files = await fs.readdir(localPath)
    const originalBasenameLower = originalBasename.toLowerCase()

    for (const file of files) {
      // Only process subtitle files
      if (!isSubtitleFile(file)) continue

      // Check if this subtitle matches the original video filename
      const fileLower = file.toLowerCase()
      if (!fileLower.startsWith(originalBasenameLower)) continue

      // Extract the suffix after the original basename (e.g., ".en.srt" or just ".srt")
      const suffix = file.substring(originalBasename.length)
      
      // Create new filename with our basename
      const newFilename = `${targetBasename}${suffix}`
      
      // Symlink target uses MEDIA SERVER path (what Emby sees)
      const originalFilePath = path.join(mediaServerPath, file)
      const symlinkPath = path.join(targetPath, newFilename)

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
        logger.debug({ original: file, renamed: newFilename, title }, 'Created subtitle symlink')
      } catch (err) {
        logger.debug({ err, file, title }, 'Failed to symlink subtitle file')
      }
    }

    if (symlinksCreated > 0) {
      logger.debug({ title, count: symlinksCreated }, '📝 Symlinked subtitle files')
    }
  } catch (err) {
    logger.debug({ err, title, localPath }, 'Could not read original folder for subtitle symlinks')
  }

  return symlinksCreated
}

