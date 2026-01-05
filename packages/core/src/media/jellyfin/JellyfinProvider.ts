/**
 * Jellyfin Provider
 *
 * Main provider class that implements MediaServerProvider interface.
 * Delegates to modular implementations for each feature area.
 */

import type { MediaServerProvider } from '../MediaServerProvider.js'
import type {
  AuthResult,
  MediaServerUser,
  Library,
  PaginationOptions,
  PaginatedResult,
  Movie,
  Series,
  Episode,
  WatchedItem,
  WatchedEpisode,
  PlaylistCreateResult,
  CollectionCreateResult,
  LibraryCreateResult,
  PlaylistItem,
} from '../types.js'

import { JellyfinProviderBase } from './base.js'
import { authenticateByName, getServerInfo } from './auth.js'
import { getUsers, getUserById } from './users.js'
import {
  getLibraries,
  getMovieLibraries,
  getTvShowLibraries,
  createVirtualLibrary,
  getUserLibraryAccess,
  updateUserLibraryAccess,
  refreshLibrary,
} from './libraries.js'
import { getMovies, getMovieById, getWatchHistory } from './movies.js'
import { getSeries, getSeriesById, getEpisodes, getEpisodeById, getSeriesWatchHistory } from './series.js'
import {
  createOrUpdatePlaylist,
  deletePlaylist,
  getPlaylistItems,
  removePlaylistItems,
  addPlaylistItems,
  getGenres,
} from './playlists.js'
import {
  createOrUpdateCollection,
  deleteCollection,
  getCollectionItems,
  addCollectionItems,
  removeCollectionItems,
} from './collections.js'

export class JellyfinProvider extends JellyfinProviderBase implements MediaServerProvider {
  // Authentication
  async authenticateByName(username: string, password: string): Promise<AuthResult> {
    return authenticateByName(this, username, password)
  }

  async getServerInfo(apiKey: string): Promise<{ id: string; name: string; version: string }> {
    return getServerInfo(this, apiKey)
  }

  // Users
  async getUsers(apiKey: string): Promise<MediaServerUser[]> {
    return getUsers(this, apiKey)
  }

  async getUserById(apiKey: string, userId: string): Promise<MediaServerUser> {
    return getUserById(this, apiKey, userId)
  }

  // Libraries
  async getLibraries(apiKey: string): Promise<Library[]> {
    return getLibraries(this, apiKey)
  }

  async getMovieLibraries(apiKey: string): Promise<Library[]> {
    return getMovieLibraries(this, apiKey)
  }

  async getTvShowLibraries(apiKey: string): Promise<Library[]> {
    return getTvShowLibraries(this, apiKey)
  }

  async createVirtualLibrary(
    apiKey: string,
    name: string,
    path: string,
    collectionType: 'movies' | 'tvshows'
  ): Promise<LibraryCreateResult> {
    return createVirtualLibrary(this, apiKey, name, path, collectionType)
  }

  async getUserLibraryAccess(
    apiKey: string,
    userId: string
  ): Promise<{ enableAllFolders: boolean; enabledFolders: string[] }> {
    return getUserLibraryAccess(this, apiKey, userId)
  }

  async updateUserLibraryAccess(
    apiKey: string,
    userId: string,
    allowedLibraryGuids: string[]
  ): Promise<void> {
    return updateUserLibraryAccess(this, apiKey, userId, allowedLibraryGuids)
  }

  async refreshLibrary(apiKey: string, libraryId: string): Promise<void> {
    return refreshLibrary(this, apiKey, libraryId)
  }

  // Movies
  async getMovies(
    apiKey: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Movie>> {
    return getMovies(this, apiKey, options)
  }

  async getMovieById(apiKey: string, movieId: string): Promise<Movie | null> {
    return getMovieById(this, apiKey, movieId)
  }

  async getWatchHistory(apiKey: string, userId: string, sinceDate?: Date): Promise<WatchedItem[]> {
    return getWatchHistory(this, apiKey, userId, sinceDate)
  }

  // Series
  async getSeries(
    apiKey: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Series>> {
    return getSeries(this, apiKey, options)
  }

  async getSeriesById(apiKey: string, seriesId: string): Promise<Series | null> {
    return getSeriesById(this, apiKey, seriesId)
  }

  async getEpisodes(
    apiKey: string,
    options: PaginationOptions & { seriesId?: string } = {}
  ): Promise<PaginatedResult<Episode>> {
    return getEpisodes(this, apiKey, options)
  }

  async getEpisodeById(apiKey: string, episodeId: string): Promise<Episode | null> {
    return getEpisodeById(this, apiKey, episodeId)
  }

  async getSeriesWatchHistory(apiKey: string, userId: string, sinceDate?: Date): Promise<WatchedEpisode[]> {
    return getSeriesWatchHistory(this, apiKey, userId, sinceDate)
  }

  // Playlists
  async createOrUpdatePlaylist(
    apiKey: string,
    userId: string,
    name: string,
    itemIds: string[]
  ): Promise<PlaylistCreateResult> {
    return createOrUpdatePlaylist(this, apiKey, userId, name, itemIds)
  }

  async deletePlaylist(apiKey: string, playlistId: string): Promise<void> {
    return deletePlaylist(this, apiKey, playlistId)
  }

  async getPlaylistItems(apiKey: string, playlistId: string): Promise<PlaylistItem[]> {
    return getPlaylistItems(this, apiKey, playlistId)
  }

  async removePlaylistItems(apiKey: string, playlistId: string, entryIds: string[]): Promise<void> {
    return removePlaylistItems(this, apiKey, playlistId, entryIds)
  }

  async addPlaylistItems(apiKey: string, playlistId: string, itemIds: string[]): Promise<void> {
    return addPlaylistItems(this, apiKey, playlistId, itemIds)
  }

  // Genres
  async getGenres(apiKey: string): Promise<string[]> {
    return getGenres(this, apiKey)
  }

  // Collections (Box Sets)
  async createOrUpdateCollection(
    apiKey: string,
    name: string,
    itemIds: string[]
  ): Promise<CollectionCreateResult> {
    return createOrUpdateCollection(this, apiKey, name, itemIds)
  }

  async deleteCollection(apiKey: string, collectionId: string): Promise<void> {
    return deleteCollection(this, apiKey, collectionId)
  }

  async getCollectionItems(apiKey: string, collectionId: string): Promise<string[]> {
    return getCollectionItems(this, apiKey, collectionId)
  }

  async addCollectionItems(apiKey: string, collectionId: string, itemIds: string[]): Promise<void> {
    return addCollectionItems(this, apiKey, collectionId, itemIds)
  }

  async removeCollectionItems(apiKey: string, collectionId: string, itemIds: string[]): Promise<void> {
    return removeCollectionItems(this, apiKey, collectionId, itemIds)
  }
}

