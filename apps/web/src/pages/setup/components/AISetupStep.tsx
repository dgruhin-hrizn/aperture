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
  Chip,
  Divider,
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

  // Fetch current AI config
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/ai', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setConfig(data.config)
        // If config exists, mark as tested
        if (data.config?.embeddings) {
          setTestResults(prev => ({ ...prev, embeddings: true }))
        }
        if (data.config?.chat) {
          setTestResults(prev => ({ ...prev, chat: true }))
        }
        if (data.config?.textGeneration) {
          setTestResults(prev => ({ ...prev, textGeneration: true }))
        }
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
    // Mark as tested and refresh config
    setTestResults(prev => ({ ...prev, [fn]: true }))
    fetchConfig()
  }

  const handleContinue = () => {
    // Go to the complete step
    goToStep('complete')
  }

  // Check if at least embeddings is configured
  const hasEmbeddings = config?.embeddings?.provider && config?.embeddings?.model
  const canContinue = hasEmbeddings

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

      {/* Required: Embeddings */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            REQUIRED
          </Typography>
          <Chip label="Must configure to continue" size="small" color="primary" variant="outlined" />
        </Box>
        
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
        />
      </Box>

      <Divider sx={{ my: 3 }}>
        <Chip label="Optional" size="small" variant="outlined" />
      </Divider>

      {/* Optional: Chat & Text Generation */}
      <Box 
        display="grid" 
        gridTemplateColumns={{ xs: '1fr', md: 'repeat(2, 1fr)' }} 
        gap={2}
        mb={3}
      >
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
        />
      </Box>

      {!canContinue && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          <Typography variant="body2">
            You must configure and save <strong>Embeddings</strong> to continue. This is required for AI recommendations.
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
