import { Box, Button, Typography } from '@mui/material'
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material'
import type { SetupWizardContext } from '../types'

interface CompleteStepProps {
  wizard: SetupWizardContext
}

export function CompleteStep({ wizard }: CompleteStepProps) {
  const { handleCompleteSetup } = wizard

  return (
    <Box textAlign="center">
      <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
      <Typography variant="h5" gutterBottom>
        Finish Setup
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Clicking Finish will disable the public setup wizard.
      </Typography>
      <Button variant="contained" size="large" onClick={handleCompleteSetup} sx={{ mt: 2 }}>
        Finish
      </Button>
    </Box>
  )
}

