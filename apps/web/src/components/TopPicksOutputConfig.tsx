import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Chip,
  Grid,
  Checkbox,
  FormGroup,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import FolderIcon from '@mui/icons-material/Folder'
import CollectionsIcon from '@mui/icons-material/Collections'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'
import ImageIcon from '@mui/icons-material/Image'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useTranslation } from 'react-i18next'
import { ImageUpload } from './ImageUpload'

export interface TopPicksOutputConfigProps {
  config: {
    moviesLibraryEnabled: boolean
    moviesCollectionEnabled: boolean
    moviesPlaylistEnabled: boolean
    moviesUseSymlinks: boolean
    seriesLibraryEnabled: boolean
    seriesCollectionEnabled: boolean
    seriesPlaylistEnabled: boolean
    seriesUseSymlinks: boolean
  }
  onChange: (updates: Partial<TopPicksOutputConfigProps['config']>) => void
  disabled?: boolean
  images?: Record<string, { url?: string; isDefault?: boolean }>
  onUploadImage?: (libraryTypeId: string, file: File) => Promise<void>
  onDeleteImage?: (libraryTypeId: string) => Promise<void>
  uploadingFor?: string | null
  showImages?: boolean
  showExplanation?: boolean
}

const RECOMMENDED_DIMENSIONS = {
  width: 1000,
  height: 563,
}

export function TopPicksOutputConfig({
  config,
  onChange,
  disabled = false,
  images = {},
  onUploadImage,
  onDeleteImage,
  uploadingFor,
  showImages = true,
  showExplanation = true,
}: TopPicksOutputConfigProps) {
  const { t } = useTranslation()
  return (
    <Box>
      {/* Output Type Explanations */}
      {showExplanation && (
        <Accordion defaultExpanded={false} sx={{ mb: 3, bgcolor: 'action.hover' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoOutlinedIcon fontSize="small" />
              {t('topPicksOutputConfig.accordionTitle')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <FolderIcon fontSize="small" color="primary" /> {t('topPicksOutputConfig.libraryTitle')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('topPicksOutputConfig.libraryBody')}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CollectionsIcon fontSize="small" color="primary" />{' '}
                    {t('topPicksOutputConfig.collectionTitle')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('topPicksOutputConfig.collectionBody')}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <PlaylistPlayIcon fontSize="small" color="primary" /> {t('topPicksOutputConfig.playlistTitle')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('topPicksOutputConfig.playlistBody')}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Movies and Series Output Config - Side by Side */}
      <Grid container spacing={3}>
        {/* Movies Output Config */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <MovieIcon color="primary" />
                {t('topPicksOutputConfig.moviesOutput')}
                {images['top-picks-movies']?.url && (
                  <Chip size="small" label={t('topPicksOutputConfig.imageSet')} color="success" variant="outlined" sx={{ ml: 'auto' }} />
                )}
              </Typography>

              {/* Library Cover Image */}
              {showImages && onUploadImage && (
                <Box sx={{ mb: 2 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <ImageIcon fontSize="small" color="action" />
                    <Typography variant="body2" fontWeight={500}>
                      {t('topPicksOutputConfig.libraryCoverImage')}
                    </Typography>
                  </Box>
                  <Box sx={{ maxWidth: 250 }}>
                    <ImageUpload
                      currentImageUrl={images['top-picks-movies']?.url}
                      isDefault={images['top-picks-movies']?.isDefault}
                      recommendedDimensions={RECOMMENDED_DIMENSIONS}
                      onUpload={(file) => onUploadImage('top-picks-movies', file)}
                      onDelete={
                        images['top-picks-movies']?.url && onDeleteImage
                          ? () => onDeleteImage('top-picks-movies')
                          : undefined
                      }
                      loading={uploadingFor === 'top-picks-movies'}
                      height={141}
                      label={t('topPicksOutputConfig.dropImage')}
                      showDelete={!!images['top-picks-movies']?.url}
                    />
                  </Box>
                  <Divider sx={{ mt: 2, mb: 2 }} />
                </Box>
              )}

              <Typography variant="body2" fontWeight={500} gutterBottom>
                {t('topPicksOutputConfig.outputTypes')}
              </Typography>
              <FormGroup sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.moviesLibraryEnabled}
                      onChange={(e) => onChange({ moviesLibraryEnabled: e.target.checked })}
                      disabled={disabled}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FolderIcon fontSize="small" />
                      <Typography variant="body2">{t('topPicksOutputConfig.outputLibrary')}</Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.moviesCollectionEnabled}
                      onChange={(e) => onChange({ moviesCollectionEnabled: e.target.checked })}
                      disabled={disabled}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CollectionsIcon fontSize="small" />
                      <Typography variant="body2">{t('topPicksOutputConfig.outputCollection')}</Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.moviesPlaylistEnabled}
                      onChange={(e) => onChange({ moviesPlaylistEnabled: e.target.checked })}
                      disabled={disabled}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PlaylistPlayIcon fontSize="small" />
                      <Typography variant="body2">{t('topPicksOutputConfig.outputPlaylist')}</Typography>
                    </Box>
                  }
                />
              </FormGroup>

              {config.moviesLibraryEnabled && (
                <Box>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    {t('topPicksOutputConfig.libraryFileType')}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.moviesUseSymlinks}
                        onChange={(e) => onChange({ moviesUseSymlinks: e.target.checked })}
                        disabled={disabled}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2">
                        {config.moviesUseSymlinks ? t('topPicksOutputConfig.symlinks') : t('topPicksOutputConfig.strmFiles')}
                      </Typography>
                    }
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Series Output Config */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TvIcon color="primary" />
                {t('topPicksOutputConfig.seriesOutput')}
                {images['top-picks-series']?.url && (
                  <Chip size="small" label={t('topPicksOutputConfig.imageSet')} color="success" variant="outlined" sx={{ ml: 'auto' }} />
                )}
              </Typography>

              {/* Library Cover Image */}
              {showImages && onUploadImage && (
                <Box sx={{ mb: 2 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <ImageIcon fontSize="small" color="action" />
                    <Typography variant="body2" fontWeight={500}>
                      {t('topPicksOutputConfig.libraryCoverImage')}
                    </Typography>
                  </Box>
                  <Box sx={{ maxWidth: 250 }}>
                    <ImageUpload
                      currentImageUrl={images['top-picks-series']?.url}
                      isDefault={images['top-picks-series']?.isDefault}
                      recommendedDimensions={RECOMMENDED_DIMENSIONS}
                      onUpload={(file) => onUploadImage('top-picks-series', file)}
                      onDelete={
                        images['top-picks-series']?.url && onDeleteImage
                          ? () => onDeleteImage('top-picks-series')
                          : undefined
                      }
                      loading={uploadingFor === 'top-picks-series'}
                      height={141}
                      label={t('topPicksOutputConfig.dropImage')}
                      showDelete={!!images['top-picks-series']?.url}
                    />
                  </Box>
                  <Divider sx={{ mt: 2, mb: 2 }} />
                </Box>
              )}

              <Typography variant="body2" fontWeight={500} gutterBottom>
                {t('topPicksOutputConfig.outputTypes')}
              </Typography>
              <FormGroup sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.seriesLibraryEnabled}
                      onChange={(e) => onChange({ seriesLibraryEnabled: e.target.checked })}
                      disabled={disabled}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FolderIcon fontSize="small" />
                      <Typography variant="body2">{t('topPicksOutputConfig.outputLibrary')}</Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.seriesCollectionEnabled}
                      onChange={(e) => onChange({ seriesCollectionEnabled: e.target.checked })}
                      disabled={disabled}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CollectionsIcon fontSize="small" />
                      <Typography variant="body2">{t('topPicksOutputConfig.outputCollection')}</Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.seriesPlaylistEnabled}
                      onChange={(e) => onChange({ seriesPlaylistEnabled: e.target.checked })}
                      disabled={disabled}
                      size="small"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PlaylistPlayIcon fontSize="small" />
                      <Typography variant="body2">{t('topPicksOutputConfig.outputPlaylist')}</Typography>
                    </Box>
                  }
                />
              </FormGroup>

              {config.seriesLibraryEnabled && (
                <Box>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    {t('topPicksOutputConfig.libraryFileType')}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.seriesUseSymlinks}
                        onChange={(e) => onChange({ seriesUseSymlinks: e.target.checked })}
                        disabled={disabled}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2">
                        {config.seriesUseSymlinks ? t('topPicksOutputConfig.symlinks') : t('topPicksOutputConfig.strmFiles')}
                      </Typography>
                    }
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

