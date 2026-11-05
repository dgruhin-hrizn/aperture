import { ToolCard, ToolCardHeading, ToolPreview } from './ToolCard'
import { useState } from 'react'
import { Box, Button, Chip, Stack, TextField, Typography } from '@mui/material'
import PlaylistAddCheckOutlinedIcon from '@mui/icons-material/PlaylistAddCheckOutlined'
import { useTranslation } from 'react-i18next'
import type { EncoreAction, EncoreCollection } from '@aperture/core/encore'
export function ActionCard({
  action,
  collection,
  busy,
  command,
  approve,
}: {
  action: EncoreAction
  collection?: EncoreCollection
  busy: boolean
  command: (name: string, input: unknown) => Promise<unknown>
  approve: (id: string) => Promise<unknown>
}) {
  const { t } = useTranslation(),
    [playlistUrl, setPlaylistUrl] = useState('')
  const retryable =
    ['failed', 'unknown', 'running'].includes(action.status) &&
    (action.operation !== 'create' || Boolean(collection?.provider_playlist_id))
  return (
    <ToolCard variant="outlined">
      <ToolCardHeading
        icon={<PlaylistAddCheckOutlinedIcon fontSize="small" />}
        title={collection?.name ?? t('encore.managedCollection')}
        status={
          <Chip
            size="small"
            color={action.status === 'succeeded' ? 'success' : 'default'}
            label={t(`encore.actionStatus.${action.status}`)}
          />
        }
      />
      <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
        {t(`encore.actionOperations.${action.operation}`)}
      </Typography>
      <ToolPreview limit={5}>
        {action.payload.preview?.map((item, index) => (
          <Typography variant="body2" key={`${item.providerId}-${index}`} sx={{ py: 0.4 }}>
            {item.title}
          </Typography>
        ))}
      </ToolPreview>
      {action.error && (
        <Typography role="alert" color="error" variant="body2" sx={{ my: 1 }}>
          {action.error}
        </Typography>
      )}
      {action.status === 'proposed' && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {t('encore.actionApprovalHelp')}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1.5 }}>
            <Button
              variant="contained"
              disabled={busy}
              onClick={() => void approve(action.id).catch(() => {})}
            >
              {t('encore.approveAction')}
            </Button>
            <Button
              disabled={busy}
              onClick={() => void command('cancelEncoreAction', { id: action.id }).catch(() => {})}
            >
              {t('common.cancel')}
            </Button>
          </Stack>
        </>
      )}
      {retryable && (
        <Button disabled={busy} onClick={() => void approve(action.id).catch(() => {})}>
          {t('encore.retryAction')}
        </Button>
      )}
      {action.status === 'unknown' && !collection?.provider_playlist_id && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2">{t('encore.unknownCreate')}</Typography>
          <TextField
            fullWidth
            size="small"
            sx={{ mt: 1 }}
            label={t('encore.reconcileUrl')}
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
          />
          <Button
            disabled={busy || !playlistUrl.trim()}
            onClick={() =>
              void command('reconcilePlaylist', { id: action.id, playlistUrl }).catch(() => {})
            }
          >
            {t('encore.reconcile')}
          </Button>
        </Box>
      )}
      {action.status === 'succeeded' && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t('encore.actionCompleted', {
              date: new Date(
                String(action.receipt?.completedAt ?? action.updated_at)
              ).toLocaleString(),
            })}
          </Typography>
        </Box>
      )}
    </ToolCard>
  )
}
