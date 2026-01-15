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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
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
  
  // Embedding dimension change confirmation dialog
  const [showEmbeddingDialog, setShowEmbeddingDialog] = useState(false)
  const [pendingConfig, setPendingConfig] = useState<FunctionConfig | null>(null)
  const [clearingEmbeddings, setClearingEmbeddings] = useState(false)
  
  const isConfigured = Boolean(config)
  const providerInfo = PROVIDER_INFO[provider]
  const selectedModel = models.find(m => m.id === model)
  
  // Get current configured model's dimensions
  const currentConfiguredModel = config?.model
  const currentModels = models // Use current models list
  const configuredModelInfo = currentModels.find(m => m.id === currentConfiguredModel)
  const configuredDimensions = configuredModelInfo?.embeddingDimensions
  const newDimensions = selectedModel?.embeddingDimensions
  
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

  const handleProviderChange = (newProvider: ProviderType) => {
    setProvider(newProvider)
    setModel('')
    setApiKey('')
    setBaseUrl(PROVIDER_INFO[newProvider]?.defaultBaseUrl || '')
    setTestResult(null)
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
    
    // Check if this is an embedding config change with different dimensions
    if (functionType === 'embeddings' && isConfigured && configuredDimensions && newDimensions && 
        configuredDimensions !== newDimensions) {
      // Show confirmation dialog
      setPendingConfig(newConfig)
      setShowEmbeddingDialog(true)
      return
    }
    
    // Normal save
    await doSave(newConfig)
  }
  
  const doSave = async (configToSave: FunctionConfig) => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await onSave(configToSave)
      setSuccess('Configuration saved!')
      setApiKey('') // Clear for security
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }
  
  const handleEmbeddingDialogConfirm = async () => {
    if (!pendingConfig) return
    
    setClearingEmbeddings(true)
    setError(null)
    
    try {
      // 1. Clear all embeddings
      const clearRes = await fetch('/api/settings/ai/embeddings/clear', {
        method: 'POST',
        credentials: 'include',
      })
      if (!clearRes.ok) {
        throw new Error('Failed to clear embeddings')
      }
      
      // 2. Save the new config
      await onSave(pendingConfig)
      
      // 3. Trigger embedding regeneration job
      await fetch('/api/jobs/generate-movie-embeddings/run', {
        method: 'POST',
        credentials: 'include',
      })
      await fetch('/api/jobs/generate-series-embeddings/run', {
        method: 'POST',
        credentials: 'include',
      })
      
      setSuccess('Embeddings cleared and regeneration started!')
      setApiKey('')
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update embeddings')
    } finally {
      setClearingEmbeddings(false)
      setShowEmbeddingDialog(false)
      setPendingConfig(null)
    }
  }
  
  const handleEmbeddingDialogCancel = () => {
    // Restore previous selection
    if (config) {
      setProvider(config.provider)
      setModel(config.model)
      setBaseUrl(config.baseUrl || '')
    }
    setShowEmbeddingDialog(false)
    setPendingConfig(null)
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
                ? '# Embedding models\nollama pull nomic-embed-text\nollama pull mxbai-embed-large'
                : '# Chat/Text models\nollama pull llama3.2\nollama pull mistral\nollama pull qwen2.5'
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
      
      {/* Embedding Dimension Change Confirmation Dialog */}
      <Dialog
        open={showEmbeddingDialog}
        onClose={handleEmbeddingDialogCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'warning.main' }}>
          ⚠️ Embedding Dimensions Changed
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            You are switching from <strong>{configuredDimensions}d</strong> embeddings to{' '}
            <strong>{newDimensions}d</strong> embeddings.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>This will:</strong>
          </DialogContentText>
          <Box component="ul" sx={{ pl: 2, mb: 2 }}>
            <Typography component="li" variant="body2" color="text.secondary">
              Delete all existing movie, series, and episode embeddings
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Start regenerating embeddings with the new model
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Semantic search and recommendations will be unavailable until complete
            </Typography>
          </Box>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This process may take a while depending on your library size and will use API credits.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleEmbeddingDialogCancel} 
            disabled={clearingEmbeddings}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleEmbeddingDialogConfirm} 
            variant="contained" 
            color="warning"
            disabled={clearingEmbeddings}
          >
            {clearingEmbeddings ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Clearing Embeddings...
              </>
            ) : (
              'Confirm & Regenerate'
            )}
          </Button>
        </DialogActions>
      </Dialog>
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

      {/* Cost Estimator */}
      <Divider sx={{ my: 4 }} />
      <CostEstimatorSection />
    </Box>
  )
}
