import type { SimilarityItem } from './index.js'

// ============================================================================
// Types
// ============================================================================

export type ConnectionType =
  | 'director'
  | 'actor'
  | 'collection'
  | 'genre'
  | 'keyword'
  | 'studio'
  | 'network'
  | 'similarity'
  | 'ai_diverse' // AI suggested as thematically related but from different franchise

export interface ConnectionReason {
  type: ConnectionType
  value?: string
  values?: string[]
  photo?: string
}

// Colors for each connection type (used by frontend)
export const CONNECTION_COLORS: Record<ConnectionType, string> = {
  director: '#3B82F6', // Blue
  actor: '#14B8A6', // Teal
  collection: '#F59E0B', // Gold
  genre: '#8B5CF6', // Purple
  keyword: '#EC4899', // Pink
  studio: '#F97316', // Orange
  network: '#22C55E', // Green
  similarity: '#6B7280', // Gray
  ai_diverse: '#10B981', // Emerald green for AI-discovered diverse content
}

// ============================================================================
// Connection Reason Computation
// ============================================================================

export function computeConnectionReasons(
  source: SimilarityItem,
  target: SimilarityItem
): ConnectionReason[] {
  const reasons: ConnectionReason[] = []

  // Check for shared directors
  const sharedDirectors = findIntersection(source.directors, target.directors)
  if (sharedDirectors.length > 0) {
    reasons.push({
      type: 'director',
      value: sharedDirectors[0],
      values: sharedDirectors.length > 1 ? sharedDirectors : undefined,
    })
  }

  // Check for shared actors (by name)
  const sourceActorNames = source.actors.map((a) => a.name)
  const targetActorNames = target.actors.map((a) => a.name)
  const sharedActorNames = findIntersection(sourceActorNames, targetActorNames)
  if (sharedActorNames.length > 0) {
    // Get the first shared actor with photo if available
    const sharedActor =
      source.actors.find((a) => a.name === sharedActorNames[0]) ||
      target.actors.find((a) => a.name === sharedActorNames[0])
    reasons.push({
      type: 'actor',
      value: sharedActorNames[0],
      values: sharedActorNames.length > 1 ? sharedActorNames : undefined,
      photo: sharedActor?.thumb,
    })
  }

  // Check for same collection/franchise
  if (
    source.collection_name &&
    target.collection_name &&
    source.collection_name === target.collection_name
  ) {
    reasons.push({
      type: 'collection',
      value: source.collection_name,
    })
  }

  // Check for shared genres
  const sharedGenres = findIntersection(source.genres, target.genres)
  if (sharedGenres.length > 0) {
    reasons.push({
      type: 'genre',
      values: sharedGenres,
    })
  }

  // Check for shared keywords (limit to top 3)
  const sharedKeywords = findIntersection(source.keywords, target.keywords).slice(0, 3)
  if (sharedKeywords.length > 0) {
    reasons.push({
      type: 'keyword',
      values: sharedKeywords,
    })
  }

  // Check for shared studios
  const sourceStudioNames = source.studios.map((s) => s.name)
  const targetStudioNames = target.studios.map((s) => s.name)
  const sharedStudios = findIntersection(sourceStudioNames, targetStudioNames)
  if (sharedStudios.length > 0) {
    reasons.push({
      type: 'studio',
      value: sharedStudios[0],
      values: sharedStudios.length > 1 ? sharedStudios : undefined,
    })
  }

  // Check for same network (series only)
  if (source.network && target.network && source.network === target.network) {
    reasons.push({
      type: 'network',
      value: source.network,
    })
  }

  // If no specific reasons found, mark as AI similarity only
  if (reasons.length === 0) {
    reasons.push({
      type: 'similarity',
    })
  }

  return reasons
}

// ============================================================================
// Get Primary Connection Type (for edge coloring)
// ============================================================================

export function getPrimaryConnectionType(reasons: ConnectionReason[]): ConnectionType {
  // Priority order for determining edge color
  const priority: ConnectionType[] = [
    'ai_diverse', // AI discoveries get highest priority to stand out
    'collection',
    'director',
    'actor',
    'network',
    'studio',
    'genre',
    'keyword',
    'similarity',
  ]

  for (const type of priority) {
    if (reasons.some((r) => r.type === type)) {
      return type
    }
  }

  return 'similarity'
}

// ============================================================================
// Helpers
// ============================================================================

function findIntersection(arr1: string[], arr2: string[]): string[] {
  const set2 = new Set(arr2.map((s) => s.toLowerCase()))
  return arr1.filter((item) => set2.has(item.toLowerCase()))
}

