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
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
        {t('setup.validate.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {t('setup.validate.subtitle')}
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
                        {t('setup.validate.errorPrefix')} {check.error}
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
              <ListItemText primary={t('setup.validate.running')} />
            </ListItem>
          )}
        </List>
      </Paper>

      {/* Status Summary */}
      {hasResults && (
        <Alert severity={allPassed ? 'success' : 'error'} sx={{ mb: 3 }}>
          {allPassed ? (
            <Typography variant="body2">{t('setup.validate.allPassed')}</Typography>
          ) : (
            <Typography variant="body2">{t('setup.validate.someFailed')}</Typography>
          )}
        </Alert>
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button variant="outlined" onClick={() => goToStep('aiRecsLibraries')}>
          {t('setup.validate.back')}
        </Button>
        <Button
          variant="outlined"
          onClick={runValidation}
          disabled={validating}
          startIcon={validating ? <CircularProgress size={16} /> : <RefreshIcon />}
        >
          {validating ? t('setup.validate.checking') : t('setup.validate.retry')}
        </Button>
        <Button
          variant="contained"
          onClick={handleContinue}
          disabled={!allPassed || validating}
        >
          {t('setup.validate.continue')}
        </Button>
      </Box>
    </Box>
  )
}

