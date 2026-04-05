import React, { useState, useEffect, useMemo } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  FormControlLabel,
  Checkbox,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  useTheme,
  alpha,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import MovieFilterIcon from '@mui/icons-material/MovieFilter'
import PsychologyIcon from '@mui/icons-material/Psychology'
import RecommendIcon from '@mui/icons-material/Recommend'
import HistoryIcon from '@mui/icons-material/History'
import TuneIcon from '@mui/icons-material/Tune'

const STORAGE_KEY = 'aperture-welcome-dismissed'

interface WelcomeModalProps {
  open?: boolean
  onClose?: () => void
}

export function WelcomeModal({ open: controlledOpen, onClose }: WelcomeModalProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const [internalOpen, setInternalOpen] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [activeStep, setActiveStep] = useState(0)

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  useEffect(() => {
    if (!isControlled) {
      const dismissed = localStorage.getItem(STORAGE_KEY)
      if (!dismissed) {
        setInternalOpen(true)
      }
    }
  }, [isControlled])

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    if (isControlled) {
      onClose?.()
    } else {
      setInternalOpen(false)
    }
  }

  const handleNext = () => {
    setActiveStep((prev) => prev + 1)
  }

  const handleBack = () => {
    setActiveStep((prev) => prev - 1)
  }

  const steps = useMemo(
    () => [
      {
        label: t('welcomeModal.stepWelcome'),
        icon: <AutoAwesomeIcon />,
        content: (
          <Box>
            <Typography paragraph>
              <Trans i18nKey="welcomeModal.stepWelcomeP1" components={{ 0: <strong /> }} />
            </Typography>
            <Typography paragraph color="text.secondary">
              {t('welcomeModal.stepWelcomeP2')}
            </Typography>
          </Box>
        ),
      },
      {
        label: t('welcomeModal.stepHowAi'),
        icon: <PsychologyIcon />,
        content: (
          <Box>
            <Typography paragraph>
              <Trans i18nKey="welcomeModal.stepHowAiP1" components={{ 0: <strong /> }} />
            </Typography>
            <Box component="ul" sx={{ pl: 2, '& li': { mb: 1 } }}>
              <li>
                <Typography variant="body2">
                  <Trans i18nKey="welcomeModal.stepHowAiLi1" components={{ 0: <strong /> }} />
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <Trans i18nKey="welcomeModal.stepHowAiLi2" components={{ 0: <strong /> }} />
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <Trans i18nKey="welcomeModal.stepHowAiLi3" components={{ 0: <strong /> }} />
                </Typography>
              </li>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t('welcomeModal.stepHowAiP2')}
            </Typography>
          </Box>
        ),
      },
      {
        label: t('welcomeModal.stepScoring'),
        icon: <TuneIcon />,
        content: (
          <Box>
            <Typography paragraph>{t('welcomeModal.stepScoringP1')}</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Paper sx={{ p: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                <Typography variant="subtitle2" color="primary">
                  {t('welcomeModal.stepScoringTaste')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('welcomeModal.stepScoringTasteD')}
                </Typography>
              </Paper>
              <Paper sx={{ p: 1.5, bgcolor: alpha(theme.palette.secondary.main, 0.1) }}>
                <Typography variant="subtitle2" color="secondary">
                  {t('welcomeModal.stepScoringGenre')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('welcomeModal.stepScoringGenreD')}
                </Typography>
              </Paper>
              <Paper sx={{ p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                <Typography variant="subtitle2" color="success.main">
                  {t('welcomeModal.stepScoringCommunity')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('welcomeModal.stepScoringCommunityD')}
                </Typography>
              </Paper>
              <Paper sx={{ p: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                <Typography variant="subtitle2" color="warning.main">
                  {t('welcomeModal.stepScoringDiversity')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('welcomeModal.stepScoringDiversityD')}
                </Typography>
              </Paper>
            </Box>
          </Box>
        ),
      },
      {
        label: t('welcomeModal.stepSimilar'),
        icon: <MovieFilterIcon />,
        content: (
          <Box>
            <Typography paragraph>
              <Trans i18nKey="welcomeModal.stepSimilarP1" components={{ 0: <strong /> }} />
            </Typography>
            <Typography paragraph>{t('welcomeModal.stepSimilarP2')}</Typography>
            <Box component="ul" sx={{ pl: 2, '& li': { mb: 0.5 } }}>
              <li>
                <Typography variant="body2">{t('welcomeModal.stepSimilarLi1')}</Typography>
              </li>
              <li>
                <Typography variant="body2">{t('welcomeModal.stepSimilarLi2')}</Typography>
              </li>
              <li>
                <Typography variant="body2">{t('welcomeModal.stepSimilarLi3')}</Typography>
              </li>
              <li>
                <Typography variant="body2">{t('welcomeModal.stepSimilarLi4')}</Typography>
              </li>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t('welcomeModal.stepSimilarP3')}
            </Typography>
          </Box>
        ),
      },
      {
        label: t('welcomeModal.stepData'),
        icon: <HistoryIcon />,
        content: (
          <Box>
            <Typography paragraph>{t('welcomeModal.stepDataP1')}</Typography>
            <Box component="ul" sx={{ pl: 2, '& li': { mb: 1 } }}>
              <li>
                <Typography variant="body2">
                  <Trans i18nKey="welcomeModal.stepDataLi1" components={{ 0: <strong /> }} />
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <Trans i18nKey="welcomeModal.stepDataLi2" components={{ 0: <strong /> }} />
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <Trans i18nKey="welcomeModal.stepDataLi3" components={{ 0: <strong /> }} />
                </Typography>
              </li>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t('welcomeModal.stepDataP2')}
            </Typography>
          </Box>
        ),
      },
    ],
    [t, theme]
  )

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '85vh',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <AutoAwesomeIcon color="primary" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {t('welcomeModal.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('welcomeModal.subtitle')}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel
                StepIconProps={{
                  icon: step.icon,
                }}
                sx={{ cursor: 'pointer' }}
                onClick={() => setActiveStep(index)}
              >
                <Typography fontWeight={activeStep === index ? 600 : 400}>{step.label}</Typography>
              </StepLabel>
              <StepContent>
                <Box sx={{ py: 1 }}>{step.content}</Box>
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  {index > 0 && (
                    <Button onClick={handleBack} size="small">
                      {t('common.back')}
                    </Button>
                  )}
                  {index < steps.length - 1 && (
                    <Button variant="contained" onClick={handleNext} size="small">
                      {t('common.continue')}
                    </Button>
                  )}
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2">{t('common.dontShowAgain')}</Typography>}
        />
        <Button onClick={handleClose} variant="contained" startIcon={<RecommendIcon />}>
          {t('common.getStarted')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// Hook to manually trigger the welcome modal
export function useWelcomeModal() {
  const [open, setOpen] = useState(false)

  const showWelcome = () => setOpen(true)
  const hideWelcome = () => setOpen(false)
  const resetWelcome = () => {
    localStorage.removeItem(STORAGE_KEY)
    setOpen(true)
  }

  return { open, showWelcome, hideWelcome, resetWelcome }
}
