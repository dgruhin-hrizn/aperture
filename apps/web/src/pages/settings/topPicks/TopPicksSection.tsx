import { Alert, Box, CircularProgress, Grid } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { TopPicksPreviewModal } from '../components/TopPicksPreviewModal'
import {
  TopPicksActionsCard,
  TopPicksAutoRequestCard,
  TopPicksHeaderCard,
  TopPicksLocalAlgorithmCard,
  TopPicksMediaSettingsCard,
  TopPicksOutputConfigCard,
} from './cards'
import {
  useTopPicksConfig,
  useTopPicksImages,
  useTopPicksLibraryPreview,
  useTopPicksOptions,
} from './hooks'

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
  const preview = useTopPicksLibraryPreview(config)

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

  const sharedMediaProps = {
    config,
    mdblistConfigured,
    sourceOptions,
    hybridExternalOptions,
    sortOptions,
    getLanguageName,
    extendedLanguageCodes,
    previewCounts: preview.previewCounts,
    previewLoading: preview.previewLoading,
    hasChanges,
    saving,
    onSave: () => void handleSave(),
    updateConfig,
  }

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
        <Grid item xs={12} lg={6}>
          <TopPicksMediaSettingsCard
            mediaType="movies"
            {...sharedMediaProps}
            matchLoading={preview.moviesMatchLoading}
            libraryMatch={preview.moviesLibraryMatch}
            matchExpanded={preview.moviesMatchExpanded}
            onMatchExpandToggle={() => preview.setMoviesMatchExpanded(!preview.moviesMatchExpanded)}
            onOpenPreview={() => preview.openPreviewModal('movies')}
          />
        </Grid>
        <Grid item xs={12} lg={6}>
          <TopPicksMediaSettingsCard
            mediaType="series"
            {...sharedMediaProps}
            matchLoading={preview.seriesMatchLoading}
            libraryMatch={preview.seriesLibraryMatch}
            matchExpanded={preview.seriesMatchExpanded}
            onMatchExpandToggle={() => preview.setSeriesMatchExpanded(!preview.seriesMatchExpanded)}
            onOpenPreview={() => preview.openPreviewModal('series')}
          />
        </Grid>
      </Grid>

      {showLocalAlgorithm && <TopPicksLocalAlgorithmCard config={config} updateConfig={updateConfig} />}

      <TopPicksAutoRequestCard config={config} updateConfig={updateConfig} />

      <TopPicksOutputConfigCard
        config={config}
        updateConfig={updateConfig}
        images={images}
        uploadingFor={uploadingFor}
        handleUpload={handleUpload}
        handleDeleteImage={handleDeleteImage}
      />

      <TopPicksActionsCard
        config={config}
        saving={saving}
        hasChanges={hasChanges}
        handleSave={handleSave}
        handleReset={handleReset}
        handleRefreshNow={handleRefreshNow}
      />

      <TopPicksPreviewModal
        open={preview.previewModalOpen}
        onClose={() => preview.setPreviewModalOpen(false)}
        mediaType={preview.previewModalMediaType}
        source={
          preview.previewModalMediaType === 'movies'
            ? config.moviesPopularitySource
            : config.seriesPopularitySource
        }
        hybridExternalSource={
          preview.previewModalMediaType === 'movies'
            ? config.moviesHybridExternalSource
            : config.seriesHybridExternalSource
        }
        mdblistListId={
          preview.previewModalMediaType === 'movies'
            ? config.mdblistMoviesListId ?? undefined
            : config.mdblistSeriesListId ?? undefined
        }
        mdblistSort={
          preview.previewModalMediaType === 'movies' ? config.mdblistMoviesSort : config.mdblistSeriesSort
        }
        sourceName={getSourceName(
          preview.previewModalMediaType === 'movies'
            ? config.moviesPopularitySource
            : config.seriesPopularitySource
        )}
        savedLanguages={
          preview.previewModalMediaType === 'movies' ? config.moviesLanguages : config.seriesLanguages
        }
        savedIncludeUnknownLanguage={
          preview.previewModalMediaType === 'movies'
            ? config.moviesIncludeUnknownLanguage
            : config.seriesIncludeUnknownLanguage
        }
      />
    </Box>
  )
}
