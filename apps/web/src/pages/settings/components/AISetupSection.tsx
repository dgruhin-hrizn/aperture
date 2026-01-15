/**
 * AI Setup Section - Card-based AI provider configuration
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  IconButton,
  Alert,
  Chip,
  CircularProgress,
  Link,
  alpha,
  Divider,
} from '@mui/material'
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckCircleIcon,
  Memory as MemoryIcon,
  SmartToy as SmartToyIcon,
  AutoFixHigh as AutoFixHighIcon,
  Cloud as CloudIcon,
  Computer as ComputerIcon,
  Warning as WarningIcon,
  Delete as DeleteIcon,
  Storage as StorageIcon,
} from '@mui/icons-material'
import { CostEstimatorSection } from './CostEstimatorSection'

type AIFunction = 'embeddings' | 'chat' | 'textGeneration'
type ProviderType = 'openai' | 'anthropic' | 'ollama' | 'groq' | 'google' | 'openai-compatible' | 'deepseek'

interface ModelInfo {
  id: string
  name: string
  description?: string
  contextWindow?: string
  embeddingDimensions?: number
  capabilities: {
    supportsToolCalling: boolean
    supportsEmbeddings: boolean
  }
}

interface ProviderInfo {
  id: ProviderType
  name: string
  type: 'cloud' | 'self-hosted' | 'openai-compatible'
  requiresApiKey: boolean
  requiresBaseUrl: boolean
  defaultBaseUrl?: string
  website?: string
}

interface FunctionConfig {
  provider: ProviderType
  model: string
  apiKey?: string
  baseUrl?: string
}

interface AIConfig {
  embeddings: FunctionConfig | null
  chat: FunctionConfig | null
  textGeneration: FunctionConfig | null
}

const PROVIDER_INFO: Record<ProviderType, ProviderInfo> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    type: 'cloud',
    requiresApiKey: true,
    requiresBaseUrl: false,
    website: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'cloud',
    requiresApiKey: true,
    requiresBaseUrl: false,
    website: 'https://console.anthropic.com',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    type: 'cloud',
    requiresApiKey: true,
    requiresBaseUrl: false,
    website: 'https://console.groq.com',
  },
  google: {
    id: 'google',
    name: 'Google AI',
    type: 'cloud',
    requiresApiKey: true,
    requiresBaseUrl: false,
    website: 'https://makersuite.google.com/app/apikey',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'cloud',
    requiresApiKey: true,
    requiresBaseUrl: false,
    website: 'https://platform.deepseek.com',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    type: 'self-hosted',
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
    website: 'https://ollama.ai',
  },
  'openai-compatible': {
    id: 'openai-compatible',
    name: 'OpenAI Compatible',
    type: 'openai-compatible',
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: 'http://localhost:1234/v1',
  },
}

interface AIFunctionCardProps {
  functionType: AIFunction
  title: string
  description: string
  icon: React.ReactNode
  iconColor: string
  config: FunctionConfig | null
  onSave: (config: FunctionConfig) => Promise<void>
  requiredCapability?: 'toolCalling' | 'embeddings'
}

function AIFunctionCard({
  functionType,
  title,
  description,
  icon,
  iconColor,
  config,
  onSave,
  requiredCapability,
}: AIFunctionCardProps) {
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [loading, setLoading] = useState(false)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  
  // Form state
  const [provider, setProvider] = useState<ProviderType>(config?.provider || 'openai')
  const [model, setModel] = useState(config?.model || '')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl || '')
  const [showApiKey, setShowApiKey] = useState(false)
  
  // Status
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  
  const isConfigured = Boolean(config)
  const providerInfo = PROVIDER_INFO[provider]
  const selectedModel = models.find(m => m.id === model)
  
  // Check capability warning
  const hasCapabilityWarning = requiredCapability === 'toolCalling' && 
    selectedModel && !selectedModel.capabilities.supportsToolCalling
  const hasEmbeddingWarning = requiredCapability === 'embeddings' &&
    selectedModel && !selectedModel.capabilities.supportsEmbeddings

  // Fetch providers
  useEffect(() => {
    setLoadingProviders(true)
    fetch(`/api/settings/ai/providers?function=${functionType}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setProviders(data.providers || Object.values(PROVIDER_INFO)))
      .catch(() => setProviders(Object.values(PROVIDER_INFO)))
      .finally(() => setLoadingProviders(false))
  }, [functionType])

  // Load saved credentials for current provider on mount (if no apiKey in config)
  useEffect(() => {
    if (!config?.apiKey && provider) {
      fetch(`/api/settings/ai/credentials/${provider}`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.apiKey) setApiKey(data.apiKey)
          if (data?.baseUrl && !baseUrl) setBaseUrl(data.baseUrl)
        })
        .catch(() => {})
    }
  }, []) // Only run once on mount

  // Fetch models when provider changes
  useEffect(() => {
    setLoading(true)
    fetch(`/api/settings/ai/models?provider=${provider}&function=${functionType}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setModels(data.models || [])
        // Auto-select first model if none selected or current not available
        if (data.models?.length > 0 && !data.models.find((m: ModelInfo) => m.id === model)) {
          setModel(data.models[0].id)
        }
      })
      .catch(() => setModels([]))
      .finally(() => setLoading(false))
  }, [provider, functionType])

  // Set default base URL when switching providers
  useEffect(() => {
    if (providerInfo?.defaultBaseUrl && !baseUrl) {
      setBaseUrl(providerInfo.defaultBaseUrl)
    }
  }, [provider])

  const handleProviderChange = async (newProvider: ProviderType) => {
    setProvider(newProvider)
    setModel('')
    setTestResult(null)
    
    // Fetch saved credentials for this provider
    try {
      const res = await fetch(`/api/settings/ai/credentials/${newProvider}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setApiKey(data.apiKey || '')
        setBaseUrl(data.baseUrl || PROVIDER_INFO[newProvider]?.defaultBaseUrl || '')
      } else {
        setApiKey('')
        setBaseUrl(PROVIDER_INFO[newProvider]?.defaultBaseUrl || '')
      }
    } catch {
      setApiKey('')
      setBaseUrl(PROVIDER_INFO[newProvider]?.defaultBaseUrl || '')
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          function: functionType,
          provider,
          model,
          apiKey: apiKey || undefined,
          baseUrl: baseUrl || undefined,
        }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch {
      setTestResult({ success: false, error: 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    const newConfig: FunctionConfig = {
      provider,
      model,
      apiKey: apiKey || undefined,
      baseUrl: baseUrl || undefined,
    }
    
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await onSave(newConfig)
      setSuccess('Configuration saved!')
      setApiKey('') // Clear for security
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card 
      sx={{ 
        height: '100%',
        borderLeft: 4,
        borderColor: isConfigured ? 'success.main' : 'warning.main',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                p: 1,
                borderRadius: 2,
                bgcolor: alpha(iconColor, 0.1),
                color: iconColor,
                display: 'flex',
              }}
            >
              {icon}
            </Box>
            <Typography variant="h6" fontWeight={600}>
              {title}
            </Typography>
          </Box>
          {isConfigured ? (
            <Chip icon={<CheckCircleIcon />} label="Active" color="success" size="small" />
          ) : (
            <Chip icon={<WarningIcon />} label="Setup Required" color="warning" size="small" />
          )}
        </Box>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" mb={2}>
          {description}
        </Typography>

        {/* Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}
        {testResult && (
          <Alert 
            severity={testResult.success ? 'success' : 'error'} 
            sx={{ mb: 2 }}
            onClose={() => setTestResult(null)}
          >
            {testResult.success 
              ? 'Connection successful!' 
              : `Connection failed: ${testResult.error}`}
          </Alert>
        )}

        {/* Provider & Model Selection */}
        <Box display="flex" gap={2} mb={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Provider</InputLabel>
            <Select
              value={!loadingProviders && providers.length > 0 ? provider : ''}
              label="Provider"
              onChange={(e) => handleProviderChange(e.target.value as ProviderType)}
              displayEmpty
              disabled={loadingProviders}
            >
              {loadingProviders && (
                <MenuItem value="" disabled>
                  <CircularProgress size={16} sx={{ mr: 1 }} /> Loading...
                </MenuItem>
              )}
              {providers.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  <Box display="flex" alignItems="center" gap={1}>
                    {p.type === 'self-hosted' ? (
                      <ComputerIcon fontSize="small" />
                    ) : (
                      <CloudIcon fontSize="small" />
                    )}
                    {p.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180, flex: 1 }}>
            <InputLabel>Model</InputLabel>
            <Select
              value={!loading && models.length > 0 ? model : ''}
              label="Model"
              onChange={(e) => {
                setModel(e.target.value)
                setTestResult(null)
              }}
              disabled={loading || loadingProviders || providers.length === 0}
              displayEmpty
            >
              {(loading || loadingProviders) && (
                <MenuItem value="" disabled>
                  <CircularProgress size={16} sx={{ mr: 1 }} /> Loading models...
                </MenuItem>
              )}
              {!loading && !loadingProviders && models.length === 0 && (
                <MenuItem value="" disabled>
                  No models available
                </MenuItem>
              )}
              {models.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  <Box>
                    <Typography variant="body2">{m.name}</Typography>
                    {m.description && (
                      <Typography variant="caption" color="text.secondary">
                        {m.description}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Model Info Chips */}
        {selectedModel && (
          <Box display="flex" gap={1} mb={2} flexWrap="wrap">
            {selectedModel.contextWindow && (
              <Chip label={selectedModel.contextWindow} size="small" variant="outlined" />
            )}
            {selectedModel.embeddingDimensions && (
              <Chip 
                label={`${selectedModel.embeddingDimensions}d embeddings`} 
                size="small" 
                variant="outlined" 
              />
            )}
            {selectedModel.capabilities.supportsToolCalling && (
              <Chip 
                label="Tool Calling" 
                size="small" 
                color="success" 
                variant="outlined" 
              />
            )}
          </Box>
        )}

        {/* Capability Warnings */}
        {hasCapabilityWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            This model doesn't support tool calling. The assistant will work but cannot access your library.
          </Alert>
        )}
        {hasEmbeddingWarning && (
          <Alert severity="error" sx={{ mb: 2 }}>
            This model doesn't support embeddings. Choose a different model.
          </Alert>
        )}

        {/* Spacer to push form fields to bottom */}
        <Box flex={1} />

        {/* API Key */}
        {providerInfo?.requiresApiKey && (
          <TextField
            label="API Key"
            type={showApiKey ? 'text' : 'password'}
            value={apiKey || (isConfigured ? '••••••••••••••••' : '')}
            onChange={(e) => setApiKey(e.target.value.replace(/•/g, ''))}
            size="small"
            fullWidth
            placeholder={`Enter your ${providerInfo.name} API key`}
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowApiKey(!showApiKey)} size="small">
                    {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            helperText={
              providerInfo.website && (
                <span>
                  Get your API key from{' '}
                  <Link href={providerInfo.website} target="_blank" rel="noopener">
                    {providerInfo.name}
                  </Link>
                </span>
              )
            }
          />
        )}

        {/* Ollama Instructions */}
        {provider === 'ollama' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Install models on your Ollama server:</strong>
            </Typography>
            <Box component="code" sx={{ 
              display: 'block', 
              bgcolor: 'background.default', 
              p: 1, 
              borderRadius: 1,
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap'
            }}>
              {functionType === 'embeddings' 
                ? '# Embedding models\nollama pull nomic-embed-text\nollama pull mxbai-embed-large\nollama pull nomic-embed-text-v2-moe  # multilingual'
                : '# Chat/Text models (with tool calling)\nollama pull llama3.1\nollama pull qwen3\nollama pull firefunction-v2  # best for tools\n\n# Text generation only\nollama pull gemma3\nollama pull phi4'
              }
            </Box>
          </Alert>
        )}

        {/* Base URL */}
        {providerInfo?.requiresBaseUrl && (
          <TextField
            label="Base URL"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            size="small"
            fullWidth
            placeholder={providerInfo.defaultBaseUrl}
            sx={{ mb: 2 }}
            helperText={
              provider === 'ollama' 
                ? 'Make sure Ollama is running and accessible at this URL'
                : 'OpenAI-compatible API endpoint'
            }
          />
        )}

        {/* Actions */}
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleTest}
            disabled={testing || !model}
          >
            {testing ? <CircularProgress size={16} /> : 'Test'}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleSave}
            disabled={saving || !model}
          >
            {saving ? <CircularProgress size={16} /> : 'Save'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
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
          Configure AI providers for different features. Aperture recommends using OpenAI for all three functions, 
          but feel free to explore other providers and models.
        </Typography>
      </Box>

      {/* Function Cards */}
      <Box 
        display="grid" 
        gridTemplateColumns={{ xs: '1fr', lg: 'repeat(3, 1fr)' }} 
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
      </Box>

      {/* Embedding Sets Manager */}
      <EmbeddingSetsManager />

      {/* Cost Estimator */}
      <Divider sx={{ my: 4 }} />
      <CostEstimatorSection />
    </Box>
  )
}
