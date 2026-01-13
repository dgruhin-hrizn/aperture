// Barrel file - re-exports all public API from the SimilarityGraph module

// Component
export { SimilarityGraph } from './SimilarityGraph'

// Types
export type {
  GraphNode,
  GraphEdge,
  GraphData,
  ConnectionType,
  ConnectionReason,
  LoadingStatus,
} from './types'
export { CONNECTION_COLORS, CONNECTION_LABELS } from './types'

// Controls
export { GraphControls, GraphLegend } from './GraphControls'

// Hooks
export { useGraphData, useSimilarityData } from './useGraphData'
export type { BreadcrumbItem } from './useGraphData'
