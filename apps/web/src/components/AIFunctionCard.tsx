/**
 * Shared AI Function Configuration Card
 * Used in both Admin Settings and Setup Wizard
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
} from '@mui/material'
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckCircleIcon,
  Cloud as CloudIcon,
  Computer as ComputerIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'

export type AIFunction = 'embeddings' | 'chat' | 'textGeneration'
export type ProviderType = 'openai' | 'anthropic' | 'ollama' | 'groq' | 'google' | 'openai-compatible' | 'deepseek'

export interface ModelInfo {
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

export interface ProviderInfo {
  id: ProviderType
  name: string
  type: 'cloud' | 'self-hosted' | 'openai-compatible'
  requiresApiKey: boolean
  requiresBaseUrl: boolean
  defaultBaseUrl?: string
  website?: string
}

export interface FunctionConfig {
  provider: ProviderType
  model: string
  apiKey?: string
  baseUrl?: string
}

export const PROVIDER_INFO: Record<ProviderType, ProviderInfo> = {
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

export interface AIFunctionCardProps {
  functionType: AIFunction
  title: string
  description: string
  icon: React.ReactNode
  iconColor: string
  config: FunctionConfig | null
  onSave: (config: FunctionConfig) => Promise<void>
  requiredCapability?: 'toolCalling' | 'embeddings'
  compact?: boolean // For wizard mode
  isSetup?: boolean // Use unauthenticated /api/setup/* endpoints during first-run
}

export function AIFunctionCard({
  functionType,
  title,
  description,
  icon,
  iconColor,
  config,
  onSave,
  requiredCapability,
  compact = false,
  isSetup = false,
}: AIFunctionCardProps) {
  // Use setup endpoints during first-run (no auth), settings endpoints after
  const apiBase = isSetup ? '/api/setup/ai' : '/api/settings/ai'
  
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
  const [initialized, setInitialized] = useState(false)
  
  // Status
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  
  const isConfigured = Boolean(config)
  const providerInfo = PROVIDER_INFO[provider]
  const selectedModel = models.find(m => m.id === model)

  // Sync form state when config prop changes (e.g., loaded from DB)
  useEffect(() => {
    if (config && !initialized) {
      if (config.provider) setProvider(config.provider)
      if (config.model) setModel(config.model)
      if (config.baseUrl) setBaseUrl(config.baseUrl)
      setInitialized(true)
    }
  }, [config, initialized])
  
  // Check capability warning
  const hasCapabilityWarning = requiredCapability === 'toolCalling' && 
    selectedModel && !selectedModel.capabilities.supportsToolCalling
  const hasEmbeddingWarning = requiredCapability === 'embeddings' &&
    selectedModel && !selectedModel.capabilities.supportsEmbeddings

  // Fetch providers
  useEffect(() => {
    setLoadingProviders(true)
    fetch(`${apiBase}/providers?function=${functionType}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setProviders(data.providers || Object.values(PROVIDER_INFO)))
      .catch(() => setProviders(Object.values(PROVIDER_INFO)))
      .finally(() => setLoadingProviders(false))
  }, [functionType, apiBase])

  // Load saved credentials for current provider on mount (if no apiKey in config)
  useEffect(() => {
    if (!config?.apiKey && provider) {
      fetch(`${apiBase}/credentials/${provider}`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.apiKey) setApiKey(data.apiKey)
          if (data?.baseUrl && !baseUrl) setBaseUrl(data.baseUrl)
        })
        .catch(() => {})
    }
  }, [apiBase]) // Run on mount and when apiBase changes

  // Fetch models when provider changes
  useEffect(() => {
    setLoading(true)
    fetch(`${apiBase}/models?provider=${provider}&function=${functionType}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setModels(data.models || [])
        // If we have a config model and it's in the list, keep it selected
        // Otherwise auto-select first model
        if (data.models?.length > 0) {
          const configModelExists = config?.model && data.models.find((m: ModelInfo) => m.id === config.model)
          if (configModelExists && !model) {
            setModel(config.model)
          } else if (!model || !data.models.find((m: ModelInfo) => m.id === model)) {
            setModel(data.models[0].id)
          }
        }
      })
      .catch(() => setModels([]))
      .finally(() => setLoading(false))
  }, [provider, functionType, config?.model, apiBase])

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
      const res = await fetch(`${apiBase}/credentials/${newProvider}`, { credentials: 'include' })
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
      const res = await fetch(`${apiBase}/test`, {
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
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: compact ? 2 : 3 }}>
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
            <Typography variant={compact ? 'subtitle1' : 'h6'} fontWeight={600}>
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
              {[...providers].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
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
              {[...models].sort((a, b) => a.name.localeCompare(b.name)).map((m) => (
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
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>This model doesn't support reliable tool calling.</strong>
            </Typography>
            <Typography variant="body2">
              The assistant will work but cannot search your library or make recommendations.
              {provider === 'ollama' && ' For Ollama, use firefunction-v2 or qwen3 instead.'}
            </Typography>
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
          <Box sx={{ 
            mb: 2, 
            p: 2, 
            borderRadius: 2, 
            bgcolor: (theme) => alpha(theme.palette.info.main, 0.08),
            border: 1,
            borderColor: (theme) => alpha(theme.palette.info.main, 0.2),
          }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'info.main', display: 'flex', alignItems: 'center', gap: 1 }}>
              <ComputerIcon fontSize="small" />
              Install models on your Ollama server
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {(functionType === 'embeddings' 
                ? [
                    { cmd: 'ollama pull nomic-embed-text', note: 'recommended' },
                    { cmd: 'ollama pull mxbai-embed-large', note: 'higher quality' },
                    { cmd: 'ollama pull nomic-embed-text-v2-moe', note: 'multilingual' },
                  ]
                : functionType === 'chat'
                ? [
                    { cmd: 'ollama pull qwen3', note: 'recommended' },
                    { cmd: 'ollama pull firefunction-v2', note: 'best for tools' },
                  ]
                : [
                    { cmd: 'ollama pull llama3.2', note: 'recommended' },
                    { cmd: 'ollama pull llama3.1', note: null },
                    { cmd: 'ollama pull gemma3', note: 'fast' },
                    { cmd: 'ollama pull phi4', note: 'small & capable' },
                  ]
              ).map(({ cmd, note }) => (
                <Box 
                  key={cmd}
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    flexWrap: 'wrap',
                    gap: 0.5,
                    bgcolor: 'background.paper',
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                  }}
                >
                  <Box component="span" sx={{ color: 'text.primary' }}>{cmd}</Box>
                  {note && (
                    <Chip 
                      label={note} 
                      size="small" 
                      variant="outlined"
                      sx={{ 
                        height: 20, 
                        fontSize: '0.65rem',
                        '& .MuiChip-label': { px: 1 }
                      }} 
                    />
                  )}
                </Box>
              ))}
            </Box>
          </Box>
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

