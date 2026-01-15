/**
 * AI Setup Step for Setup Wizard
 * Uses the shared AIFunctionCard component
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Alert,
  Button,
  CircularProgress,
  Link,
} from '@mui/material'
import {
  OpenInNew as OpenInNewIcon,
  Memory as MemoryIcon,
  SmartToy as SmartToyIcon,
  AutoFixHigh as AutoFixHighIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { AIFunctionCard, type FunctionConfig, type AIFunction } from '../../../components/AIFunctionCard'
import type { SetupWizardContext } from '../types'

interface AISetupStepProps {
  wizard: SetupWizardContext
}

interface AIConfig {
  embeddings: FunctionConfig | null
  chat: FunctionConfig | null
  textGeneration: FunctionConfig | null
}

export function AISetupStep({ wizard }: AISetupStepProps) {
  const { error, saving, goToStep } = wizard
  
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [testResults, setTestResults] = useState<Record<AIFunction, boolean | null>>({
    embeddings: null,
    chat: null,
    textGeneration: null,
  })

  // Fetch current AI config from each function endpoint (setup-safe)
  const fetchConfig = useCallback(async () => {
    try {
      const [embeddingsRes, chatRes, textGenRes] = await Promise.all([
        fetch('/api/setup/ai/embeddings', { credentials: 'include' }),
        fetch('/api/setup/ai/chat', { credentials: 'include' }),
        fetch('/api/setup/ai/textGeneration', { credentials: 'include' }),
      ])
      
      const embeddingsData = embeddingsRes.ok ? await embeddingsRes.json() : { config: null }
      const chatData = chatRes.ok ? await chatRes.json() : { config: null }
      const textGenData = textGenRes.ok ? await textGenRes.json() : { config: null }
      
      setConfig({
        embeddings: embeddingsData.config,
        chat: chatData.config,
        textGeneration: textGenData.config,
      })
      
      // If config exists, mark as tested
      if (embeddingsData.config) {
        setTestResults(prev => ({ ...prev, embeddings: true }))
      }
      if (chatData.config) {
        setTestResults(prev => ({ ...prev, chat: true }))
      }
      if (textGenData.config) {
        setTestResults(prev => ({ ...prev, textGeneration: true }))
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
    const res = await fetch(`/api/setup/ai/${fn}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(fnConfig),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to save')
    }
    // Mark as tested and refresh config
    setTestResults(prev => ({ ...prev, [fn]: true }))
    fetchConfig()
  }

  const handleContinue = () => {
    // Go to the complete step
    goToStep('complete')
  }

  // All 3 AI functions are required
  const hasEmbeddings = config?.embeddings?.provider && config?.embeddings?.model
  const hasChat = config?.chat?.provider && config?.chat?.model
  const hasTextGen = config?.textGeneration?.provider && config?.textGeneration?.model
  const canContinue = hasEmbeddings && hasChat && hasTextGen
  
  const missingConfigs: string[] = []
  if (!hasEmbeddings) missingConfigs.push('Embeddings')
  if (!hasChat) missingConfigs.push('Chat Assistant')
  if (!hasTextGen) missingConfigs.push('Text Generation')

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    )
  }

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

      {/* All AI Functions - each on its own row */}
      <Box display="flex" flexDirection="column" gap={2} mb={3}>
        <AIFunctionCard
          functionType="embeddings"
          title="Embeddings"
          description="Required for semantic search and AI recommendations. Generates vector representations of your media library."
          icon={<MemoryIcon />}
          iconColor="#2196f3"
          config={config?.embeddings ?? null}
          onSave={(c) => handleSave('embeddings', c)}
          requiredCapability="embeddings"
          compact
          isSetup
        />

        <AIFunctionCard
          functionType="chat"
          title="Chat Assistant"
          description="Powers the AI assistant for conversational interactions about your library."
          icon={<SmartToyIcon />}
          iconColor="#9c27b0"
          config={config?.chat ?? null}
          onSave={(c) => handleSave('chat', c)}
          requiredCapability="toolCalling"
          compact
          isSetup
        />

        <AIFunctionCard
          functionType="textGeneration"
          title="Text Generation"
          description="Generates recommendation explanations, taste profiles, and summaries."
          icon={<AutoFixHighIcon />}
          iconColor="#ff9800"
          config={config?.textGeneration ?? null}
          onSave={(c) => handleSave('textGeneration', c)}
          compact
          isSetup
        />
      </Box>

      {!canContinue && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          <Typography variant="body2">
            You must configure and test <strong>{missingConfigs.join(', ')}</strong> to continue.
          </Typography>
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button variant="outlined" onClick={() => goToStep('topPicks')}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={handleContinue}
          disabled={saving || !canContinue}
        >
          {saving ? <CircularProgress size={20} /> : 'Continue'}
        </Button>
      </Box>
    </Box>
  )
}
