/**
 * AI Setup Section - Card-based AI provider configuration for Admin Settings
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
  HubOutlined as HubOutlinedIcon,
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
  const { t } = useTranslation()
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
    if (!confirm(t('settingsAiSetup.confirmDeleteSet', { model }))) {
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
        throw new Error(data.error || t('settingsAiSetup.deleteFailed'))
      }
      // Refresh the list
      fetchSets()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settingsAiSetup.deleteSetError'))
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
          <Typography variant="h6">{t('settingsAiSetup.embeddingSetsTitle')}</Typography>
          <Chip 
            size="small" 
            label={t('settingsAiSetup.setsCount', { count: sets.length })} 
            sx={{ ml: 'auto' }}
          />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('settingsAiSetup.embeddingSetsBody')}
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
                    <Chip size="small" label={t('settingsAiSetup.chipActive')} color="success" />
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {t('settingsAiSetup.statsLine', {
                    dimensions: set.dimensions,
                    movies: set.movieCount.toLocaleString(),
                    series: set.seriesCount.toLocaleString(),
                    episodes: set.episodeCount.toLocaleString(),
                  })}
                </Typography>
              </Box>
              
              {!set.isActive && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(set.model)}
                  disabled={deleting === set.model}
                  title={t('settingsAiSetup.deleteSetTooltip')}
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
  const { t } = useTranslation()
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
      throw new Error(err.error || t('settingsAiSetup.saveFailed'))
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
          {t('settingsAiSetup.pageTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('settingsAiSetup.pageSubtitle')}
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
          title={t('settingsAiSetup.cardEmbeddingsTitle')}
          description={t('settingsAiSetup.cardEmbeddingsDesc')}
          icon={<MemoryIcon />}
          iconColor="#2196f3"
          config={config?.embeddings ?? null}
          onSave={(c) => handleSave('embeddings', c)}
          requiredCapability="embeddings"
        />

        <AIFunctionCard
          functionType="chat"
          title={t('settingsAiSetup.cardChatTitle')}
          description={t('settingsAiSetup.cardChatDesc')}
          icon={<SmartToyIcon />}
          iconColor="#9c27b0"
          config={config?.chat ?? null}
          onSave={(c) => handleSave('chat', c)}
          requiredCapability="toolCalling"
        />

        <AIFunctionCard
          functionType="textGeneration"
          title={t('settingsAiSetup.cardTextGenTitle')}
          description={t('settingsAiSetup.cardTextGenDesc')}
          icon={<AutoFixHighIcon />}
          iconColor="#ff9800"
          config={config?.textGeneration ?? null}
          onSave={(c) => handleSave('textGeneration', c)}
        />

        <AIFunctionCard
          functionType="exploration"
          title={t('settingsAiSetup.cardExplorationTitle')}
          description={t('settingsAiSetup.cardExplorationDesc')}
          icon={<HubOutlinedIcon />}
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
