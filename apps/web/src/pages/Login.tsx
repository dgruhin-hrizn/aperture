import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material'
import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from 'react-i18next'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login, user, sessionError, clearSessionError } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [allowPasswordlessLogin, setAllowPasswordlessLogin] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)
  
  // Clear session error when user starts typing
  useEffect(() => {
    if ((username || password) && sessionError) {
      clearSessionError()
    }
  }, [username, password, sessionError, clearSessionError])

  // Fetch login options on mount
  useEffect(() => {
    const fetchLoginOptions = async () => {
      try {
        const response = await fetch('/api/auth/login-options')
        if (response.ok) {
          const data = await response.json()
          setAllowPasswordlessLogin(data.allowPasswordlessLogin)
        }
      } catch {
        // Default to requiring password if we can't fetch options
      } finally {
        setLoadingOptions(false)
      }
    }
    fetchLoginOptions()
  }, [])

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/')
    }
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  // Determine if submit should be disabled
  const isSubmitDisabled = loading || !username || (!allowPasswordlessLogin && !password)

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        backgroundImage: 'radial-gradient(circle at 50% 50%, #1a1a2e 0%, #0f0f0f 100%)',
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 400,
          mx: 2,
          backgroundColor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box textAlign="center" mb={4}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1,
              }}
            >
              {t('common.appName')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('login.subtitle')}
            </Typography>
          </Box>

          {sessionError && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              {sessionError}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label={t('login.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              autoComplete="username"
              autoFocus
              disabled={loading || loadingOptions}
            />

            <TextField
              fullWidth
              label={allowPasswordlessLogin ? t('login.passwordOptional') : t('login.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              autoComplete="current-password"
              disabled={loading || loadingOptions}
              helperText={allowPasswordlessLogin ? t('login.passwordOptionalHelp') : undefined}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isSubmitDisabled || loadingOptions}
              sx={{ mt: 3 }}
            >
              {loading || loadingOptions ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                t('login.signIn')
              )}
            </Button>
          </form>

          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            textAlign="center"
            mt={3}
          >
            {t('login.footerProviders')}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
