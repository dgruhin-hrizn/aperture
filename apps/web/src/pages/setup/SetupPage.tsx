import { Box, Card, CardContent, Stepper, Step, StepLabel, Typography, IconButton, LinearProgress, Tooltip } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSetupWizard } from './hooks/useSetupWizard'
import { useSetupStatus } from '../../hooks/useSetupStatus'
import { useTranslation } from 'react-i18next'
import { STEP_ORDER_IDS } from './constants'
import { APP_VERSION } from '@/version'
import {
  RestoreStep,
  MediaServerStep,
  LibrariesStep,
  FileLocationsStep,
  AiRecsStep,
  ValidateStep,
  UsersStep,
  TopPicksStep,
  AISetupStep,
  InitialJobsStep,
  CompleteStep,
} from './components'

export function SetupPage() {
  const { t } = useTranslation()
  const wizard = useSetupWizard()
  const { status } = useSetupStatus()
  const navigate = useNavigate()
  const location = useLocation()
  const { activeStep, stepId } = wizard

  // Show exit button only when admin is re-running setup (not during initial setup)
  const isAdminRerun = status && !status.needsSetup && status.isAdmin

  // Get the origin path from location state, default to admin settings
  const exitPath = (location.state as { from?: string })?.from || '/admin/settings'

  const renderStepContent = () => {
    switch (stepId) {
      case 'restoreFromBackup':
        return <RestoreStep wizard={wizard} />
      case 'mediaServer':
        return <MediaServerStep wizard={wizard} />
      case 'mediaLibraries':
        return <LibrariesStep wizard={wizard} />
      case 'fileLocations':
        return <FileLocationsStep wizard={wizard} />
      case 'aiRecsLibraries':
        return <AiRecsStep wizard={wizard} />
      case 'validate':
        return <ValidateStep wizard={wizard} />
      case 'users':
        return <UsersStep wizard={wizard} />
      case 'topPicks':
        return <TopPicksStep wizard={wizard} />
      case 'aiSetup':
        return <AISetupStep wizard={wizard} />
      case 'initialJobs':
        return <InitialJobsStep wizard={wizard} />
      case 'complete':
        return <CompleteStep wizard={wizard} />
      default:
        return <RestoreStep wizard={wizard} />
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: 'center',
        justifyContent: { xs: 'flex-start', sm: 'center' },
        gap: { xs: 1, sm: 0 },
        backgroundColor: 'background.default',
        backgroundImage: 'var(--ap-backdrop-fallback, radial-gradient(circle at 50% 50%, #1a1a2e 0%, #0f0f0f 100%))',
        p: { xs: 1.5, sm: 2 },
        paddingTop: { xs: 'max(12px, env(safe-area-inset-top, 0px))', sm: 2 },
        position: 'relative',
      }}
    >
      {/* Persistent branding - top left */}
      <Box
        sx={{
          position: { xs: 'static', sm: 'fixed' },
          alignSelf: { xs: 'flex-start', sm: 'auto' },
          top: 24,
          insetInlineStart: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          zIndex: 10,
        }}
      >
        <Box
          component="img"
          src="/aperture.svg"
          alt={t('setup.page.altLogo')}
          sx={{ width: 32, height: 32 }}
        />
        <Typography
          sx={{
            fontFamily: '"Open Sans", sans-serif',
            fontWeight: 600,
            fontSize: '1.25rem',
            color: 'white',
            letterSpacing: '-0.01em',
          }}
        >
          {t('setup.page.brandName')}
        </Typography>
      </Box>

      {/* Exit button for admin re-run - top right */}
      {isAdminRerun && (
        <Tooltip title={t('setup.page.exitWizardTooltip')}>
          <IconButton
            onClick={() => navigate(exitPath)}
            sx={{
              position: { xs: 'absolute', sm: 'fixed' },
              top: { xs: 'env(safe-area-inset-top, 0px)', sm: 20 },
              insetInlineEnd: { xs: 8, sm: 24 },
              width: 44,
              height: 44,
              zIndex: 10,
              color: 'text.secondary',
              '&:hover': {
                color: 'text.primary',
                backgroundColor: 'action.hover',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Tooltip>
      )}

      {/* Version - bottom left */}
      <Typography
        variant="caption"
        sx={{
          position: { xs: 'static', sm: 'fixed' },
          order: { xs: 1, sm: 0 },
          bottom: 16,
          insetInlineStart: 24,
          color: 'text.secondary',
          opacity: 0.6,
          fontFamily: 'monospace',
          fontSize: '0.7rem',
        }}
      >
        v{APP_VERSION}
      </Typography>

      <Card
        sx={{
          width: '100%',
          maxWidth: { xs: '100%', sm: 600, md: 800, lg: 900 },
          backgroundColor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <CardContent sx={{ p: { xs: 1.5, sm: 3, md: 4 } }}>
          <Box sx={{ display: { xs: 'block', sm: 'none' }, mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle2">{t(`setup.step.${stepId}.label`)}</Typography>
              <Typography variant="caption" color="text.secondary">{activeStep + 1} / {STEP_ORDER_IDS.length}</Typography>
            </Box>
            <LinearProgress
              aria-label={t(`setup.step.${stepId}.label`)}
              variant="determinate"
              value={((activeStep + 1) / STEP_ORDER_IDS.length) * 100}
            />
          </Box>
          <Stepper activeStep={activeStep} sx={{ display: { xs: 'none', sm: 'flex' }, mb: 4 }} alternativeLabel>
            {STEP_ORDER_IDS.map((id) => (
              <Step key={id}>
                <StepLabel>{t(`setup.step.${id}.label`)}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {renderStepContent()}
        </CardContent>
      </Card>
    </Box>
  )
}

