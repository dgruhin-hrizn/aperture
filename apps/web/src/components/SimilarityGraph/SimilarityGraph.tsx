import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import { Box, Typography, Fade, CircularProgress, Chip, Stack } from '@mui/material'
import type { GraphNode, GraphEdge, GraphData, ConnectionReason, LoadingStatus } from './types'
import { CONNECTION_COLORS, CONNECTION_LABELS } from './types'

// Node dimensions (2:3 poster ratio)
const NODE_WIDTH = 100
const NODE_HEIGHT = 150
const CENTER_NODE_WIDTH = 120
const CENTER_NODE_HEIGHT = 180
const TITLE_HEIGHT = 32

interface NodeConnectionInfo {
  node: GraphNode
  connections: Array<{
    targetNode: GraphNode
    reasons: ConnectionReason[]
    similarity: number
  }>
}

interface SimilarityGraphProps {
  data: GraphData | null
  loading?: boolean
  loadingStatus?: LoadingStatus
  onNodeClick?: (node: GraphNode) => void
  onNodeDoubleClick?: (node: GraphNode) => void
  compact?: boolean
  width?: number
  height?: number
}

export function SimilarityGraph({
  data,
  loading = false,
  loadingStatus,
  onNodeClick,
  onNodeDoubleClick,
  compact = false,
  width: propWidth,
  height: propHeight,
}: SimilarityGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null)
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null)
  
  // Store callbacks in refs to prevent effect re-runs when parent re-renders
  const onNodeClickRef = useRef(onNodeClick)
  const onNodeDoubleClickRef = useRef(onNodeDoubleClick)
  
  // Keep refs updated with latest callbacks
  useEffect(() => {
    onNodeClickRef.current = onNodeClick
  }, [onNodeClick])
  
  useEffect(() => {
    onNodeDoubleClickRef.current = onNodeDoubleClick
  }, [onNodeDoubleClick])
  
  // Create a stable key for data to prevent unnecessary re-renders
  // Only re-render when actual node IDs change, not when object references change
  const dataKey = useMemo(() => {
    if (!data) return ''
    const nodeIds = data.nodes.map(n => n.id).sort().join(',')
    const centerId = data.nodes.find(n => n.isCenter)?.id || ''
    return `${centerId}:${nodeIds}`
  }, [data])

  // Build node connection map for tooltips
  const nodeConnectionMap = useMemo(() => {
    if (!data) return new Map<string, NodeConnectionInfo>()
    
    const map = new Map<string, NodeConnectionInfo>()
    
    // Initialize all nodes
    for (const node of data.nodes) {
      map.set(node.id, { node, connections: [] })
    }
    
    // Add edge connections to each node
    for (const edge of data.edges) {
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id
      const sourceNode = data.nodes.find(n => n.id === sourceId)
      const targetNode = data.nodes.find(n => n.id === targetId)
      
      if (sourceNode && targetNode) {
        map.get(sourceId)?.connections.push({
          targetNode,
          reasons: edge.reasons,
          similarity: edge.similarity,
        })
        map.get(targetId)?.connections.push({
          targetNode: sourceNode,
          reasons: edge.reasons,
          similarity: edge.similarity,
        })
      }
    }
    
    return map
  }, [data])

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return

    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: propWidth || rect.width || 800,
          height: propHeight || rect.height || 600,
        })
      }
    }

    updateDimensions()
    const observer = new ResizeObserver(updateDimensions)
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [propWidth, propHeight])

  // Get primary connection type for edge coloring
  const getPrimaryConnectionType = useCallback((reasons: ConnectionReason[]) => {
    const priority: Array<ConnectionReason['type']> = [
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
  }, [])

  // D3 force simulation
  useEffect(() => {
    if (!data || !svgRef.current || data.nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = dimensions
    const nodeWidth = compact ? NODE_WIDTH * 0.8 : NODE_WIDTH
    const nodeHeight = compact ? NODE_HEIGHT * 0.8 : NODE_HEIGHT
    const centerNodeWidth = compact ? CENTER_NODE_WIDTH * 0.8 : CENTER_NODE_WIDTH
    const centerNodeHeight = compact ? CENTER_NODE_HEIGHT * 0.8 : CENTER_NODE_HEIGHT

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        container.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Container for zoom/pan
    const container = svg.append('g')

    // Create edges
    const edges = container
      .append('g')
      .attr('class', 'edges')
      .selectAll<SVGLineElement, GraphEdge>('line')
      .data(data.edges)
      .join('line')
      .attr('stroke', (d) => CONNECTION_COLORS[getPrimaryConnectionType(d.reasons)])
      .attr('stroke-width', (d) => Math.max(1, d.similarity * 4))
      .attr('stroke-opacity', 0.6)
      .style('cursor', 'pointer')
      .on('mouseenter', function (_event, d) {
        d3.select(this).attr('stroke-opacity', 1).attr('stroke-width', Math.max(2, d.similarity * 6))
        setHoveredEdge(d)
      })
      .on('mouseleave', function (_event, d) {
        d3.select(this).attr('stroke-opacity', 0.6).attr('stroke-width', Math.max(1, d.similarity * 4))
        setHoveredEdge(null)
      })

    // Create node groups
    const nodes = container
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(data.nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulationRef.current?.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulationRef.current?.alphaTarget(0)
            d.fx = null
            d.fy = null
          })
      )
      .on('click', (event, d) => {
        event.stopPropagation()
        onNodeClickRef.current?.(d)
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation()
        onNodeDoubleClickRef.current?.(d)
      })
      .on('mouseenter', (_, d) => setHoveredNode(d))
      .on('mouseleave', () => setHoveredNode(null))

    // Node background (card)
    nodes
      .append('rect')
      .attr('width', (d) => (d.isCenter ? centerNodeWidth : nodeWidth))
      .attr('height', (d) => (d.isCenter ? centerNodeHeight + TITLE_HEIGHT : nodeHeight + TITLE_HEIGHT))
      .attr('x', (d) => -(d.isCenter ? centerNodeWidth : nodeWidth) / 2)
      .attr('y', (d) => -(d.isCenter ? centerNodeHeight : nodeHeight) / 2)
      .attr('rx', 6)
      .attr('ry', 6)
      .attr('fill', '#1a1a2e')
      .attr('stroke', (d) => (d.isCenter ? '#8B5CF6' : '#333'))
      .attr('stroke-width', (d) => (d.isCenter ? 2 : 1))

    // Poster clip path
    nodes
      .append('clipPath')
      .attr('id', (d) => `clip-${d.id}`)
      .append('rect')
      .attr('width', (d) => (d.isCenter ? centerNodeWidth - 8 : nodeWidth - 8))
      .attr('height', (d) => (d.isCenter ? centerNodeHeight - 4 : nodeHeight - 4))
      .attr('x', (d) => -(d.isCenter ? centerNodeWidth - 8 : nodeWidth - 8) / 2)
      .attr('y', (d) => -(d.isCenter ? centerNodeHeight : nodeHeight) / 2 + 4)
      .attr('rx', 4)
      .attr('ry', 4)

    // Poster image
    nodes
      .append('image')
      .attr('xlink:href', (d) => d.poster_url || '/placeholder-poster.png')
      .attr('width', (d) => (d.isCenter ? centerNodeWidth - 8 : nodeWidth - 8))
      .attr('height', (d) => (d.isCenter ? centerNodeHeight - 4 : nodeHeight - 4))
      .attr('x', (d) => -(d.isCenter ? centerNodeWidth - 8 : nodeWidth - 8) / 2)
      .attr('y', (d) => -(d.isCenter ? centerNodeHeight : nodeHeight) / 2 + 4)
      .attr('clip-path', (d) => `url(#clip-${d.id})`)
      .attr('preserveAspectRatio', 'xMidYMid slice')

    // Title text
    nodes
      .append('text')
      .text((d) => truncateTitle(d.title, d.isCenter ? 14 : 12))
      .attr('text-anchor', 'middle')
      .attr('y', (d) => (d.isCenter ? centerNodeHeight : nodeHeight) / 2 + 14)
      .attr('fill', '#fff')
      .attr('font-size', (d) => (d.isCenter ? '11px' : '9px'))
      .attr('font-weight', (d) => (d.isCenter ? 600 : 400))

    // Year text
    nodes
      .append('text')
      .text((d) => (d.year ? `(${d.year})` : ''))
      .attr('text-anchor', 'middle')
      .attr('y', (d) => (d.isCenter ? centerNodeHeight : nodeHeight) / 2 + 26)
      .attr('fill', '#888')
      .attr('font-size', '8px')

    // Pre-position nodes in a circle around center for smoother initial layout
    const centerNode = data.nodes.find(n => n.isCenter)
    const otherNodes = data.nodes.filter(n => !n.isCenter)
    const radius = Math.min(width, height) * 0.3
    
    // Place center node at center
    if (centerNode) {
      centerNode.x = width / 2
      centerNode.y = height / 2
    }
    
    // Arrange other nodes in a circle
    otherNodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / otherNodes.length - Math.PI / 2
      node.x = width / 2 + radius * Math.cos(angle)
      node.y = height / 2 + radius * Math.sin(angle)
    })

    // Start with container hidden, fade in after initial settling
    container.style('opacity', 0)
    
    // Create simulation with gentler initial energy
    const simulation = d3
      .forceSimulation<GraphNode>(data.nodes)
      .alpha(0.4) // Start with lower energy (default is 1)
      .alphaDecay(0.02) // Slightly faster settling
      .velocityDecay(0.4) // More friction for smoother movement
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphEdge>(data.edges)
          .id((d) => d.id)
          .distance((d) => {
            // Moderate distance between nodes (200-300 range)
            return 300 - d.similarity * 100
          })
          .strength((d) => d.similarity * 0.4)
      )
      .force('charge', d3.forceManyBody().strength(-650))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d) => {
        const nodeW = (d as GraphNode).isCenter ? centerNodeWidth : nodeWidth
        return nodeW / 2 + 50
      }))

    simulationRef.current = simulation
    
    // Fade in after brief settling period
    setTimeout(() => {
      container.transition().duration(400).style('opacity', 1)
    }, 150)

    // Track if we've centered on the initial node
    let hasCentered = false

    simulation.on('tick', () => {
      edges
        .attr('x1', (d) => (d.source as GraphNode).x || 0)
        .attr('y1', (d) => (d.source as GraphNode).y || 0)
        .attr('x2', (d) => (d.target as GraphNode).x || 0)
        .attr('y2', (d) => (d.target as GraphNode).y || 0)

      nodes.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`)
    })

    // Center on the center node after simulation settles (no zoom change, just pan)
    simulation.on('end', () => {
      if (hasCentered) return
      hasCentered = true
      
      const centerNode = data.nodes.find((n: GraphNode) => n.isCenter) as GraphNode | undefined
      if (centerNode && centerNode.x !== undefined && centerNode.y !== undefined) {
        // Pan to center without changing zoom level (scale = 1)
        const translateX = width / 2 - centerNode.x
        const translateY = height / 2 - centerNode.y
        
        svg.transition()
          .duration(300)
          .call(
            zoom.transform,
            d3.zoomIdentity.translate(translateX, translateY)
          )
      }
    })

    // Also center after a short delay in case simulation ends quickly
    setTimeout(() => {
      if (hasCentered) return
      hasCentered = true
      
      const centerNode = data.nodes.find((n: GraphNode) => n.isCenter) as GraphNode | undefined
      if (centerNode && centerNode.x !== undefined && centerNode.y !== undefined) {
        const translateX = width / 2 - centerNode.x
        const translateY = height / 2 - centerNode.y
        
        svg.transition()
          .duration(300)
          .call(
            zoom.transform,
            d3.zoomIdentity.translate(translateX, translateY)
          )
      }
    }, 500)

    return () => {
      simulation.stop()
    }
    // Use dataKey instead of data to prevent re-renders when data reference changes but content is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, dimensions, compact, getPrimaryConnectionType])

  if (loading) {
    return (
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: compact ? 550 : '100%',
          minHeight: compact ? 550 : 600,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          bgcolor: '#0f0f1a',
          borderRadius: 2,
        }}
      >
        {/* Progress indicator */}
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          {loadingStatus?.progress !== undefined ? (
            <>
              <CircularProgress
                variant="determinate"
                value={loadingStatus.progress}
                size={60}
                thickness={4}
                sx={{ color: 'primary.main' }}
              />
              <Box
                sx={{
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                  position: 'absolute',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {Math.round(loadingStatus.progress)}%
                </Typography>
              </Box>
            </>
          ) : (
            <CircularProgress size={60} thickness={4} />
          )}
        </Box>

        {/* Phase message */}
        <Typography
          variant="body1"
          color="text.primary"
          fontWeight={500}
          sx={{ textAlign: 'center' }}
        >
          {loadingStatus?.message || 'Loading...'}
        </Typography>

        {/* Detail message (e.g., current validation being checked) */}
        {loadingStatus?.detail && (
          <Fade in={true} key={loadingStatus.detail}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                textAlign: 'center',
                maxWidth: 300,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {loadingStatus.detail}
            </Typography>
          </Fade>
        )}

        {/* Phase indicator chips */}
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Chip
            label="Fetch"
            size="small"
            color={loadingStatus?.phase === 'fetching' ? 'primary' : 'default'}
            variant={loadingStatus?.phase === 'fetching' ? 'filled' : 'outlined'}
            sx={{ 
              opacity: loadingStatus?.phase === 'fetching' ? 1 : 0.5,
              transition: 'all 0.3s ease',
            }}
          />
          <Chip
            label="Validate"
            size="small"
            color={loadingStatus?.phase === 'validating' ? 'primary' : 'default'}
            variant={loadingStatus?.phase === 'validating' ? 'filled' : 'outlined'}
            sx={{ 
              opacity: loadingStatus?.phase === 'validating' ? 1 : 0.5,
              transition: 'all 0.3s ease',
            }}
          />
          <Chip
            label="Build"
            size="small"
            color={loadingStatus?.phase === 'building' ? 'primary' : 'default'}
            variant={loadingStatus?.phase === 'building' ? 'filled' : 'outlined'}
            sx={{ 
              opacity: loadingStatus?.phase === 'building' ? 1 : 0.5,
              transition: 'all 0.3s ease',
            }}
          />
        </Stack>
      </Box>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: compact ? 550 : '100%',
          minHeight: compact ? 550 : 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0f0f1a',
          borderRadius: 2,
        }}
      >
        <Typography color="text.secondary">No connections to display</Typography>
      </Box>
    )
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: compact ? 550 : '100%',
        minHeight: compact ? 550 : 600,
        position: 'relative',
        bgcolor: '#0f0f1a',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ display: 'block' }}
      />

      {/* Rich tooltip for nodes showing connection reasons */}
      <Fade in={Boolean(hoveredNode)}>
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            bgcolor: 'rgba(10,10,20,0.95)',
            borderRadius: 2,
            p: 2,
            maxWidth: 380,
            maxHeight: 300,
            overflowY: 'auto',
            pointerEvents: 'none',
            border: '1px solid rgba(139,92,246,0.3)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {hoveredNode && (() => {
            const connectionInfo = nodeConnectionMap.get(hoveredNode.id)
            const connections = connectionInfo?.connections || []
            
            // Group all reasons by type
            const allReasons = connections.flatMap(c => c.reasons)
            const reasonsByType = allReasons.reduce((acc, reason) => {
              if (!acc[reason.type]) acc[reason.type] = new Set<string>()
              if (reason.value) acc[reason.type].add(reason.value)
              return acc
            }, {} as Record<string, Set<string>>)
            
            return (
              <>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                  {hoveredNode.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                  {hoveredNode.year} • {hoveredNode.type === 'movie' ? 'Movie' : 'Series'}
                </Typography>
                
                {hoveredNode.isCenter ? (
                  <Typography variant="caption" color="primary.light">
                    Center node • {connections.length} connection{connections.length !== 1 ? 's' : ''}
                  </Typography>
                ) : connections.length > 0 ? (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Connected via:
                    </Typography>
                    <Stack spacing={1}>
                      {Object.entries(reasonsByType).map(([type, values]) => (
                        <Box key={type}>
                          <Chip
                            size="small"
                            label={CONNECTION_LABELS[type as keyof typeof CONNECTION_LABELS] || type}
                            sx={{
                              bgcolor: CONNECTION_COLORS[type as keyof typeof CONNECTION_COLORS] || '#666',
                              color: '#fff',
                              fontSize: '10px',
                              height: 20,
                              mr: 0.5,
                              mb: 0.5,
                            }}
                          />
                          {values.size > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                              {Array.from(values).slice(0, 3).join(', ')}
                              {values.size > 3 && ` +${values.size - 3} more`}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No direct connections
                  </Typography>
                )}
              </>
            )
          })()}
        </Box>
      </Fade>

      {/* Hover tooltip for edges */}
      <Fade in={Boolean(hoveredEdge)}>
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            bgcolor: 'rgba(0,0,0,0.9)',
            borderRadius: 1,
            p: 1.5,
            maxWidth: 300,
            pointerEvents: 'none',
          }}
        >
          {hoveredEdge && (
            <>
              <Typography variant="subtitle2" fontWeight={600}>
                {Math.round(hoveredEdge.similarity * 100)}% Similar
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                {hoveredEdge.reasons.map((reason, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      bgcolor: CONNECTION_COLORS[reason.type],
                      color: '#fff',
                      fontSize: '10px',
                    }}
                  >
                    {CONNECTION_LABELS[reason.type]}
                    {reason.value && `: ${reason.value}`}
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Box>
      </Fade>
    </Box>
  )
}

function truncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) return title
  return title.slice(0, maxLength - 1) + '…'
}

