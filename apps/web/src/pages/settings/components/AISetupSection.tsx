/**
 * AI Setup Section - Card-based AI provider configuration for Admin Settings
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Alert,
  IconButton,
  Divider,
  alpha,
} from '@mui/material'
import {
  Memory as MemoryIcon,
  SmartToy as SmartToyIcon,
  AutoFixHigh as AutoFixHighIcon,
  Delete as DeleteIcon,
  Storage as StorageIcon,
  Explore as ExploreIcon,
} from '@mui/icons-material'
import { AIFunctionCard, type FunctionConfig, type AIFunction } from '../../../components/AIFunctionCard'
import { CostEstimatorSection } from './CostEstimatorSection'

interface AIConfig {
  embeddings: FunctionConfig | null
  chat: FunctionConfig | null
  textGeneration: FunctionConfig | null
  exploration: FunctionConfig | null
}

interface EmbeddingSet {
  model: string
  dimensions: number
  movieCount: number
  seriesCount: number
  episodeCount: number
  totalCount: number
  isActive: boolean
}

/**
 * Component to manage embedding sets - view and delete old embedding sets
 */
function EmbeddingSetsManager() {
  const [sets, setSets] = useState<EmbeddingSet[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchSets = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/ai/embeddings/sets', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setSets(data.sets || [])
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSets()
  }, [fetchSets])

  const handleDelete = async (model: string) => {
    if (!confirm(`Delete all embeddings for "${model}"? This cannot be undone.`)) {
      return
    }

    setDeleting(model)
    setError(null)
    try {
      const res = await fetch(`/api/settings/ai/embeddings/sets/${encodeURIComponent(model)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      // Refresh the list
      fetchSets()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete embedding set')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return null
  }

  // Don't show if no sets or only one active set
  if (sets.length <= 1) {
    return null
  }

  const inactiveSets = sets.filter(s => !s.isActive)
  if (inactiveSets.length === 0) {
    return null
  }

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <StorageIcon color="primary" />
          <Typography variant="h6">Embedding Sets</Typography>
          <Chip 
            size="small" 
            label={`${sets.length} sets`} 
            sx={{ ml: 'auto' }}
          />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          You have embeddings stored from multiple models. Inactive sets can be deleted to free up storage.
          When you switch back to a model with existing embeddings, they will be used immediately without regenerating.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {sets.map((set) => (
            <Box
              key={set.model}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: set.isActive ? alpha('#4caf50', 0.1) : 'background.default',
                border: 1,
                borderColor: set.isActive ? 'success.main' : 'divider',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography 
                    variant="body2" 
                    fontWeight={set.isActive ? 600 : 400}
                    sx={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {set.model}
                  </Typography>
                  {set.isActive && (
                    <Chip size="small" label="Active" color="success" />
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {set.dimensions}d • {set.movieCount.toLocaleString()} movies • {set.seriesCount.toLocaleString()} series • {set.episodeCount.toLocaleString()} episodes
                </Typography>
              </Box>
              
              {!set.isActive && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(set.model)}
                  disabled={deleting === set.model}
                  title="Delete this embedding set"
                >
                  {deleting === set.model ? (
                    <CircularProgress size={16} />
                  ) : (
                    <DeleteIcon fontSize="small" />
                  )}
                </IconButton>
              )}
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}

export function AISetupSection() {
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/ai', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setConfig(data.config)
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleSave = async (fn: AIFunction, fnConfig: FunctionConfig) => {
    const res = await fetch(`/api/settings/ai/${fn}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(fnConfig),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to save')
    }
    // Refresh config
    fetchConfig()
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          AI Provider Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure AI providers for different features. Aperture recommends using OpenAI for all four functions, 
          but feel free to explore other providers and models.
        </Typography>
      </Box>

      {/* Function Cards - 2x2 grid */}
      <Box 
        display="grid" 
        gridTemplateColumns={{ xs: '1fr', md: 'repeat(2, 1fr)' }} 
        gap={3}
      >
        <AIFunctionCard
          functionType="embeddings"
          title="Embeddings"
          description="Converts text to vectors for semantic search and recommendations. Higher dimensions = better quality."
          icon={<MemoryIcon />}
          iconColor="#2196f3"
          config={config?.embeddings ?? null}
          onSave={(c) => handleSave('embeddings', c)}
          requiredCapability="embeddings"
        />

        <AIFunctionCard
          functionType="chat"
          title="Chat Assistant"
          description="Powers the AI assistant. Needs tool calling to search your library and make recommendations."
          icon={<SmartToyIcon />}
          iconColor="#9c27b0"
          config={config?.chat ?? null}
          onSave={(c) => handleSave('chat', c)}
          requiredCapability="toolCalling"
        />

        <AIFunctionCard
          functionType="textGeneration"
          title="Text Generation"
          description="Generates recommendation explanations, taste profiles, and playlist descriptions."
          icon={<AutoFixHighIcon />}
          iconColor="#ff9800"
          config={config?.textGeneration ?? null}
          onSave={(c) => handleSave('textGeneration', c)}
        />

        <AIFunctionCard
          functionType="exploration"
          title="Exploration"
          description="Powers the Explore page. Uses AI to find meaningful connections from conceptual searches like 'feel-good comedies'."
          icon={<ExploreIcon />}
          iconColor="#4caf50"
          config={config?.exploration ?? null}
          onSave={(c) => handleSave('exploration', c)}
        />
      </Box>

      {/* Embedding Sets Manager */}
      <EmbeddingSetsManager />

      {/* Cost Estimator */}
      <Divider sx={{ my: 4 }} />
      <CostEstimatorSection />
    </Box>
  )
}
