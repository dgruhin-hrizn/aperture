import { useId, useState, type FormEvent } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { assistantRequest } from '../hooks/useConversations'
import { WorkbenchResult } from '../WorkbenchResult'
import type { ContentItem } from './types'

export function ContentRatingDialog({
  title,
  value,
  save,
  onClose,
}: {
  title: string
  value: number | null
  save: (rating: number | null) => Promise<void>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const headingId = useId()
  const [rating, setRating] = useState(String(value ?? ''))
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setFailed(false)
    try {
      await save(rating ? Number(rating) : null)
      onClose()
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby={headingId}
    >
      <form onSubmit={submit}>
        <DialogTitle id={headingId}>{t('browse.listItem.yourRating')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>{title}</Typography>
          <TextField
            select
            autoFocus
            fullWidth
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            disabled={busy}
            label={t('browse.listItem.yourRating')}
            slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
          >
            <MenuItem value="">{t('assistantToolUi.unrated')}</MenuItem>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
              <MenuItem key={score} value={String(score)}>
                {score} / 10
              </MenuItem>
            ))}
          </TextField>
          {failed && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {t('assistantToolUi.ratingSaveFailed')}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || rating === String(value ?? '')}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export function ContentPlaylistDialog({
  item,
  onClose,
}: {
  item: ContentItem
  onClose: () => void
}) {
  const { t } = useTranslation()
  const headingId = useId()
  const [name, setName] = useState(item.name.slice(0, 100))
  const [proposal, setProposal] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    setError('')
    try {
      const result = await assistantRequest<Record<string, unknown>>(
        '/api/assistant/workbench/proposePlaylist',
        {
          method: 'POST',
          body: JSON.stringify({
            operation: 'create',
            name,
            items: [{ id: item.id, type: 'movie' }],
          }),
        }
      )
      setProposal(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('encore.toolFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby={headingId}
    >
      <DialogTitle id={headingId}>{t('encore.actionOperations.create')}</DialogTitle>
      {proposal ? (
        <>
          <DialogContent>
            <WorkbenchResult data={proposal} />
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>{t('common.close')}</Button>
          </DialogActions>
        </>
      ) : (
        <form onSubmit={submit}>
          <DialogContent>
            <Typography sx={{ mb: 2 }}>{item.name}</Typography>
            <TextField
              autoFocus
              fullWidth
              required
              label={t('playlists.playlistName')}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 100 } }}
            />
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={busy || !name.trim()}>
              {t('assistantToolUi.reviewPlaylist')}
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  )
}
