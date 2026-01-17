// Types for similarity graph data

export type ConnectionType =
  | 'director'
  | 'actor'
  | 'collection'
  | 'genre'
  | 'keyword'
  | 'studio'
  | 'network'
  | 'similarity'
  | 'ai_diverse' // AI suggested diverse content to break franchise bubbles

export interface ConnectionReason {
  type: ConnectionType
  value?: string
  values?: string[]
  photo?: string
}

export interface GraphNode {
  id: string
  title: string
  year: number | null
  poster_url: string | null
  type: 'movie' | 'series'
  isCenter: boolean
  // Primary node info (for browse sources like AI Picks, Top Picks)
  isPrimary?: boolean
  primaryLabel?: string // e.g., "#1 on AI Movie Picks", "#3 in Top Pick Movies"
  // D3 simulation properties
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

export interface GraphEdge {
  source: string | GraphNode
  target: string | GraphNode
  similarity: number
  reasons: ConnectionReason[]
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface SimilarityItem {
  id: string
  title: string
  year: number | null
  poster_url: string | null
  type: 'movie' | 'series'
}

export interface SimilarityConnection {
  item: SimilarityItem
  similarity: number
  reasons: ConnectionReason[]
}

export interface SimilarityResult {
  center: SimilarityItem
  connections: SimilarityConnection[]
}

// Colors for connection types
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

export const CONNECTION_LABELS: Record<ConnectionType, string> = {
  director: 'Same Director',
  actor: 'Shared Actor',
  collection: 'Same Collection',
  genre: 'Genre Match',
  keyword: 'Theme Match',
  studio: 'Same Studio',
  network: 'Same Network',
  similarity: 'AI Similar',
  ai_diverse: 'AI Discovery',
}

// Loading status for progress feedback
export interface LoadingStatus {
  phase: 'fetching' | 'validating' | 'building' | 'done'
  message: string
  progress?: number // 0-100
  detail?: string // e.g., "Checking: Return of the Jedi → The Return of Jafar"
}
