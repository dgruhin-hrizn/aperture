import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CloseIcon from '@mui/icons-material/Close'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import VideoLibraryOutlinedIcon from '@mui/icons-material/VideoLibraryOutlined'

const steps = [
  { id: 'library', icon: VideoLibraryOutlinedIcon, path: '/browse' },
  { id: 'picks', icon: FavoriteBorderIcon, path: '/recommendations' },
  { id: 'encore', icon: AutoAwesomeOutlinedIcon, path: '/encore' },
  { id: 'settings', icon: TuneOutlinedIcon, path: '/settings?tab=preferences#appearance' },
] as const

interface WelcomeModalProps {
  dismissed: boolean
  onDismiss: (signal: AbortSignal) => Promise<void>
  onClose: (path?: string) => void
}

export function WelcomeModal({ dismissed, onDismiss, onClose }: WelcomeModalProps) {
  const { t } = useTranslation()
  const [activeStep, setActiveStep] = useState(0)
  const [remember, setRemember] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const pendingSave = useRef<AbortController | null>(null)
  const content = useRef<HTMLDivElement>(null)
  const errorAlert = useRef<HTMLDivElement>(null)
  const step = steps[activeStep]
  const StepIcon = step.icon
  const lastStep = activeStep === steps.length - 1
  const key = `welcomeModal.tour.steps.${step.id}` as const
  const progress = t('welcomeModal.tour.progress', { current: activeStep + 1, total: steps.length })

  useEffect(() => () => pendingSave.current?.abort(), [])
  useEffect(() => {
    if (content.current) content.current.scrollTop = 0
  }, [activeStep])
  useEffect(() => {
    if (saveError) errorAlert.current?.scrollIntoView({ block: 'nearest' })
  }, [saveError])

  async function finish(path?: string) {
    if (pendingSave.current) return
    if (!remember || dismissed) {
      onClose(path)
      return
    }

    const controller = new AbortController()
    pendingSave.current = controller
    setSaving(true)
    setSaveError(false)
    try {
      await onDismiss(controller.signal)
    } catch {
      if (!controller.signal.aborted) setSaveError(true)
      return
    } finally {
      if (!controller.signal.aborted) {
        pendingSave.current = null
        setSaving(false)
      }
    }
    if (!controller.signal.aborted) onClose(path)
  }

  return (
    <Dialog
      open
      onClose={() => void finish()}
      aria-labelledby="welcome-tour-title"
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: { sx: { borderRadius: { xs: 2, sm: 3 } } },
      }}
    >
      <DialogTitle component="div" sx={{ px: { xs: 1.5, sm: 3 }, pt: 1.5, pb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} useFlexGap>
          <Box component="img" src="/aperture.svg" alt="" width={30} height={30} />
          <Typography
            id="welcome-tour-title"
            component="h2"
            variant="subtitle1"
            fontWeight={700}
            flex={1}
          >
            {t('welcomeModal.title')}
          </Typography>
          <IconButton
            aria-label={t('common.close')}
            onClick={() => void finish()}
            disabled={saving}
            sx={{ width: 44, height: 44 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mt: 0.5, mb: 0.75 }}
        >
          {progress}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={((activeStep + 1) / steps.length) * 100}
          aria-label={t('welcomeModal.title')}
          aria-valuetext={progress}
          sx={{ height: 4, borderRadius: 2 }}
        />
      </DialogTitle>

      <DialogContent
        ref={content}
        dividers
        sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 1.5, sm: 2.5 } }}
      >
        <Stack spacing={{ xs: 1.5, sm: 2 }}>
          <Stack spacing={1} aria-live="polite" aria-atomic="true">
            <Stack direction="row" spacing={1} useFlexGap alignItems="center">
              <Box
                sx={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  bgcolor: 'action.selected',
                  color: 'primary.main',
                  borderRadius: 1.5,
                }}
              >
                <StepIcon fontSize="small" />
              </Box>
              <Typography
                component="h3"
                variant="h5"
                fontWeight={700}
                sx={{ fontSize: { xs: '1.15rem', sm: '1.4rem' } }}
              >
                {t(`${key}.title`)}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {t(`${key}.description`)}
            </Typography>
          </Stack>
          <Box sx={{ bgcolor: 'action.hover', p: 1.25, borderRadius: 1.5 }}>
            <Typography variant="subtitle2">{t('welcomeModal.tour.tryThis')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t(`${key}.example`)}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => void finish(step.path)}
            disabled={saving}
            sx={{ alignSelf: 'flex-start', minHeight: 44 }}
          >
            {t(`${key}.action`)}
          </Button>
          {lastStep && (
            <Typography variant="caption" color="text.secondary">
              {t('welcomeModal.tour.reopen')}
            </Typography>
          )}
          {saveError && (
            <Alert ref={errorAlert} severity="error">
              {t('welcomeModal.tour.saveFailed')}
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions
        disableSpacing
        sx={{
          px: { xs: 1.5, sm: 3 },
          py: 1,
          flexWrap: 'wrap',
          gap: 0.5,
          justifyContent: 'flex-start',
        }}
      >
        {!dismissed && (
          <FormControlLabel
            sx={{ m: 0, minHeight: 44, flex: { xs: '1 0 100%', sm: '1 1 220px' } }}
            control={
              <Checkbox
                checked={remember}
                onChange={(event) => {
                  setRemember(event.target.checked)
                  setSaveError(false)
                }}
                disabled={saving}
                size="small"
              />
            }
            label={<Typography variant="body2">{t('welcomeModal.tour.remember')}</Typography>}
          />
        )}
        <Stack direction="row" spacing={0.5} sx={{ marginInlineStart: 'auto' }}>
          {activeStep > 0 && (
            <Button
              onClick={() => setActiveStep(activeStep - 1)}
              disabled={saving}
              sx={{ minHeight: 44 }}
            >
              {t('common.back')}
            </Button>
          )}
          <Button
            variant="contained"
            disabled={saving}
            onClick={() => {
              if (lastStep) void finish()
              else setActiveStep(activeStep + 1)
            }}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ minHeight: 44 }}
          >
            {t(lastStep ? 'welcomeModal.tour.finish' : 'common.continue')}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}
