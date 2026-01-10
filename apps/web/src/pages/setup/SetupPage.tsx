import { Box, Card, CardContent, Stepper, Step, StepLabel } from '@mui/material'
import { useSetupWizard } from './hooks/useSetupWizard'
import { STEP_ORDER } from './constants'
import {
  MediaServerStep,
  LibrariesStep,
  AiRecsStep,
  UsersStep,
  TopPicksStep,
  OpenAIStep,
  InitialJobsStep,
  CompleteStep,
} from './components'

export function SetupPage() {
  const wizard = useSetupWizard()
  const { activeStep, stepId } = wizard

  const renderStepContent = () => {
    switch (stepId) {
      case 'mediaServer':
        return <MediaServerStep wizard={wizard} />
      case 'mediaLibraries':
        return <LibrariesStep wizard={wizard} />
      case 'aiRecsLibraries':
        return <AiRecsStep wizard={wizard} />
      case 'users':
        return <UsersStep wizard={wizard} />
      case 'topPicks':
        return <TopPicksStep wizard={wizard} />
      case 'openai':
        return <OpenAIStep wizard={wizard} />
      case 'initialJobs':
        return <InitialJobsStep wizard={wizard} />
      case 'complete':
        return <CompleteStep wizard={wizard} />
      default:
        return <MediaServerStep wizard={wizard} />
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
      }}
    >
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

