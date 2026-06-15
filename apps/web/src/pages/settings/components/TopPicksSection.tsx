import React from 'react'
import { Alert, Box, Button, Card, CardContent, CircularProgress, Grid, Stack } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import RestoreIcon from '@mui/icons-material/Restore'
import SaveIcon from '@mui/icons-material/Save'
import { useTranslation } from 'react-i18next'
import { TopPicksPreviewModal } from './TopPicksPreviewModal'
import { TopPicksAutoRequestSection } from '../topPicks/TopPicksAutoRequestSection'
import { TopPicksHeaderCard } from '../topPicks/TopPicksHeaderCard'
import { TopPicksLocalAlgorithmCard } from '../topPicks/TopPicksLocalAlgorithmCard'
import { TopPicksMediaSettingsCard } from '../topPicks/TopPicksMediaSettingsCard'
import { TopPicksOutputSection } from '../topPicks/TopPicksOutputSection'
import { useTopPicksConfig } from '../topPicks/useTopPicksConfig'
import { useTopPicksImages } from '../topPicks/useTopPicksImages'
import { useTopPicksOptions } from '../topPicks/useTopPicksOptions'
import { useTopPicksPreview } from '../topPicks/useTopPicksPreview'

export function TopPicksSection() {
  const { t } = useTranslation()
  const {
    config,
    loading,
    saving,
    error,
    success,
    hasChanges,
    mdblistConfigured,
    setError,
    setSuccess,
    updateConfig,
    handleSave,
    handleReset,
    handleRefreshNow,
  } = useTopPicksConfig()
  const { sortOptions, sourceOptions, hybridExternalOptions, extendedLanguageCodes, getLanguageName, getSourceName } =
    useTopPicksOptions()
  const { images, uploadingFor, handleUpload, handleDeleteImage } = useTopPicksImages(setError)
  const preview = useTopPicksPreview(config)

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    )
  }

  if (!config) {
    return <Alert severity="error">{t('topPicksAdmin.loadFailed')}</Alert>
  }

  const showLocalAlgorithm =
    config.moviesPopularitySource === 'emby_history' ||
    config.moviesPopularitySource === 'hybrid' ||
    config.seriesPopularitySource === 'emby_history' ||
    config.seriesPopularitySource === 'hybrid'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <TopPicksHeaderCard
        config={config}
        error={error}
        success={success}
        setError={setError}
        setSuccess={setSuccess}
        updateConfig={updateConfig}
      />

      <Grid container spacing={3}>
        <TopPicksMediaSettingsCard
          mediaType="movies"
          config={config}
          mdblistConfigured={mdblistConfigured}
          sourceOptions={sourceOptions}
          hybridExternalOptions={hybridExternalOptions}
          sortOptions={sortOptions}
          getLanguageName={getLanguageName}
          extendedLanguageCodes={extendedLanguageCodes}
          matchLoading={preview.moviesMatchLoading}
          libraryMatch={preview.moviesLibraryMatch}
          matchExpanded={preview.moviesMatchExpanded}
          onMatchExpandToggle={() => preview.setMoviesMatchExpanded(!preview.moviesMatchExpanded)}
          onOpenPreview={() => preview.openPreviewModal('movies')}
          previewCounts={preview.previewCounts}
          previewLoading={preview.previewLoading}
          hasChanges={hasChanges}
          saving={saving}
          onSave={() => void handleSave()}
          updateConfig={updateConfig}
        />
        <TopPicksMediaSettingsCard
          mediaType="series"
          config={config}
          mdblistConfigured={mdblistConfigured}
          sourceOptions={sourceOptions}
          hybridExternalOptions={hybridExternalOptions}
          sortOptions={sortOptions}
          getLanguageName={getLanguageName}
          extendedLanguageCodes={extendedLanguageCodes}
          matchLoading={preview.seriesMatchLoading}
          libraryMatch={preview.seriesLibraryMatch}
          matchExpanded={preview.seriesMatchExpanded}
          onMatchExpandToggle={() => preview.setSeriesMatchExpanded(!preview.seriesMatchExpanded)}
          onOpenPreview={() => preview.openPreviewModal('series')}
          previewCounts={preview.previewCounts}
          previewLoading={preview.previewLoading}
          hasChanges={hasChanges}
          saving={saving}
          onSave={() => void handleSave()}
          updateConfig={updateConfig}
        />
      </Grid>

      {showLocalAlgorithm && <TopPicksLocalAlgorithmCard config={config} updateConfig={updateConfig} />}

      <TopPicksAutoRequestSection config={config} updateConfig={updateConfig} />

      <TopPicksOutputSection
        config={config}
        images={images}
        uploadingFor={uploadingFor}
        updateConfig={updateConfig}
        handleUpload={handleUpload}
        handleDeleteImage={handleDeleteImage}
      />

      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" startIcon={<RestoreIcon />} onClick={() => void handleReset()} disabled={saving}>
                {t('topPicksAdmin.actions.resetDefaults')}
              </Button>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void handleRefreshNow()} disabled={!config.isEnabled}>
                {t('topPicksAdmin.actions.refreshNow')}
              </Button>
            </Stack>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={() => void handleSave()}
              disabled={saving || !hasChanges}
              size="large"
            >
              {saving ? t('topPicksAdmin.actions.saving') : t('topPicksAdmin.actions.saveChanges')}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <TopPicksPreviewModal
        open={preview.previewModalOpen}
        onClose={() => preview.setPreviewModalOpen(false)}
        mediaType={preview.previewModalMediaType}
        source={
          preview.previewModalMediaType === 'movies' ? config.moviesPopularitySource : config.seriesPopularitySource
        }
        hybridExternalSource={
          preview.previewModalMediaType === 'movies' ? config.moviesHybridExternalSource : config.seriesHybridExternalSource
        }
        mdblistListId={
          preview.previewModalMediaType === 'movies'
            ? config.mdblistMoviesListId ?? undefined
            : config.mdblistSeriesListId ?? undefined
        }
        mdblistSort={preview.previewModalMediaType === 'movies' ? config.mdblistMoviesSort : config.mdblistSeriesSort}
        sourceName={getSourceName(
          preview.previewModalMediaType === 'movies' ? config.moviesPopularitySource : config.seriesPopularitySource
        )}
        savedLanguages={preview.previewModalMediaType === 'movies' ? config.moviesLanguages : config.seriesLanguages}
        savedIncludeUnknownLanguage={
          preview.previewModalMediaType === 'movies'
            ? config.moviesIncludeUnknownLanguage
            : config.seriesIncludeUnknownLanguage
        }
      />
    </Box>
  )
}
