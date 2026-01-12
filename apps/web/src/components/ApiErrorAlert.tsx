/**
 * ApiErrorAlert Component
 * 
 * Displays user-friendly alerts for API errors (rate limits, auth failures, outages)
 * from external integrations (OpenAI, MDBList, TMDb, OMDb, Trakt).
 * 
 * Features:
 * - Color-coded by severity (error/warning/info)
 * - Action buttons with links to resolve issues
 * - Dismissible with per-provider dismissal
 * - Shows reset time for rate limits when available
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Collapse,
  IconButton,
  Link,
  Stack,
  Typography,
  Chip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ErrorIcon from '@mui/icons-material/Error'
import InfoIcon from '@mui/icons-material/Info'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

interface ApiError {
  id: string
  provider: 'openai' | 'tmdb' | 'trakt' | 'mdblist' | 'omdb'
  errorType: 'rate_limit' | 'auth' | 'limit' | 'outage'
  errorCode?: string
  httpStatus: number
  message: string
  resetAt?: string
  actionUrl?: string
  createdAt: string
}

interface ErrorSummaryItem {
  provider: string
  activeCount: number
  latestErrorType: string | null
}

interface ApiErrorAlertProps {
  /** Show only errors for a specific provider */
  provider?: 'openai' | 'tmdb' | 'trakt' | 'mdblist' | 'omdb'
  /** Maximum number of errors to display */
  maxErrors?: number
  /** Compact mode for smaller displays */
  compact?: boolean
}

// Provider display names
const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  tmdb: 'TMDb',
  trakt: 'Trakt',
  mdblist: 'MDBList',
  omdb: 'OMDb',
}

// Error type to severity mapping
const ERROR_SEVERITY: Record<string, 'error' | 'warning' | 'info'> = {
  auth: 'error',
  rate_limit: 'warning',
  limit: 'warning',
  outage: 'info',
}

// Error type to icon mapping
const ERROR_ICONS: Record<string, React.ReactNode> = {
  auth: <ErrorIcon />,
  rate_limit: <WarningAmberIcon />,
  limit: <WarningAmberIcon />,
  outage: <InfoIcon />,
}

// Error type display names
const ERROR_TYPE_NAMES: Record<string, string> = {
  auth: 'Authentication Error',
  rate_limit: 'Rate Limit Reached',
  limit: 'Account Limit Reached',
  outage: 'Service Unavailable',
}

/**
 * Format reset time for display
 */
function formatResetTime(resetAt: string): string {
  const resetDate = new Date(resetAt)
  const now = new Date()
  const diffMs = resetDate.getTime() - now.getTime()
  
  if (diffMs <= 0) {
    return 'should reset now'
  }
  
  const diffMins = Math.ceil(diffMs / 60000)
  if (diffMins < 60) {
    return `resets in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`
  }
  
  const diffHours = Math.ceil(diffMins / 60)
  if (diffHours < 24) {
    return `resets in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`
  }
  
  return `resets at ${resetDate.toLocaleString()}`
}

export function ApiErrorAlert({
  provider,
  maxErrors = 3,
  compact = false,
}: ApiErrorAlertProps) {
  const [errors, setErrors] = useState<ApiError[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // Fetch active errors
  const fetchErrors = useCallback(async () => {
    try {
      const endpoint = provider ? `/api/errors/${provider}` : '/api/errors'
      const response = await fetch(endpoint, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setErrors(data.errors || [])
      }
    } catch (err) {
      console.error('Failed to fetch API errors:', err)
    } finally {
      setLoading(false)
    }
  }, [provider])

  useEffect(() => {
    fetchErrors()
    // Refresh every minute
    const interval = setInterval(fetchErrors, 60000)
    return () => clearInterval(interval)
  }, [fetchErrors])

  // Handle dismiss
  const handleDismiss = useCallback(async (errorId: string) => {
    setDismissedIds((prev) => new Set(prev).add(errorId))
    try {
      await fetch(`/api/errors/${errorId}/dismiss`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (err) {
      console.error('Failed to dismiss error:', err)
    }
  }, [])

  // Filter out dismissed errors and limit count
  const visibleErrors = errors
    .filter((error: ApiError) => !dismissedIds.has(error.id))
    .slice(0, maxErrors)

  if (loading || visibleErrors.length === 0) {
    return null
  }

  return (
    <Stack spacing={1}>
      {visibleErrors.map((error: ApiError) => (
        <Collapse key={error.id} in={!dismissedIds.has(error.id)}>
          <Alert
            severity={ERROR_SEVERITY[error.errorType] || 'warning'}
            icon={ERROR_ICONS[error.errorType]}
            action={
              <IconButton
                aria-label="dismiss"
                color="inherit"
                size="small"
                onClick={() => handleDismiss(error.id)}
              >
                <CloseIcon fontSize="inherit" />
              </IconButton>
            }
            sx={{ 
              alignItems: 'flex-start',
              '& .MuiAlert-message': { width: '100%' },
            }}
          >
            <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>{PROVIDER_NAMES[error.provider]}</span>
              <Chip
                label={ERROR_TYPE_NAMES[error.errorType]}
                size="small"
                color={ERROR_SEVERITY[error.errorType]}
                sx={{ fontSize: '0.7rem', height: 20 }}
              />
            </AlertTitle>

            <Typography variant="body2" sx={{ mb: 1 }}>
              {error.message}
            </Typography>

            {!compact && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                {error.resetAt && (
                  <Typography variant="caption" color="text.secondary">
                    ⏱️ {formatResetTime(error.resetAt)}
                  </Typography>
                )}

                {error.actionUrl && (
                  error.actionUrl.startsWith('/') ? (
                    <Button
                      size="small"
                      variant="outlined"
                      color={ERROR_SEVERITY[error.errorType]}
                      onClick={() => (window.location.href = error.actionUrl!)}
                      sx={{ ml: 'auto' }}
                    >
                      {error.errorType === 'auth' ? 'Check Settings' : 'Learn More'}
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      color={ERROR_SEVERITY[error.errorType]}
                      href={error.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      endIcon={<OpenInNewIcon fontSize="small" />}
                      sx={{ ml: 'auto' }}
                    >
                      {error.errorType === 'auth'
                        ? 'Check Settings'
                        : error.errorType === 'limit'
                        ? 'Upgrade'
                        : 'Learn More'}
                    </Button>
                  )
                )}
              </Box>
            )}
          </Alert>
        </Collapse>
      ))}

      {errors.length > maxErrors && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          +{errors.length - maxErrors} more{' '}
          <Link href="/settings#integrations" underline="hover">
            View all in settings
          </Link>
        </Typography>
      )}
    </Stack>
  )
}

/**
 * Compact version for use in headers/toolbars
 */
export function ApiErrorIndicator() {
  const [summary, setSummary] = useState<ErrorSummaryItem[]>([])

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch('/api/errors/summary', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setSummary(data.summary || [])
        }
      } catch (err) {
        console.error('Failed to fetch error summary:', err)
      }
    }

    fetchSummary()
    const interval = setInterval(fetchSummary, 60000)
    return () => clearInterval(interval)
  }, [])

  const totalErrors = summary.reduce((sum: number, s: ErrorSummaryItem) => sum + s.activeCount, 0)

  if (totalErrors === 0) {
    return null
  }

  // Determine worst severity
  const hasAuthError = summary.some((s: ErrorSummaryItem) => s.latestErrorType === 'auth')
  const hasRateLimitError = summary.some(
    (s: ErrorSummaryItem) => s.latestErrorType === 'rate_limit' || s.latestErrorType === 'limit'
  )

  const severity = hasAuthError ? 'error' : hasRateLimitError ? 'warning' : 'info'
  const color = severity === 'error' ? 'error.main' : severity === 'warning' ? 'warning.main' : 'info.main'

  return (
    <Chip
      icon={hasAuthError ? <ErrorIcon /> : <WarningAmberIcon />}
      label={`${totalErrors} API ${totalErrors === 1 ? 'issue' : 'issues'}`}
      size="small"
      color={severity}
      variant="outlined"
      onClick={() => (window.location.href = '/settings#integrations')}
      sx={{
        cursor: 'pointer',
        borderColor: color,
        '& .MuiChip-icon': { color },
      }}
    />
  )
}

export default ApiErrorAlert
