import { useState } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { EncoreCuration } from '@aperture/core/encore'
import { useWorkbench } from './hooks/useWorkbench'
import { CurationCard } from './CurationCard'
import { CurationEditor } from './CurationEditor'
export function CurationPanel() {
  const { t } = useTranslation(),
    state = useWorkbench(),
    [editing, setEditing] = useState<EncoreCuration | null | undefined>(undefined)
  const collections = state.data.collections.filter((c) => c.provider_playlist_id)
  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 4 } }}>
      <Stack spacing={2} sx={{ maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h5">{t('encore.curationTitle')}</Typography>
        <Typography color="text.secondary">{t('encore.curationIntro')}</Typography>
        {state.error && <Alert severity="error">{state.error}</Alert>}
        <Box>
          <Button
            variant="outlined"
            disabled={!collections.length || state.busy}
            onClick={() => setEditing(null)}
          >
            {t('encore.createCuration')}
          </Button>
        </Box>
        {state.loading ? (
          <CircularProgress size={24} />
        ) : state.data.curations.length ? (
          state.data.curations.map((curation) => (
            <CurationCard
              key={curation.id}
              curation={curation}
              runs={state.data.runs}
              busy={state.busy}
              onEdit={setEditing}
              onControl={state.controlCuration}
            />
          ))
        ) : (
          <Alert severity="info">
            {t(collections.length ? 'encore.curationEmpty' : 'encore.curationNeedsCollection')}
          </Alert>
        )}
        <Typography variant="caption" color="text.secondary">
          {t('encore.curationSafety')}
        </Typography>
        {editing !== undefined && (
          <CurationEditor
            curation={editing ?? undefined}
            collections={collections}
            busy={state.busy}
            error={state.error}
            onClose={() => setEditing(undefined)}
            onSave={async (input) => {
              await state.command(
                editing ? 'updateCuration' : 'prepareCuration',
                editing ? { id: editing.id, revision: editing.revision, input } : input
              )
              setEditing(undefined)
            }}
          />
        )}
      </Stack>
    </Box>
  )
}
