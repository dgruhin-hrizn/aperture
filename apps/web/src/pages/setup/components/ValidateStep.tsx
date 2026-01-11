import { useEffect } from 'react'
import {
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import RefreshIcon from '@mui/icons-material/Refresh'
import type { SetupWizardContext, ValidationCheck } from '../types'

interface ValidateStepProps {
  wizard: SetupWizardContext
}

function CheckIcon({ status }: { status: ValidationCheck['status'] }) {
  switch (status) {
    case 'passed':
      return <CheckCircleIcon color="success" />
    case 'failed':
      return <ErrorIcon color="error" />
    case 'running':
      return <CircularProgress size={24} />
    default:
      return <HourglassEmptyIcon color="disabled" />
  }
}

export function ValidateStep({ wizard }: ValidateStepProps) {
  const {
    validationResult,
    validating,
    runValidation,
    goToStep,
    updateProgress,
  } = wizard

  // Run validation when component mounts
  useEffect(() => {
    if (!validationResult && !validating) {
      runValidation()
    }
  }, [validationResult, validating, runValidation])

  const handleContinue = async () => {
    await updateProgress({ completedStep: 'validate' })
    goToStep('users')
  }

  const allPassed = validationResult?.allPassed ?? false
  const hasResults = validationResult !== null

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Validate Setup
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Checking that Aperture can access all required paths and your media server is reachable.
      </Typography>

      {/* Validation Results */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <List disablePadding>
          {validationResult?.checks.map((check, index) => (
            <ListItem
              key={check.id}
              divider={index < validationResult.checks.length - 1}
              sx={{
                backgroundColor: check.status === 'failed' ? 'error.dark' : 'transparent',
                opacity: check.status === 'failed' ? 0.9 : 1,
              }}
            >
              <ListItemIcon>
                <CheckIcon status={check.status} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body1" fontWeight={500}>
                    {check.name}
                  </Typography>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {check.description}
                    </Typography>
                    {check.status === 'failed' && check.error && (
                      <Typography variant="body2" color="error.light" sx={{ mt: 0.5 }}>
                        Error: {check.error}
                      </Typography>
                    )}
                    {check.status === 'failed' && check.suggestion && (
                      <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
                        <Typography variant="body2">{check.suggestion}</Typography>
                      </Alert>
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}

          {!hasResults && validating && (
            <ListItem>
              <ListItemIcon>
                <CircularProgress size={24} />
              </ListItemIcon>
              <ListItemText primary="Running validation checks..." />
            </ListItem>
          )}
        </List>
      </Paper>

      {/* Status Summary */}
      {hasResults && (
        <Alert severity={allPassed ? 'success' : 'error'} sx={{ mb: 3 }}>
          {allPassed ? (
            <Typography variant="body2">
              All checks passed! Your setup is ready to go.
            </Typography>
          ) : (
            <Typography variant="body2">
              Some checks failed. Please fix the issues above and retry, or check your docker-compose.yml
              volume mounts.
            </Typography>
          )}
        </Alert>
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button variant="outlined" onClick={() => goToStep('aiRecsLibraries')}>
          Back
        </Button>
        <Button
          variant="outlined"
          onClick={runValidation}
          disabled={validating}
          startIcon={validating ? <CircularProgress size={16} /> : <RefreshIcon />}
        >
          {validating ? 'Checking...' : 'Retry'}
        </Button>
        <Button
          variant="contained"
          onClick={handleContinue}
          disabled={!allPassed || validating}
        >
          Continue
        </Button>
      </Box>
    </Box>
  )
}

