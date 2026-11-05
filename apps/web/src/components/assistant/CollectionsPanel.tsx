import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useWorkbench } from './hooks/useWorkbench'
import { ActionCard } from './ActionCard'
export function CollectionsPanel() {
  const { t } = useTranslation(),
    state = useWorkbench()
  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 4 } }}>
      <Stack spacing={2} sx={{ maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h5">{t('encore.collectionsTitle')}</Typography>
        <Typography color="text.secondary">{t('encore.collectionsIntro')}</Typography>
        {state.error && <Alert severity="error">{state.error}</Alert>}
        {state.loading ? (
          <CircularProgress size={24} />
        ) : (
          <>
            {!state.data.collections.length && (
              <Alert severity="info">{t('encore.collectionsEmpty')}</Alert>
            )}
            {state.data.collections
              .filter((c) => c.provider_playlist_id)
              .map((collection) => (
                <Paper variant="outlined" key={collection.id} sx={{ p: 2.5, borderRadius: 3 }}>
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography fontWeight={600} sx={{ flex: 1 }}>
                      {collection.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={t(collection.section_id ? 'encore.pinned' : 'encore.playlist')}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {t('encore.managedCount', { count: collection.baseline.length })}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Button
                      disabled={state.busy}
                      onClick={() =>
                        void state
                          .command('proposeHomeRow', {
                            operation: collection.section_id ? 'unpin' : 'pin',
                            collectionId: collection.id,
                          })
                          .catch(() => {})
                      }
                    >
                      {t(collection.section_id ? 'encore.unpin' : 'encore.pin')}
                    </Button>
                  </Box>
                </Paper>
              ))}
            <Typography variant="h6">{t('encore.actionHistory')}</Typography>
            {state.data.actions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                collection={state.data.collections.find((c) => c.id === action.collection_id)}
                busy={state.busy}
                command={state.command}
                approve={state.approve}
              />
            ))}
          </>
        )}
      </Stack>
    </Box>
  )
}
