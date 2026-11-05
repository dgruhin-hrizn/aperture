import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  alpha,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from 'react-i18next'

export function LoginPage() {
  const { t } = useTranslation()
  const theme = useTheme()
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
  const loginInputSx = {
    '& .MuiInputLabel-root': {
      color: alpha(theme.palette.common.white, 0.66),
      '&.Mui-focused': {
        color: theme.palette.primary.light,
      },
      '&.Mui-disabled': {
        color: alpha(theme.palette.common.white, 0.34),
      },
    },
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      color: theme.palette.common.white,
      backgroundColor: alpha(theme.palette.common.black, 0.26),
      transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color']),
      '& fieldset': {
        borderColor: alpha(theme.palette.common.white, 0.18),
      },
      '&:hover fieldset': {
        borderColor: alpha(theme.palette.primary.light, 0.5),
      },
      '&.Mui-focused': {
        backgroundColor: alpha(theme.palette.common.black, 0.34),
        boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}`,
      },
      '&.Mui-focused fieldset': {
        borderColor: theme.palette.primary.light,
      },
      '&.Mui-disabled': {
        color: alpha(theme.palette.common.white, 0.42),
        backgroundColor: alpha(theme.palette.common.black, 0.16),
      },
      '&.Mui-disabled fieldset': {
        borderColor: alpha(theme.palette.common.white, 0.1),
      },
      '& input:-webkit-autofill': {
        WebkitBoxShadow: `0 0 0 100px ${alpha('#151522', 0.98)} inset`,
        WebkitTextFillColor: theme.palette.common.white,
        caretColor: theme.palette.common.white,
        borderRadius: 'inherit',
      },
    },
    '& .MuiFormHelperText-root': {
      color: alpha(theme.palette.common.white, 0.58),
    },
  } as const

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        px: 2,
        py: { xs: 2, sm: 4 },
        backgroundColor: '#09090f',
        backgroundImage: `
          radial-gradient(circle at 22% 18%, ${alpha(theme.palette.primary.main, 0.34)} 0%, transparent 32%),
          radial-gradient(circle at 78% 72%, ${alpha(theme.palette.secondary.main, 0.22)} 0%, transparent 34%),
          linear-gradient(135deg, #111122 0%, #0b0b12 46%, #050507 100%)
        `,
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(${alpha('#fff', 0.035)} 1px, transparent 1px),
            linear-gradient(90deg, ${alpha('#fff', 0.035)} 1px, transparent 1px)
          `,
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(circle at center, black 0%, transparent 72%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          width: 420,
          height: 420,
          borderRadius: '50%',
          bgcolor: alpha(theme.palette.primary.main, 0.16),
          filter: 'blur(70px)',
          transform: 'translate(-46%, -38%)',
          top: 0,
          left: 0,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 360,
          height: 360,
          borderRadius: '50%',
          bgcolor: alpha(theme.palette.secondary.main, 0.14),
          filter: 'blur(72px)',
          transform: 'translate(42%, 38%)',
          right: 0,
          bottom: 0,
        }}
      />

      <Card
        sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 440,
          backgroundColor: alpha(theme.palette.background.paper, 0.76),
          backdropFilter: 'blur(22px)',
          border: '1px solid',
          borderColor: alpha(theme.palette.common.white, 0.12),
          borderRadius: 4,
          boxShadow: `0 24px 80px ${alpha(theme.palette.common.black, 0.52)}`,
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 4.5 } }}>
          <Box textAlign="center" mb={{ xs: 2, sm: 4.5 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: { xs: 54, sm: 76 },
                height: { xs: 54, sm: 76 },
                mb: { xs: 1, sm: 2 },
                borderRadius: 3,
                background: `linear-gradient(145deg, ${alpha(theme.palette.common.white, 0.12)}, ${alpha(theme.palette.common.white, 0.02)})`,
                border: '1px solid',
                borderColor: alpha(theme.palette.common.white, 0.14),
                boxShadow: `0 16px 44px ${alpha(theme.palette.primary.main, 0.22)}`,
              }}
            >
              <Box
                component="img"
                src="/aperture.svg"
                alt="Aperture"
                sx={{ width: { xs: 34, sm: 46 }, height: { xs: 34, sm: 46 } }}
              />
            </Box>
            <Typography
              sx={{
                fontFamily: '"Open Sans", sans-serif',
                fontWeight: 600,
                fontSize: { xs: '2rem', sm: '2.35rem' },
                color: 'text.primary',
                letterSpacing: '-0.04em',
                lineHeight: 1,
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
              margin="dense"
              autoComplete="username"
              autoFocus
              disabled={loading || loadingOptions}
              sx={{
                mb: 2,
                ...loginInputSx,
              }}
            />

            <TextField
              fullWidth
              label={allowPasswordlessLogin ? t('login.passwordOptional') : t('login.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="dense"
              autoComplete="current-password"
              disabled={loading || loadingOptions}
              helperText={allowPasswordlessLogin ? t('login.passwordOptionalHelp') : undefined}
              sx={loginInputSx}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isSubmitDisabled || loadingOptions}
              sx={{
                mt: 3.5,
                py: 1.35,
                borderRadius: 2,
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: `0 14px 34px ${alpha(theme.palette.primary.main, 0.32)}`,
              }}
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
