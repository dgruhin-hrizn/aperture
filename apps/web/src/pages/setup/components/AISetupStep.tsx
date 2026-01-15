import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Alert,
  Button,
  Card,
  CardContent,
  TextField,
  MenuItem,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  Chip,
  Divider,
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  OpenInNew as OpenInNewIcon,
  Psychology as PsychologyIcon,
  Chat as ChatIcon,
  TextFields as TextFieldsIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import type { SetupWizardContext, AIFunction, AIFunctionConfig, AIModelOption } from '../types'

interface AISetupStepProps {
  wizard: SetupWizardContext
}

interface FunctionConfigCardProps {
  title: string
  description: string
  icon: React.ReactNode
  functionType: AIFunction
  config: AIFunctionConfig | null | undefined
  providers: SetupWizardContext['aiProviders']
  testResult: boolean | null
  onConfigChange: (config: AIFunctionConfig | null) => void
  onTest: () => Promise<boolean>
  testing: boolean
  getModels: (providerId: string, fn: AIFunction) => Promise<AIModelOption[]>
  recommended?: boolean
}

function FunctionConfigCard({
  title,
  description,
  icon,
  functionType,
  config,
  providers,
  testResult,
  onConfigChange,
  onTest,
  testing,
  getModels,
  recommended,
}: FunctionConfigCardProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [models, setModels] = useState<AIModelOption[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  const selectedProvider = providers.find((p) => p.id === config?.provider)

  // Load models when provider changes
  useEffect(() => {
    if (!config?.provider) {
      setModels([])
      return
    }

    setLoadingModels(true)
    getModels(config.provider, functionType)
      .then((m) => setModels(m))
      .finally(() => setLoadingModels(false))
  }, [config?.provider, functionType, getModels])

  const handleProviderChange = useCallback(
    async (providerId: string) => {
      const provider = providers.find((p) => p.id === providerId)
      if (provider) {
        // Fetch saved credentials for this provider
        let savedApiKey = ''
        let savedBaseUrl = ''
        try {
          const res = await fetch(`/api/settings/ai/credentials/${providerId}`, { credentials: 'include' })
          if (res.ok) {
            const data = await res.json()
            savedApiKey = data.apiKey || ''
            savedBaseUrl = data.baseUrl || ''
          }
        } catch {
          // Ignore errors, use defaults
        }

        onConfigChange({
          provider: providerId,
          model: '',
          apiKey: savedApiKey || config?.apiKey || '',
          baseUrl: savedBaseUrl || provider.defaultBaseUrl || '',
        })
      }
    },
    [providers, config, onConfigChange]
  )

  const handleModelChange = useCallback(
    (modelId: string) => {
      onConfigChange({
        ...config!,
        model: modelId,
      })
    },
    [config, onConfigChange]
  )

  const handleApiKeyChange = useCallback(
    (apiKey: string) => {
      onConfigChange({
        ...config!,
        apiKey,
      })
    },
    [config, onConfigChange]
  )

  const handleBaseUrlChange = useCallback(
    (baseUrl: string) => {
      onConfigChange({
        ...config!,
        baseUrl,
      })
    },
    [config, onConfigChange]
  )

  // Filter providers that support this function
  const availableProviders = providers.filter((p) => {
    if (functionType === 'embeddings') return p.supportsEmbeddings
    if (functionType === 'chat') return p.supportsChat
    if (functionType === 'textGeneration') return p.supportsTextGeneration
    return false
  })

  const isConfigured = config?.provider && config?.model
  const needsApiKey = selectedProvider?.requiresApiKey && !config?.apiKey
  const needsBaseUrl = selectedProvider?.requiresBaseUrl && !config?.baseUrl

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: testResult === true ? 'success.main' : testResult === false ? 'error.main' : 'divider',
        transition: 'border-color 0.2s',
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 1,
              bgcolor: testResult === true ? 'success.light' : 'action.hover',
              color: testResult === true ? 'success.contrastText' : 'text.secondary',
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {title}
              </Typography>
              {recommended && (
                <Chip label="Required" size="small" color="primary" variant="outlined" />
              )}
              {testResult === true && (
                <CheckCircleIcon color="success" fontSize="small" />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Provider Selection */}
          <TextField
            select
            fullWidth
            size="small"
            label="Provider"
            value={config?.provider || ''}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            <MenuItem value="">Select a provider...</MenuItem>
            {availableProviders.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                <Box>
                  <Typography variant="body2">{p.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {p.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </TextField>

          {/* API Key (if required) */}
          {selectedProvider?.requiresApiKey && (
            <TextField
              fullWidth
              size="small"
              label="API Key"
              type={showApiKey ? 'text' : 'password'}
              value={config?.apiKey || ''}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder={selectedProvider.id === 'openai' ? 'sk-...' : 'Enter API key'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowApiKey(!showApiKey)} edge="end" size="small">
                      {showApiKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          )}

          {/* Ollama Instructions */}
          {selectedProvider?.id === 'ollama' && (
            <Alert severity="info" sx={{ mb: 1 }}>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Install models on your Ollama server:</strong>
              </Typography>
              <Box component="code" sx={{ 
                display: 'block', 
                bgcolor: 'background.default', 
                p: 1, 
                borderRadius: 1,
                fontSize: '0.7rem',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap'
              }}>
                {functionType === 'embeddings' 
                  ? 'ollama pull nomic-embed-text\nollama pull mxbai-embed-large'
                  : 'ollama pull llama3.1\nollama pull qwen3\nollama pull firefunction-v2'
                }
              </Box>
            </Alert>
          )}

          {/* Base URL (if required) */}
          {selectedProvider?.requiresBaseUrl && (
            <TextField
              fullWidth
              size="small"
              label="Base URL"
              value={config?.baseUrl || ''}
              onChange={(e) => handleBaseUrlChange(e.target.value)}
              placeholder={
                selectedProvider.id === 'ollama'
                  ? 'http://localhost:11434'
                  : selectedProvider.id === 'lm-studio'
                  ? 'http://localhost:1234'
                  : 'http://localhost:8080'
              }
              helperText={
                selectedProvider.id === 'ollama'
                  ? 'Ollama server URL (make sure Ollama is running)'
                  : selectedProvider.id === 'lm-studio'
                  ? 'LM Studio server URL'
                  : 'Server base URL'
              }
            />
          )}

          {/* Model Selection */}
          {config?.provider && (
            <TextField
              select
              fullWidth
              size="small"
              label="Model"
              value={config?.model || ''}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={loadingModels || needsApiKey || needsBaseUrl}
              helperText={
                needsApiKey
                  ? 'Enter API key first'
                  : needsBaseUrl
                  ? 'Enter server URL first'
                  : loadingModels
                  ? 'Loading models...'
                  : ''
              }
            >
              <MenuItem value="">Select a model...</MenuItem>
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
            </TextField>
          )}

          {/* Test Button */}
          {isConfigured && !needsApiKey && !needsBaseUrl && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={onTest}
                disabled={testing}
                startIcon={testing ? <CircularProgress size={16} /> : undefined}
                color={testResult === true ? 'success' : testResult === false ? 'error' : 'primary'}
              >
                {testing ? 'Testing...' : testResult === true ? 'Tested ✓' : 'Test Connection'}
              </Button>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

export function AISetupStep({ wizard }: AISetupStepProps) {
  const {
    error,
    aiConfig,
    aiProviders,
    aiTestResults,
    testing,
    saving,
    setAIFunctionConfig,
    testAIConnection,
    saveAIConfig,
    getModelsForProvider,
    goToStep,
  } = wizard

  // Check if at least embeddings is configured
  const hasEmbeddings = aiConfig.embeddings?.provider && aiConfig.embeddings?.model
  const embeddingsTested = aiTestResults.embeddings === true
  const canContinue = hasEmbeddings && embeddingsTested

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configure AI / LLM Providers
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Aperture uses AI to power its recommendation engine. Configure your AI providers below.
        <strong> Aperture recommends using OpenAI</strong> for the best experience, but you can explore
        other providers including local models.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight={500} gutterBottom>
          Need an OpenAI API Key?
        </Typography>
        <Typography variant="body2">
          Visit{' '}
          <Link href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
            platform.openai.com/api-keys
            <OpenInNewIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle' }} />
          </Link>{' '}
          to create one. New accounts get $5 free credits. Typical usage costs ~$0.10-0.50/month.
        </Typography>
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        {/* Embeddings - Required */}
        <FunctionConfigCard
          title="Embeddings"
          description="Required for semantic search and AI recommendations. Generates vector representations of your media library."
          icon={<PsychologyIcon />}
          functionType="embeddings"
          config={aiConfig.embeddings}
          providers={aiProviders}
          testResult={aiTestResults.embeddings}
          onConfigChange={(config) => setAIFunctionConfig('embeddings', config)}
          onTest={() => testAIConnection('embeddings')}
          testing={testing}
          getModels={getModelsForProvider}
          recommended
        />

        <Divider sx={{ my: 1 }}>
          <Chip label="Optional" size="small" variant="outlined" />
        </Divider>

        {/* Chat - Optional */}
        <FunctionConfigCard
          title="Chat Assistant"
          description="Powers the AI chat assistant for conversational interactions about your library."
          icon={<ChatIcon />}
          functionType="chat"
          config={aiConfig.chat}
          providers={aiProviders}
          testResult={aiTestResults.chat}
          onConfigChange={(config) => setAIFunctionConfig('chat', config)}
          onTest={() => testAIConnection('chat')}
          testing={testing}
          getModels={getModelsForProvider}
        />

        {/* Text Generation - Optional */}
        <FunctionConfigCard
          title="Text Generation"
          description="Used for generating recommendation explanations and taste summaries."
          icon={<TextFieldsIcon />}
          functionType="textGeneration"
          config={aiConfig.textGeneration}
          providers={aiProviders}
          testResult={aiTestResults.textGeneration}
          onConfigChange={(config) => setAIFunctionConfig('textGeneration', config)}
          onTest={() => testAIConnection('textGeneration')}
          testing={testing}
          getModels={getModelsForProvider}
        />
      </Box>

      {!canContinue && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          <Typography variant="body2">
            You must configure and test <strong>Embeddings</strong> to continue. This is required for AI recommendations.
          </Typography>
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button variant="outlined" onClick={() => goToStep('topPicks')}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={saveAIConfig}
          disabled={saving || !canContinue}
        >
          {saving ? <CircularProgress size={20} /> : 'Save & Continue'}
        </Button>
      </Box>
    </Box>
  )
}

