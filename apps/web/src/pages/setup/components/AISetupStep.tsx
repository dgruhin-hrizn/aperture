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
  HubOutlined as HubOutlinedIcon,
} from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { AIFunctionCard, type FunctionConfig, type AIFunction } from '../../../components/AIFunctionCard'
import type { SetupWizardContext } from '../types'

interface AISetupStepProps {
  wizard: SetupWizardContext
}

interface AIConfig {
  embeddings: FunctionConfig | null
  chat: FunctionConfig | null
  textGeneration: FunctionConfig | null
  exploration: FunctionConfig | null
}

export function AISetupStep({ wizard }: AISetupStepProps) {
  const { t } = useTranslation()
  const { error, saving, goToStep } = wizard

  const [config, setConfig] = useState<AIConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [testResults, setTestResults] = useState<Record<AIFunction, boolean | null>>({
    embeddings: null,
    chat: null,
    textGeneration: null,
    exploration: null,
  })

  // Fetch current AI config from each function endpoint (setup-safe)
  const fetchConfig = useCallback(async () => {
    try {
      const [embeddingsRes, chatRes, textGenRes, explorationRes] = await Promise.all([
        fetch('/api/setup/ai/embeddings', { credentials: 'include' }),
        fetch('/api/setup/ai/chat', { credentials: 'include' }),
        fetch('/api/setup/ai/textGeneration', { credentials: 'include' }),
        fetch('/api/setup/ai/exploration', { credentials: 'include' }),
      ])

      const embeddingsData = embeddingsRes.ok ? await embeddingsRes.json() : { config: null }
      const chatData = chatRes.ok ? await chatRes.json() : { config: null }
      const textGenData = textGenRes.ok ? await textGenRes.json() : { config: null }
      const explorationData = explorationRes.ok ? await explorationRes.json() : { config: null }

      setConfig({
        embeddings: embeddingsData.config,
        chat: chatData.config,
        textGeneration: textGenData.config,
        exploration: explorationData.config,
      })

      // If config exists, mark as tested
      if (embeddingsData.config) {
        setTestResults((prev) => ({ ...prev, embeddings: true }))
      }
      if (chatData.config) {
        setTestResults((prev) => ({ ...prev, chat: true }))
      }
      if (textGenData.config) {
        setTestResults((prev) => ({ ...prev, textGeneration: true }))
      }
      if (explorationData.config) {
        setTestResults((prev) => ({ ...prev, exploration: true }))
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
      throw new Error(err.error || t('setup.aiSetup.saveFailed'))
    }
    // Mark as tested and refresh config
    setTestResults((prev) => ({ ...prev, [fn]: true }))
    fetchConfig()
  }

  const handleContinue = () => {
    goToStep('initialJobs')
  }

  // All 4 AI functions are required
  const hasEmbeddings = config?.embeddings?.provider && config?.embeddings?.model
  const hasChat = config?.chat?.provider && config?.chat?.model
  const hasTextGen = config?.textGeneration?.provider && config?.textGeneration?.model
  const hasExploration = config?.exploration?.provider && config?.exploration?.model
  const canContinue = hasEmbeddings && hasChat && hasTextGen && hasExploration

  const missingConfigs: string[] = []
  if (!hasEmbeddings) missingConfigs.push(t('setup.aiSetup.nameEmbeddings'))
  if (!hasChat) missingConfigs.push(t('setup.aiSetup.nameChat'))
  if (!hasTextGen) missingConfigs.push(t('setup.aiSetup.nameTextGen'))
  if (!hasExploration) missingConfigs.push(t('setup.aiSetup.nameExploration'))

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
        {t('setup.aiSetup.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {t('setup.aiSetup.bodyLead')}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        <strong>{t('setup.aiSetup.bodyBold')}</strong> {t('setup.aiSetup.bodyTail')}
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2" fontWeight={500} gutterBottom>
          {t('setup.aiSetup.needKeyTitle')}
        </Typography>
        <Typography variant="body2">
          {t('setup.aiSetup.needKeyBeforeLink')}{' '}
          <Link href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
            {t('setup.aiSetup.needKeyLink')}
            <OpenInNewIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle' }} />
          </Link>{' '}
          {t('setup.aiSetup.needKeyAfterLink')}
        </Typography>
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* All AI Functions - 2x2 grid */}
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(2, 1fr)' }} gap={2} mb={3}>
        <AIFunctionCard
          functionType="embeddings"
          title={t('setup.aiSetup.cardEmbeddingsTitle')}
          description={t('setup.aiSetup.cardEmbeddingsDesc')}
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
          title={t('setup.aiSetup.cardChatTitle')}
          description={t('setup.aiSetup.cardChatDesc')}
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
          title={t('setup.aiSetup.cardTextGenTitle')}
          description={t('setup.aiSetup.cardTextGenDesc')}
          icon={<AutoFixHighIcon />}
          iconColor="#ff9800"
          config={config?.textGeneration ?? null}
          onSave={(c) => handleSave('textGeneration', c)}
          compact
          isSetup
        />

        <AIFunctionCard
          functionType="exploration"
          title={t('setup.aiSetup.cardExplorationTitle')}
          description={t('setup.aiSetup.cardExplorationDesc')}
          icon={<HubOutlinedIcon />}
          iconColor="#4caf50"
          config={config?.exploration ?? null}
          onSave={(c) => handleSave('exploration', c)}
          compact
          isSetup
        />
      </Box>

      {!canContinue && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          <Typography variant="body2">
            {t('setup.aiSetup.missingConfigsPrefix')}{' '}
            <strong>{missingConfigs.join(', ')}</strong> {t('setup.aiSetup.missingConfigsSuffix')}
          </Typography>
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button variant="outlined" onClick={() => goToStep('topPicks')}>
          {t('setup.aiSetup.back')}
        </Button>
        <Button variant="contained" onClick={handleContinue} disabled={saving || !canContinue}>
          {saving ? <CircularProgress size={20} /> : t('setup.aiSetup.continue')}
        </Button>
      </Box>
    </Box>
  )
}
