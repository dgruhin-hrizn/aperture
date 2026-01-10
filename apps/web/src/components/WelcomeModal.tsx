import React, { useState, useEffect } from 'react'
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

  const steps = [
    {
      label: 'Welcome to Aperture',
      icon: <AutoAwesomeIcon />,
      content: (
        <Box>
          <Typography paragraph>
            <strong>Aperture</strong> is your personal AI-powered movie recommendation engine that learns
            from your watch history to suggest films you'll love.
          </Typography>
          <Typography paragraph color="text.secondary">
            It integrates with your Emby or Jellyfin media server to understand your tastes and
            deliver personalized recommendations directly to your home screen.
          </Typography>
        </Box>
      ),
    },
    {
      label: 'How AI Recommendations Work',
      icon: <PsychologyIcon />,
      content: (
        <Box>
          <Typography paragraph>
            Aperture uses <strong>AI embeddings</strong> to understand movies at a deep level:
          </Typography>
          <Box component="ul" sx={{ pl: 2, '& li': { mb: 1 } }}>
            <li>
              <Typography variant="body2">
                <strong>Semantic Understanding:</strong> Each movie is converted into a 1,536-dimensional
                vector that captures its themes, tone, genre, and style.
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Taste Profile:</strong> Your watch history is analyzed to build a unique
                "taste fingerprint" based on what you've enjoyed.
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Vector Similarity:</strong> We find movies whose embeddings are mathematically
                closest to your taste profile.
              </Typography>
            </li>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This means recommendations go beyond simple genre matching — a psychological thriller
            fan might get suggestions for tense dramas with similar themes, even if they're not
            labeled as "thrillers."
          </Typography>
        </Box>
      ),
    },
    {
      label: 'Scoring Factors',
      icon: <TuneIcon />,
      content: (
        <Box>
          <Typography paragraph>
            Each recommended movie is scored using multiple factors:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Paper sx={{ p: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
              <Typography variant="subtitle2" color="primary">Taste Similarity (40%)</Typography>
              <Typography variant="body2" color="text.secondary">
                How closely the movie matches your overall taste profile
              </Typography>
            </Paper>
            <Paper sx={{ p: 1.5, bgcolor: alpha(theme.palette.secondary.main, 0.1) }}>
              <Typography variant="subtitle2" color="secondary">Genre Discovery (20%)</Typography>
              <Typography variant="body2" color="text.secondary">
                Rewards movies that introduce you to new genres while staying relevant
              </Typography>
            </Paper>
            <Paper sx={{ p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.1) }}>
              <Typography variant="subtitle2" color="success.main">Community Rating (20%)</Typography>
              <Typography variant="body2" color="text.secondary">
                Favors highly-rated films to ensure quality recommendations
              </Typography>
            </Paper>
            <Paper sx={{ p: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
              <Typography variant="subtitle2" color="warning.main">Result Diversity (20%)</Typography>
              <Typography variant="body2" color="text.secondary">
                Ensures variety so you don't get 50 superhero movies in a row
              </Typography>
            </Paper>
          </Box>
        </Box>
      ),
    },
    {
      label: 'Similar Movies',
      icon: <MovieFilterIcon />,
      content: (
        <Box>
          <Typography paragraph>
            When viewing a movie's detail page, you'll see <strong>"Similar Movies"</strong> powered
            by the same AI technology.
          </Typography>
          <Typography paragraph>
            These aren't just movies in the same genre — they're films with similar:
          </Typography>
          <Box component="ul" sx={{ pl: 2, '& li': { mb: 0.5 } }}>
            <li><Typography variant="body2">Themes and subject matter</Typography></li>
            <li><Typography variant="body2">Tone and atmosphere</Typography></li>
            <li><Typography variant="body2">Storytelling style</Typography></li>
            <li><Typography variant="body2">Character archetypes</Typography></li>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            So if you loved "Inception," you might see mind-bending films that share its cerebral
            nature, not just other Christopher Nolan movies.
          </Typography>
        </Box>
      ),
    },
    {
      label: 'Your Data',
      icon: <HistoryIcon />,
      content: (
        <Box>
          <Typography paragraph>
            Aperture syncs with your media server to understand your preferences:
          </Typography>
          <Box component="ul" sx={{ pl: 2, '& li': { mb: 1 } }}>
            <li>
              <Typography variant="body2">
                <strong>Watch History:</strong> Movies you've watched, including play counts and
                recency
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Favorites:</strong> Movies you've marked as favorites get extra weight
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Recency:</strong> Recent watches influence your taste profile more than
                older ones
              </Typography>
            </li>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            You can choose to include or exclude already-watched movies from your recommendations
            in your preferences.
          </Typography>
        </Box>
      ),
    },
  ]

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
              Welcome to Aperture
            </Typography>
            <Typography variant="body2" color="text.secondary">
              AI-Powered Movie Recommendations
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
                <Typography fontWeight={activeStep === index ? 600 : 400}>
                  {step.label}
                </Typography>
              </StepLabel>
              <StepContent>
                <Box sx={{ py: 1 }}>{step.content}</Box>
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  {index > 0 && (
                    <Button onClick={handleBack} size="small">
                      Back
                    </Button>
                  )}
                  {index < steps.length - 1 && (
                    <Button variant="contained" onClick={handleNext} size="small">
                      Continue
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
          label={<Typography variant="body2">Don't show this again</Typography>}
        />
        <Button onClick={handleClose} variant="contained" startIcon={<RecommendIcon />}>
          Get Started
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



