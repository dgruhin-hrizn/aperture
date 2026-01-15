/**
 * AICapabilityBanner - Shows warnings when AI features are limited
 * 
 * Displays contextual warnings based on the current page/feature
 * and the configured AI providers' capabilities.
 */
import React from 'react'
import { Alert, AlertTitle, Box, Button, Typography, Collapse } from '@mui/material'
import { Warning as WarningIcon, Settings as SettingsIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useAICapabilities } from '../hooks/useAICapabilities'

type FeatureContext = 
  | 'chat'           // Chat assistant page
  | 'recommendations' // Recommendations page
  | 'search'         // Search/discover page
  | 'general'        // Generic context

interface AICapabilityBannerProps {
  context?: FeatureContext
  showWhenConfigured?: boolean  // Show even when properly configured (for debugging)
}

export function AICapabilityBanner({ 
  context = 'general',
  showWhenConfigured = false,
}: AICapabilityBannerProps) {
  const navigate = useNavigate()
  const { 
    features, 
    chat, 
    embeddings, 
    textGeneration,
    isLoading,
    isAnyConfigured,
  } = useAICapabilities()

  // Don't show while loading
  if (isLoading) return null

  // Build context-specific warnings
  const warnings: Array<{ title: string; message: string; severity: 'warning' | 'error' | 'info' }> = []

  if (context === 'chat') {
    if (!chat.configured) {
      warnings.push({
        title: 'Chat Not Configured',
        message: 'Configure an AI provider for the Chat function to use the assistant.',
        severity: 'error',
      })
    } else if (!chat.supportsTools) {
      warnings.push({
        title: 'Limited Chat Capabilities',
        message: `Your chat model (${chat.model}) doesn't support tool calling. The assistant will work as a basic chatbot without access to your library, search, or recommendations.`,
        severity: 'warning',
      })
    }
  }

  if (context === 'recommendations') {
    if (!embeddings.configured) {
      warnings.push({
        title: 'Embeddings Not Configured',
        message: 'Configure an embedding provider to enable AI-powered recommendations.',
        severity: 'error',
      })
    }
    if (!textGeneration.configured) {
      warnings.push({
        title: 'Text Generation Not Configured',
        message: 'Configure a text generation provider to enable recommendation explanations.',
        severity: 'warning',
      })
    }
  }

  if (context === 'search') {
    if (!embeddings.configured) {
      warnings.push({
        title: 'Semantic Search Unavailable',
        message: 'Configure an embedding provider to enable semantic search (searching by concept/theme).',
        severity: 'warning',
      })
    }
  }

  if (context === 'general' && !isAnyConfigured) {
    warnings.push({
      title: 'AI Not Configured',
      message: 'Configure AI providers in Settings to enable recommendations, chat, and other AI features.',
      severity: 'info',
    })
  }

  // Don't show anything if no warnings and not debugging
  if (warnings.length === 0 && !showWhenConfigured) {
    return null
  }

  // Show success state when debugging
  if (warnings.length === 0 && showWhenConfigured) {
    return (
      <Alert severity="success" sx={{ mb: 2 }}>
        <AlertTitle>AI Fully Configured</AlertTitle>
        All AI features are available with your current configuration.
      </Alert>
    )
  }

  return (
    <Box sx={{ mb: 2 }}>
      {warnings.map((warning, index) => (
        <Alert 
          key={index}
          severity={warning.severity}
          icon={<WarningIcon />}
          sx={{ mb: index < warnings.length - 1 ? 1 : 0 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<SettingsIcon />}
              onClick={() => navigate('/settings')}
            >
              Configure
            </Button>
          }
        >
          <AlertTitle>{warning.title}</AlertTitle>
          <Typography variant="body2">{warning.message}</Typography>
        </Alert>
      ))}
    </Box>
  )
}

/**
 * Inline capability check - for use in feature buttons/links
 */
interface FeatureGateProps {
  feature: keyof ReturnType<typeof useAICapabilities>['features']
  children: React.ReactNode
  fallback?: React.ReactNode
  showDisabled?: boolean  // Show children but disabled
}

export function FeatureGate({ 
  feature, 
  children, 
  fallback = null,
  showDisabled = false,
}: FeatureGateProps) {
  const { features, isLoading } = useAICapabilities()

  if (isLoading) return null

  const isAvailable = features[feature]

  if (isAvailable) {
    return <>{children}</>
  }

  if (showDisabled) {
    return (
      <Box sx={{ opacity: 0.5, pointerEvents: 'none' }}>
        {children}
      </Box>
    )
  }

  return <>{fallback}</>
}

