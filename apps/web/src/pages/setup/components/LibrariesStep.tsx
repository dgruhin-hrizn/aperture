import { Box, Button, Typography, Alert, CircularProgress, Switch, List, ListItem, ListItemText, Chip } from '@mui/material'
import { LocalMovies as LocalMoviesIcon, Tv as TvIcon } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import type { SetupWizardContext, LibraryConfig } from '../types'

interface LibrariesStepProps {
  wizard: SetupWizardContext
}

export function LibrariesStep({ wizard }: LibrariesStepProps) {
  const { t } = useTranslation()
  const { error, libraries, setLibraries, loadingLibraries, loadLibraries, saveLibraries, saving, goToStep } = wizard

  const movieLibraries = libraries.filter((l) => l.collectionType === 'movies')
  const tvLibraries = libraries.filter((l) => l.collectionType === 'tvshows')

  const renderLibraryList = (libs: LibraryConfig[]) => (
    <List dense disablePadding>
      {libs.map((lib) => (
        <ListItem
          key={lib.providerLibraryId}
          secondaryAction={
            <Switch
              checked={lib.isEnabled}
              onChange={(_, checked) =>
                setLibraries((allLibs) =>
                  allLibs.map((l) => (l.providerLibraryId === lib.providerLibraryId ? { ...l, isEnabled: checked } : l))
                )
              }
            />
          }
          sx={{ py: 0.5 }}
        >
          <ListItemText primary={lib.name} />
        </ListItem>
      ))}
      {libs.length === 0 && (
        <ListItem sx={{ py: 0.5 }}>
          <ListItemText primary={t('setup.libraries.nonePrimary')} secondary={t('setup.libraries.noneSecondary')} />
        </ListItem>
      )}
    </List>
  )

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('setup.libraries.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {t('setup.libraries.body')}
      </Typography>

      <Alert severity="info" sx={{ mb: 2, py: 0.5 }} icon={false}>
        <Typography variant="caption">{t('setup.libraries.whatNext')}</Typography>
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={loadLibraries} disabled={loadingLibraries}>
          {loadingLibraries ? <CircularProgress size={20} /> : t('setup.libraries.refresh')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => setLibraries((libs) => libs.map((l) => ({ ...l, isEnabled: true })))}
          disabled={libraries.length === 0}
        >
          {t('setup.libraries.enableAll')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => setLibraries((libs) => libs.map((l) => ({ ...l, isEnabled: false })))}
          disabled={libraries.length === 0}
        >
          {t('setup.libraries.disableAll')}
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* Movies Section */}
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            backgroundColor: 'background.default',
          }}
        >
          <Box sx={{ mb: 2 }}>
            <Chip icon={<LocalMoviesIcon />} label={t('setup.libraries.moviesChip')} color="primary" variant="filled" sx={{ fontWeight: 600 }} />
          </Box>
          {renderLibraryList(movieLibraries)}
        </Box>

        {/* TV Series Section */}
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            backgroundColor: 'background.default',
          }}
        >
          <Box sx={{ mb: 2 }}>
            <Chip icon={<TvIcon />} label={t('setup.libraries.tvChip')} color="secondary" variant="filled" sx={{ fontWeight: 600 }} />
          </Box>
          {renderLibraryList(tvLibraries)}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button variant="outlined" onClick={() => goToStep('mediaServer')}>
          {t('setup.libraries.back')}
        </Button>
        <Button variant="contained" onClick={saveLibraries} disabled={saving}>
          {saving ? <CircularProgress size={20} /> : t('setup.libraries.saveContinue')}
        </Button>
      </Box>
    </Box>
  )
}

