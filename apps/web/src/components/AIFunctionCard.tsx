/**
 * Shared AI Function Configuration Card
 * Used in both Admin Settings and Setup Wizard
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ListItemSecondaryAction,
} from '@mui/material'
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckCircleIcon,
  Cloud as CloudIcon,
  Computer as ComputerIcon,
  Warning as WarningIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material'

export type AIFunction = 'embeddings' | 'chat' | 'textGeneration' | 'exploration'
export type ProviderType = 'openai' | 'anthropic' | 'ollama' | 'groq' | 'google' | 'openai-compatible' | 'deepseek' | 'openrouter' | 'huggingface'

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
  isCustom?: boolean
}

export interface ProviderInfo {
  id: ProviderType
  name: string
  type: 'cloud' | 'self-hosted' | 'openai-compatible'
  requiresApiKey: boolean
  requiresBaseUrl: boolean
  defaultBaseUrl?: string
  website?: string
  logoPath?: string
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
    logoPath: '/openai.svg',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'cloud',
    requiresApiKey: true,
    requiresBaseUrl: false,
    website: 'https://console.anthropic.com',
    logoPath: '/claude.svg',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    type: 'cloud',
    requiresApiKey: true,
    requiresBaseUrl: false,
    website: 'https://console.groq.com',
    logoPath: '/groq.svg',
  },
  google: {
    id: 'google',
    name: 'Google AI',
    type: 'cloud',
    requiresApiKey: true,
    requiresBaseUrl: false,
    website: 'https://makersuite.google.com/app/apikey',
    logoPath: '/gemini.svg',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'cloud',
    requiresApiKey: true,
    requiresBaseUrl: false,
    website: 'https://platform.deepseek.com',
    logoPath: '/deepseek.svg',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    type: 'self-hosted',
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
    website: 'https://ollama.ai',
    logoPath: '/ollama.svg',
  },
  'openai-compatible': {
    id: 'openai-compatible',
    name: 'OpenAI Compatible',
    type: 'openai-compatible',
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: 'http://localhost:1234/v1',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'cloud',
    requiresApiKey: true,
    requiresBaseUrl: false,
    website: 'https://openrouter.ai/keys',
    logoPath: '/openrouter.svg',
  },
  huggingface: {
    id: 'huggingface',
    name: 'Hugging Face',
    type: 'cloud',
    requiresApiKey: true,
    requiresBaseUrl: false,
    website: 'https://huggingface.co/settings/tokens',
    logoPath: '/huggingface.svg',
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
  const { t } = useTranslation()
  // Use setup endpoints during first-run (no auth), settings endpoints after
  const apiBase = isSetup ? '/api/setup/ai' : '/api/settings/ai'

  const ollamaNoteLabel = (note: string | null) => {
    if (!note) return null
    const key: Record<string, string> = {
      recommended: 'recommended',
      'higher quality': 'higherQuality',
      multilingual: 'multilingual',
      'best for tools': 'bestForTools',
      fast: 'fast',
      'small & capable': 'smallCapable',
    }
    const k = key[note]
    return k ? t(`aiFunctionCard.ollamaNotes.${k}`) : note
  }
  
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
  
  // Custom model dialog state
  const [addModelDialogOpen, setAddModelDialogOpen] = useState(false)
  const [newModelName, setNewModelName] = useState('')
  const [newModelEmbeddingDimensions, setNewModelEmbeddingDimensions] = useState<number | ''>('')
  const [addingModel, setAddingModel] = useState(false)
  const [deletingModel, setDeletingModel] = useState<string | null>(null)
  const [dialogTesting, setDialogTesting] = useState(false)
  const [dialogTestResult, setDialogTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  
  // Valid embedding dimensions
  const VALID_EMBEDDING_DIMENSIONS = [256, 384, 512, 768, 1024, 1536, 3072, 4096]
  
  // Status
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  
  const isConfigured = Boolean(config)
  const providerInfo = PROVIDER_INFO[provider]
  const selectedModel = models.find(m => m.id === model)
  const supportsCustomModels = provider === 'ollama' || provider === 'openai-compatible' || provider === 'openrouter' || provider === 'huggingface'

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
      setTestResult({ success: false, error: t('aiFunctionCard.connectionFailed') })
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
      setSuccess(t('aiFunctionCard.configSaved'))
      setApiKey('') // Clear for security
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiFunctionCard.failedToSave'))
    } finally {
      setSaving(false)
    }
  }

  // Refresh models list
  const refreshModels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/models?provider=${provider}&function=${functionType}`, { credentials: 'include' })
      const data = await res.json()
      setModels(data.models || [])
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [apiBase, provider, functionType])

  // Test custom model in dialog
  const handleTestCustomModel = async () => {
    if (!newModelName.trim()) return
    
    setDialogTesting(true)
    setDialogTestResult(null)
    try {
      const res = await fetch(`${apiBase}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          function: functionType,
          provider,
          model: newModelName.trim(),
          apiKey: apiKey || undefined,
          baseUrl: baseUrl || undefined,
        }),
      })
      const data = await res.json()
      setDialogTestResult(data)
    } catch {
      setDialogTestResult({ success: false, error: t('aiFunctionCard.connectionFailed') })
    } finally {
      setDialogTesting(false)
    }
  }

  // Add custom model (only after successful test)
  const handleAddCustomModel = async () => {
    if (!newModelName.trim() || !dialogTestResult?.success) return
    // For embeddings, require dimension selection
    if (functionType === 'embeddings' && !newModelEmbeddingDimensions) return
    
    setAddingModel(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/custom-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider,
          function: functionType,
          modelId: newModelName.trim(),
          ...(functionType === 'embeddings' && newModelEmbeddingDimensions && {
            embeddingDimensions: newModelEmbeddingDimensions,
          }),
        }),
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('aiFunctionCard.failedAddCustom'))
      }
      
      // Refresh models list and select the new model
      await refreshModels()
      setModel(newModelName.trim())
      setAddModelDialogOpen(false)
      setNewModelName('')
      setNewModelEmbeddingDimensions('')
      setDialogTestResult(null)
      setSuccess(t('aiFunctionCard.customModelAdded', { name: newModelName.trim() }))
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiFunctionCard.failedAddCustom'))
    } finally {
      setAddingModel(false)
    }
  }
  
  // Close dialog and reset state
  const handleCloseDialog = () => {
    setAddModelDialogOpen(false)
    setNewModelName('')
    setNewModelEmbeddingDimensions('')
    setDialogTestResult(null)
  }

  // Delete custom model
  const handleDeleteCustomModel = async (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent selecting the model
    
    setDeletingModel(modelId)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/custom-models`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider,
          function: functionType,
          modelId,
        }),
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('aiFunctionCard.failedDeleteCustom'))
      }
      
      // If the deleted model was selected, clear selection
      if (model === modelId) {
        setModel('')
      }
      
      // Refresh models list
      await refreshModels()
      setSuccess(t('aiFunctionCard.customModelDeleted', { name: modelId }))
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiFunctionCard.failedDeleteCustom'))
    } finally {
      setDeletingModel(null)
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
            <Chip icon={<CheckCircleIcon />} label={t('aiFunctionCard.chipActive')} color="success" size="small" />
          ) : (
            <Chip icon={<WarningIcon />} label={t('aiFunctionCard.chipSetupRequired')} color="warning" size="small" />
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
              ? t('aiFunctionCard.connectionSuccess')
              : t('aiFunctionCard.connectionFailedWithError', { error: testResult.error ?? '' })}
          </Alert>
        )}

        {/* Provider & Model Selection */}
        <Box display="flex" flexDirection="column" gap={2} mb={2}>
          <FormControl size="small" fullWidth>
            <InputLabel>{t('aiFunctionCard.provider')}</InputLabel>
            <Select
              value={!loadingProviders && providers.length > 0 ? provider : ''}
              label={t('aiFunctionCard.provider')}
              onChange={(e) => handleProviderChange(e.target.value as ProviderType)}
              displayEmpty
              disabled={loadingProviders}
            >
              {loadingProviders && (
                <MenuItem value="" disabled>
                  <CircularProgress size={16} sx={{ mr: 1 }} /> {t('aiFunctionCard.loadingProviders')}
                </MenuItem>
              )}
              {[...providers].sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
                const info = PROVIDER_INFO[p.id as ProviderType]
                return (
                  <MenuItem key={p.id} value={p.id}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {info?.logoPath ? (
                        <Box
                          component="img"
                          src={info.logoPath}
                          alt={p.name}
                          sx={{ 
                            width: 20, 
                            height: 20, 
                            objectFit: 'contain',
                            filter: (theme) => theme.palette.mode === 'dark' ? 'brightness(0) invert(1)' : 'none',
                          }}
                        />
                      ) : p.type === 'self-hosted' ? (
                        <ComputerIcon fontSize="small" />
                      ) : (
                        <CloudIcon fontSize="small" />
                      )}
                      {p.name}
                    </Box>
                  </MenuItem>
                )
              })}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>{t('aiFunctionCard.model')}</InputLabel>
            <Select
              value={!loading && models.length > 0 ? model : ''}
              label={t('aiFunctionCard.model')}
              onChange={(e) => {
                const value = e.target.value
                if (value === '__add_custom__') {
                  setAddModelDialogOpen(true)
                } else {
                  setModel(value)
                  setTestResult(null)
                }
              }}
              disabled={loading || loadingProviders || providers.length === 0}
              displayEmpty
              renderValue={(selected) => {
                if (!selected) return ''
                const selectedModelInfo = models.find(m => m.id === selected)
                if (selectedModelInfo?.isCustom) {
                  return <Typography variant="body2" sx={{ fontStyle: 'italic' }}>{selectedModelInfo.name}</Typography>
                }
                return selectedModelInfo?.name || selected
              }}
            >
              {(loading || loadingProviders) && (
                <MenuItem value="" disabled>
                  <CircularProgress size={16} sx={{ mr: 1 }} /> {t('aiFunctionCard.loadingModels')}
                </MenuItem>
              )}
              {!loading && !loadingProviders && models.length === 0 && !supportsCustomModels && (
                <MenuItem value="" disabled>
                  {t('aiFunctionCard.noModelsAvailable')}
                </MenuItem>
              )}
              {/* Built-in models */}
              {[...models].filter(m => !m.isCustom).sort((a, b) => a.name.localeCompare(b.name)).map((m) => (
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
              {/* Custom models with delete button */}
              {models.filter(m => m.isCustom).length > 0 && (
                <MenuItem disabled sx={{ borderTop: 1, borderColor: 'divider', mt: 1, opacity: 0.7 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('aiFunctionCard.customModelsHeader')}
                  </Typography>
                </MenuItem>
              )}
              {models.filter(m => m.isCustom).sort((a, b) => a.name.localeCompare(b.name)).map((m) => (
                <MenuItem key={m.id} value={m.id} sx={{ pr: 6 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>{m.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('aiFunctionCard.customModelSubtitle')}
                      </Typography>
                    </Box>
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={(e) => handleDeleteCustomModel(m.id, e)}
                        disabled={deletingModel === m.id}
                        sx={{ 
                          opacity: 0.6,
                          '&:hover': { opacity: 1, color: 'error.main' }
                        }}
                      >
                        {deletingModel === m.id ? (
                          <CircularProgress size={16} />
                        ) : (
                          <DeleteIcon fontSize="small" />
                        )}
                      </IconButton>
                    </ListItemSecondaryAction>
                  </Box>
                </MenuItem>
              ))}
              {/* Add custom model option for self-hosted providers */}
              {supportsCustomModels && (
                <MenuItem 
                  value="__add_custom__" 
                  sx={{ 
                    borderTop: 1, 
                    borderColor: 'divider', 
                    mt: 1,
                    color: 'primary.main',
                  }}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <AddIcon fontSize="small" />
                    <Box>
                      <Typography variant="body2">{t('aiFunctionCard.addCustomModel')}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('aiFunctionCard.addCustomModelHint')}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              )}
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
                label={t('aiFunctionCard.embeddingsDimensions', { d: selectedModel.embeddingDimensions })}
                size="small"
                variant="outlined"
              />
            )}
            {selectedModel.capabilities.supportsToolCalling && (
              <Chip
                label={t('aiFunctionCard.toolCalling')}
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
              <strong>{t('aiFunctionCard.toolCallingWarningTitle')}</strong>
            </Typography>
            <Typography variant="body2">
              {t('aiFunctionCard.toolCallingWarningBody')}
              {provider === 'ollama' && t('aiFunctionCard.toolCallingWarningOllama')}
            </Typography>
          </Alert>
        )}
        {hasEmbeddingWarning && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t('aiFunctionCard.embeddingUnsupported')}
          </Alert>
        )}

        {/* Spacer to push form fields to bottom */}
        <Box flex={1} />

        {/* API Key */}
        {providerInfo?.requiresApiKey && (
          <TextField
            label={t('aiFunctionCard.apiKey')}
            type={showApiKey ? 'text' : 'password'}
            value={apiKey || (isConfigured ? '••••••••••••••••' : '')}
            onChange={(e) => setApiKey(e.target.value.replace(/•/g, ''))}
            size="small"
            fullWidth
            placeholder={t('aiFunctionCard.apiKeyPlaceholder', { provider: providerInfo.name })}
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
                  {t('aiFunctionCard.getApiKeyPrefix')}{' '}
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
              {t('aiFunctionCard.ollamaInstallTitle')}
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
                      label={ollamaNoteLabel(note)}
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
            label={t('aiFunctionCard.baseUrl')}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            size="small"
            fullWidth
            placeholder={providerInfo.defaultBaseUrl}
            sx={{ mb: 2 }}
            helperText={
              provider === 'ollama'
                ? t('aiFunctionCard.baseUrlHelperOllama')
                : t('aiFunctionCard.baseUrlHelperCompatible')
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
            {testing ? <CircularProgress size={16} /> : t('aiFunctionCard.test')}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleSave}
            disabled={saving || !model}
          >
            {saving ? <CircularProgress size={16} /> : t('common.save')}
          </Button>
        </Box>
      </CardContent>

      {/* Add Custom Model Dialog */}
      <Dialog 
        open={addModelDialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('aiFunctionCard.dialogAddCustomTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {provider === 'ollama' && t('aiFunctionCard.addCustomDialog_ollama')}
            {provider === 'openrouter' && t('aiFunctionCard.addCustomDialog_openrouter')}
            {provider === 'huggingface' && t('aiFunctionCard.addCustomDialog_huggingface')}
            {provider !== 'ollama' && provider !== 'openrouter' && provider !== 'huggingface' &&
              t('aiFunctionCard.addCustomDialog_compatible')}
          </Typography>
          <TextField
            autoFocus
            label={t('aiFunctionCard.modelName')}
            value={newModelName}
            onChange={(e) => {
              setNewModelName(e.target.value)
              // Reset test result when model name changes
              setDialogTestResult(null)
            }}
            fullWidth
            size="small"
            placeholder={
              provider === 'ollama'
                ? t('aiFunctionCard.placeholderOllama')
                : provider === 'openrouter'
                  ? t('aiFunctionCard.placeholderOpenrouter')
                  : provider === 'huggingface'
                    ? t('aiFunctionCard.placeholderHuggingface')
                    : t('aiFunctionCard.placeholderDefault')
            }
            disabled={dialogTesting}
            sx={{ mb: 2 }}
          />
          
          {/* Embedding Dimensions Dropdown - only for embeddings function */}
          {functionType === 'embeddings' && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {t('aiFunctionCard.embeddingVectorTitle')}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  {t('aiFunctionCard.embeddingVectorBody')}
                </Typography>
                <Typography variant="body2" component="div">
                  <strong>{t('aiFunctionCard.embeddingCommonDimensionsTitle')}</strong>
                  <Box
                    component="span"
                    sx={{ display: 'block', mt: 0.5, whiteSpace: 'pre-line', pl: 0 }}
                  >
                    {t('aiFunctionCard.embeddingCommonDimensionsList')}
                  </Box>
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                  {t('aiFunctionCard.embeddingCheckDocs')}
                </Typography>
              </Alert>

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>{t('aiFunctionCard.embeddingDimensionsLabel')}</InputLabel>
                <Select
                  value={newModelEmbeddingDimensions}
                  label={t('aiFunctionCard.embeddingDimensionsLabel')}
                  onChange={(e) => setNewModelEmbeddingDimensions(e.target.value as number | '')}
                  disabled={dialogTesting}
                >
                  <MenuItem value="" disabled>
                    <em>{t('aiFunctionCard.selectDimensions')}</em>
                  </MenuItem>
                  {VALID_EMBEDDING_DIMENSIONS.map((dim) => (
                    <MenuItem key={dim} value={dim}>
                      {t('aiFunctionCard.dimensionOption', { dim })}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}
          
          {/* Test Result */}
          {dialogTestResult && (
            <Alert 
              severity={dialogTestResult.success ? 'success' : 'error'} 
              sx={{ mb: 2 }}
            >
              {dialogTestResult.success
                ? t('aiFunctionCard.modelValidatedSuccess')
                : t('aiFunctionCard.validationFailedWithError', { error: dialogTestResult.error ?? '' })}
            </Alert>
          )}
          
          {/* Testing indicator */}
          {dialogTesting && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, color: 'text.secondary' }}>
              <CircularProgress size={20} />
              <Typography variant="body2">
                {t('aiFunctionCard.validatingModel', {
                  ollamaSuffix:
                    provider === 'ollama' ? t('aiFunctionCard.validatingModelOllamaSuffix') : '',
                })}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseDialog}
            disabled={dialogTesting || addingModel}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleTestCustomModel}
            variant="outlined"
            disabled={!newModelName.trim() || dialogTesting || addingModel}
          >
            {dialogTesting ? <CircularProgress size={16} /> : t('aiFunctionCard.test')}
          </Button>
          <Button
            onClick={handleAddCustomModel}
            variant="contained"
            disabled={
              !newModelName.trim() ||
              !dialogTestResult?.success ||
              addingModel ||
              (functionType === 'embeddings' && !newModelEmbeddingDimensions)
            }
          >
            {addingModel ? <CircularProgress size={16} /> : t('aiFunctionCard.addModel')}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

