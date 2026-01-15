import { Box, Card, CardContent, Stepper, Step, StepLabel, Typography, IconButton, Tooltip } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSetupWizard } from './hooks/useSetupWizard'
import { useSetupStatus } from '../../hooks/useSetupStatus'
import { STEP_ORDER } from './constants'
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

const APP_VERSION = '0.4.6'

export function SetupPage() {
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
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        backgroundImage: 'radial-gradient(circle at 50% 50%, #1a1a2e 0%, #0f0f0f 100%)',
        p: 2,
        position: 'relative',
      }}
    >
      {/* Persistent branding - top left */}
      <Box
        sx={{
          position: 'fixed',
          top: 24,
          left: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          zIndex: 10,
        }}
      >
        <Box
          component="img"
          src="/aperture.svg"
          alt="Aperture"
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
          Aperture
        </Typography>
      </Box>

      {/* Exit button for admin re-run - top right */}
      {isAdminRerun && (
        <Tooltip title="Exit Setup Wizard">
          <IconButton
            onClick={() => navigate(exitPath)}
            sx={{
              position: 'fixed',
              top: 20,
              right: 24,
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
          position: 'fixed',
          bottom: 16,
          left: 24,
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
        <CardContent sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
            {STEP_ORDER.map((s) => (
              <Step key={s.id}>
                <StepLabel>{s.label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {renderStepContent()}
        </CardContent>
      </Card>
    </Box>
  )
}

