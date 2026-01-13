import { useState, useEffect, useCallback, useRef } from 'react'
import type { GraphData, GraphNode, SimilarityResult, LoadingStatus } from './types'

type GraphSource = 'ai-movies' | 'ai-series' | 'watching' | 'top-movies' | 'top-series'

interface UseGraphDataOptions {
  limit?: number
  crossMedia?: boolean
}

interface UseGraphDataReturn {
  data: GraphData | null
  loading: boolean
  loadingStatus: LoadingStatus | null
  error: string | null
  refetch: () => Promise<void>
}

// Breadcrumb history item
export interface BreadcrumbItem {
  id: string
  title: string
  type: 'movie' | 'series'
}

// Extended return type for similarity data with navigation
interface UseSimilarityDataReturn extends UseGraphDataReturn {
  focusId: string | null
  setFocusId: (id: string, type?: 'movie' | 'series') => void
  history: BreadcrumbItem[]
  goBack: () => void
  goToHistoryIndex: (index: number) => void
  startOver: () => void
}

// Loading phase messages
const LOADING_PHASES = {
  fetching: {
    messages: [
      'Finding similar content...',
      'Exploring your library...',
      'Discovering connections...',
    ],
    details: [
      'Analyzing embeddings',
      'Computing similarity scores',
      'Finding related titles',
    ],
  },
  validating: {
    messages: [
      'Validating connections...',
      'Filtering false positives...',
      'AI quality check in progress...',
    ],
    details: [
      'Checking genre compatibility',
      'Verifying thematic relationships',
      'Consulting AI for edge cases',
    ],
  },
  building: {
    messages: [
      'Building graph visualization...',
      'Arranging nodes...',
      'Finalizing connections...',
    ],
    details: [
      'Calculating optimal layout',
      'Preparing visual elements',
    ],
  },
}

// Fetch graph data for explore page (multiple center nodes)
export function useGraphData(
  source: GraphSource,
  options: UseGraphDataOptions = {}
): UseGraphDataReturn {
  const [data, setData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const phaseStartRef = useRef<number>(0)

  const { limit = 20, crossMedia = false } = options

  const startLoadingProgress = useCallback(() => {
    phaseStartRef.current = Date.now()
    setLoadingStatus({
      phase: 'fetching',
      message: randomItem(LOADING_PHASES.fetching.messages),
      progress: 5,
    })
    
    loadingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - phaseStartRef.current
      
      setLoadingStatus(prev => {
        if (!prev) return null
        
        if (elapsed < 1000) {
          return {
            phase: 'fetching',
            message: randomItem(LOADING_PHASES.fetching.messages),
            detail: randomItem(LOADING_PHASES.fetching.details),
            progress: Math.min(40, 5 + (elapsed / 1000) * 35),
          }
        } else if (elapsed < 4000) {
          const progress = 40 + ((elapsed - 1000) / 3000) * 50
          return {
            phase: 'validating',
            message: randomItem(LOADING_PHASES.validating.messages),
            detail: randomItem(LOADING_PHASES.validating.details),
            progress: Math.min(90, progress),
          }
        } else {
          return {
            phase: 'building',
            message: randomItem(LOADING_PHASES.building.messages),
            progress: Math.min(95, 90 + ((elapsed - 4000) / 2000) * 5),
          }
        }
      })
    }, 300)
  }, [])
  
  const stopLoadingProgress = useCallback(() => {
    if (loadingTimerRef.current) {
      clearInterval(loadingTimerRef.current)
      loadingTimerRef.current = null
    }
    setLoadingStatus(null)
  }, [])
  
  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current)
      }
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    startLoadingProgress()

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        crossMedia: String(crossMedia),
      })

      const response = await fetch(`/api/similarity/graph/${source}?${params}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch graph data: ${response.status}`)
      }

      const graphData = await response.json()
      setData(graphData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Error fetching graph data:', err)
    } finally {
      setLoading(false)
      stopLoadingProgress()
    }
  }, [source, limit, crossMedia, startLoadingProgress, stopLoadingProgress])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, loadingStatus, error, refetch: fetchData }
}

// Helper to get random item from array
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Fetch similarity data for a single item (detail page)
// Supports rabbit-hole navigation with history tracking
export function useSimilarityData(
  initialType: 'movie' | 'series',
  initialId: string | null,
  options: { limit?: number; depth?: number } = {}
): UseSimilarityDataReturn {
  const [data, setData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Navigation state
  const [focusId, setFocusIdState] = useState<string | null>(initialId)
  const [focusType, setFocusType] = useState<'movie' | 'series'>(initialType)
  const [history, setHistory] = useState<BreadcrumbItem[]>([])
  const [originalId] = useState<string | null>(initialId)
  const [originalType] = useState<'movie' | 'series'>(initialType)
  
  // Timer ref for loading phase progression
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const phaseStartRef = useRef<number>(0)

  const { limit = 12, depth = 1 } = options

  // Update focus when initial ID changes (e.g., navigating to a new detail page)
  useEffect(() => {
    if (initialId && initialId !== focusId) {
      setFocusIdState(initialId)
      setFocusType(initialType)
      setHistory([])
    }
  }, [initialId, initialType])

  // Progress simulation for loading phases
  // In production, this could be replaced with SSE for real progress
  const startLoadingProgress = useCallback(() => {
    phaseStartRef.current = Date.now()
    
    // Start with fetching phase
    setLoadingStatus({
      phase: 'fetching',
      message: randomItem(LOADING_PHASES.fetching.messages),
      detail: randomItem(LOADING_PHASES.fetching.details),
      progress: 5,
    })
    
    // Transition through phases based on time and depth
    // Higher depth = longer validation time
    const validatingDelay = depth > 1 ? 1500 : 500
    const buildingDelay = depth > 1 ? 8000 : 2000
    
    loadingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - phaseStartRef.current
      
      setLoadingStatus(prev => {
        if (!prev) return null
        
        // Calculate phase and progress based on elapsed time
        if (elapsed < validatingDelay) {
          // Fetching phase (0-30%)
          const progress = Math.min(30, 5 + (elapsed / validatingDelay) * 25)
          return {
            phase: 'fetching',
            message: randomItem(LOADING_PHASES.fetching.messages),
            detail: randomItem(LOADING_PHASES.fetching.details),
            progress,
          }
        } else if (elapsed < buildingDelay) {
          // Validating phase (30-90%)
          const validatingProgress = (elapsed - validatingDelay) / (buildingDelay - validatingDelay)
          const progress = 30 + validatingProgress * 60
          return {
            phase: 'validating',
            message: randomItem(LOADING_PHASES.validating.messages),
            detail: randomItem(LOADING_PHASES.validating.details),
            progress: Math.min(90, progress),
          }
        } else {
          // Building phase (90-95%)
          return {
            phase: 'building',
            message: randomItem(LOADING_PHASES.building.messages),
            detail: randomItem(LOADING_PHASES.building.details),
            progress: Math.min(95, 90 + ((elapsed - buildingDelay) / 2000) * 5),
          }
        }
      })
    }, 300) // Update every 300ms for smooth progress
  }, [depth])
  
  const stopLoadingProgress = useCallback(() => {
    if (loadingTimerRef.current) {
      clearInterval(loadingTimerRef.current)
      loadingTimerRef.current = null
    }
    setLoadingStatus(null)
  }, [])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current)
      }
    }
  }, [])

  const fetchData = useCallback(async () => {
    if (!focusId) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)
    startLoadingProgress()

    try {
      const params = new URLSearchParams({ 
        limit: String(limit),
        depth: String(depth),
      })
      const response = await fetch(`/api/similarity/${focusType}/${focusId}?${params}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch similarity data: ${response.status}`)
      }

      const result = await response.json()

      // When depth > 1, the API returns GraphData directly
      if (depth > 1) {
        setData(result as GraphData)
        return
      }

      // For depth=1, convert SimilarityResult to GraphData format
      const similarityResult = result as SimilarityResult

      const graphData: GraphData = {
        nodes: [
          {
            id: similarityResult.center.id,
            title: similarityResult.center.title,
            year: similarityResult.center.year,
            poster_url: similarityResult.center.poster_url,
            type: similarityResult.center.type,
            isCenter: true,
          },
          ...similarityResult.connections.map((conn) => ({
            id: conn.item.id,
            title: conn.item.title,
            year: conn.item.year,
            poster_url: conn.item.poster_url,
            type: conn.item.type,
            isCenter: false,
          })),
        ],
        edges: similarityResult.connections.map((conn) => ({
          source: similarityResult.center.id,
          target: conn.item.id,
          similarity: conn.similarity,
          reasons: conn.reasons,
        })),
      }

      setData(graphData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Error fetching similarity data:', err)
    } finally {
      setLoading(false)
      stopLoadingProgress()
    }
  }, [focusType, focusId, limit, depth, startLoadingProgress, stopLoadingProgress])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Navigate to a new focus (rabbit hole navigation)
  const setFocusId = useCallback((newId: string, newType?: 'movie' | 'series') => {
    // Don't navigate to the current item
    if (newId === focusId) return
    
    // Add current item to history before navigating
    if (data?.nodes) {
      const centerNode = data.nodes.find(n => n.isCenter)
      if (centerNode) {
        setHistory(prev => [...prev, {
          id: centerNode.id,
          title: centerNode.title,
          type: centerNode.type,
        }])
      }
    }
    
    setFocusIdState(newId)
    if (newType) setFocusType(newType)
  }, [focusId, data])

  // Go back one step in history
  const goBack = useCallback(() => {
    if (history.length === 0) return
    
    const newHistory = [...history]
    const lastItem = newHistory.pop()!
    
    setHistory(newHistory)
    setFocusIdState(lastItem.id)
    setFocusType(lastItem.type)
  }, [history])

  // Jump to a specific point in history
  const goToHistoryIndex = useCallback((index: number) => {
    if (index < 0 || index >= history.length) return
    
    const item = history[index]
    // Remove everything after this index
    setHistory(history.slice(0, index))
    setFocusIdState(item.id)
    setFocusType(item.type)
  }, [history])

  // Return to original item
  const startOver = useCallback(() => {
    setHistory([])
    setFocusIdState(originalId)
    setFocusType(originalType)
  }, [originalId, originalType])

  return { 
    data, 
    loading, 
    loadingStatus,
    error, 
    refetch: fetchData,
    focusId,
    setFocusId,
    history,
    goBack,
    goToHistoryIndex,
    startOver,
  }
}

