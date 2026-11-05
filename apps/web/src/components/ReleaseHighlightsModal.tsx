import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'

export const RELEASE_HIGHLIGHTS_VERSION = '0.8.0'

const adminTopics = ['encore', 'connections', 'curation', 'trust'] as const
const userTopics = ['encore', 'memory', 'planning', 'collections'] as const

export function ReleaseHighlightsModal({
  isAdmin,
  onDismiss,
}: {
  isAdmin: boolean
  onDismiss: () => Promise<void>
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const audience = isAdmin ? 'admin' : 'user'
  const topics = isAdmin ? adminTopics : userTopics

  async function dismiss(destination?: string) {
    setSaving(true)
    setError(false)
    try {
      await onDismiss()
      if (destination) navigate(destination)
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      aria-labelledby="release-highlights-title"
      onClose={saving ? undefined : () => void dismiss()}
    >
      <DialogTitle id="release-highlights-title">{t(`releaseHighlights.${audience}.title`)}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {topics.map((topic) => (
            <div key={topic}>
              <Typography variant="subtitle2">{t(`releaseHighlights.${audience}.${topic}.title`)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t(`releaseHighlights.${audience}.${topic}.body`)}
              </Typography>
            </div>
          ))}
          {error && <Alert severity="error">{t('releaseHighlights.saveError')}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={() => void dismiss()}>{t('common.dismiss')}</Button>
        <Button
          variant="contained"
          disabled={saving}
          onClick={() => void dismiss('/recommendations')}
        >
          {t(`releaseHighlights.${audience}.action`)}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
