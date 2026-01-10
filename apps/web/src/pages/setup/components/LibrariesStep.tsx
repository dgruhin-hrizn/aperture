import { Box, Button, Typography, Alert, CircularProgress, Switch, List, ListItem, ListItemText, Chip } from '@mui/material'
import { LocalMovies as LocalMoviesIcon, Tv as TvIcon } from '@mui/icons-material'
import type { SetupWizardContext, LibraryConfig } from '../types'

interface LibrariesStepProps {
  wizard: SetupWizardContext
}

export function LibrariesStep({ wizard }: LibrariesStepProps) {
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
          <ListItemText primary="No libraries found" secondary="Click Refresh to load libraries" />
        </ListItem>
      )}
    </List>
  )

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Select Libraries to Analyze
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Choose which media libraries Aperture should include when generating recommendations. Only content from enabled
        libraries will be analyzed for viewing patterns and included in AI-powered suggestions. You can have multiple
        libraries of each type enabled.
      </Typography>

      <Alert severity="info" sx={{ mb: 2, py: 0.5 }} icon={false}>
        <Typography variant="caption">
          <strong>What happens next:</strong> Aperture will sync metadata from these libraries, analyze content
          similarities using AI embeddings, and track watch history to understand each user's preferences.
        </Typography>
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={loadLibraries} disabled={loadingLibraries}>
          {loadingLibraries ? <CircularProgress size={20} /> : 'Refresh Libraries'}
        </Button>
        <Button
          variant="outlined"
          onClick={() => setLibraries((libs) => libs.map((l) => ({ ...l, isEnabled: true })))}
          disabled={libraries.length === 0}
        >
          Enable All
        </Button>
        <Button
          variant="outlined"
          onClick={() => setLibraries((libs) => libs.map((l) => ({ ...l, isEnabled: false })))}
          disabled={libraries.length === 0}
        >
          Disable All
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
            <Chip icon={<LocalMoviesIcon />} label="Movies" color="primary" variant="filled" sx={{ fontWeight: 600 }} />
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
            <Chip icon={<TvIcon />} label="TV Series" color="secondary" variant="filled" sx={{ fontWeight: 600 }} />
          </Box>
          {renderLibraryList(tvLibraries)}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button variant="outlined" onClick={() => goToStep('mediaServer')}>
          Back
        </Button>
        <Button variant="contained" onClick={saveLibraries} disabled={saving}>
          {saving ? <CircularProgress size={20} /> : 'Save & Continue'}
        </Button>
      </Box>
    </Box>
  )
}

