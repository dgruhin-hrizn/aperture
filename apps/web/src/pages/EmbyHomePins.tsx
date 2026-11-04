import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Paper, Stack, Typography } from '@mui/material'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'

interface Shelf {
  playlistId: string
  name: string
  pinned: boolean
  canPin: boolean
}

const endpoint = '/api/recommendations/me/emby-home'

async function getShelves(signal?: AbortSignal): Promise<Shelf[]> {
  const response = await fetch(endpoint, { credentials: 'include', signal })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error)
  return result.shelves
}

export function EmbyHomePins() {
  const { t } = useTranslation()
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getShelves(controller.signal).then(setShelves).catch((err: unknown) => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '')
    })
    return () => controller.abort()
  }, [])

  async function toggle(shelf: Shelf) {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(shelf.playlistId)}`, {
        method: shelf.pinned ? 'DELETE' : 'PUT',
        credentials: 'include',
      })
      if (!response.ok) throw new Error((await response.json()).error)
      setShelves(await getShelves())
    } catch (err) {
      setError(err instanceof Error ? err.message : '')
    } finally {
      setSaving(false)
    }
  }

  if (!shelves.length && error === null) return null

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle1">{t('embyHomePins.title')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('embyHomePins.description')}</Typography>
        {error !== null && <Alert severity="warning">{error || t('embyHomePins.error')}</Alert>}
        {shelves.map((shelf) => (
          <Stack
            key={shelf.playlistId}
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <Typography variant="body2">{shelf.name}</Typography>
            {shelf.canPin || shelf.pinned ? (
              <Button
                variant="outlined"
                size="small"
                disabled={saving}
                startIcon={<PushPinOutlinedIcon />}
                onClick={() => void toggle(shelf)}
              >
                {t(shelf.pinned ? 'embyHomePins.unpin' : 'embyHomePins.pin')}
              </Button>
            ) : (
              <Typography variant="caption" color="text.secondary">{t('embyHomePins.manageInEmby')}</Typography>
            )}
          </Stack>
        ))}
      </Stack>
    </Paper>
  )
}
