import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Card, CardContent, Checkbox, Chip, Divider, FormControlLabel, FormGroup, Grid, Stack, Switch, TextField, Typography } from '@mui/material'
import CollectionsIcon from '@mui/icons-material/Collections'; import ExpandMoreIcon from '@mui/icons-material/ExpandMore'; import FolderIcon from '@mui/icons-material/Folder'; import ImageIcon from '@mui/icons-material/Image'; import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'; import MovieIcon from '@mui/icons-material/Movie'; import OutputIcon from '@mui/icons-material/Output'; import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'; import TvIcon from '@mui/icons-material/Tv'; import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Trans, useTranslation } from 'react-i18next'
import { ImageUpload } from '../../../components/ImageUpload'
import { RECOMMENDED_DIMENSIONS } from './constants'
import type { LibraryImageInfo, TopPicksConfig } from './types'
export interface TopPicksOutputConfigCardProps { config: TopPicksConfig; images: Record<string, LibraryImageInfo>; uploadingFor: string | null; updateConfig: (u: Partial<TopPicksConfig>) => void; handleUpload: (id: string, file: File) => Promise<void>; handleDeleteImage: (id: string) => Promise<void> }
export function TopPicksOutputConfigCard({ config, images, uploadingFor, updateConfig, handleUpload, handleDeleteImage }: TopPicksOutputConfigCardProps) { const { t } = useTranslation(); return (      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <OutputIcon fontSize="small" color="primary" />
            {t('topPicksAdmin.output.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('topPicksAdmin.output.subtitle')}
          </Typography>

          {/* Output Type Explanations */}
          <Accordion defaultExpanded={false} sx={{ mb: 3, bgcolor: 'action.hover' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoOutlinedIcon fontSize="small" />
                {t('topPicksAdmin.output.accordionTitle')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <FolderIcon fontSize="small" color="primary" /> {t('topPicksAdmin.output.libraryHeading')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('topPicksAdmin.output.libraryBody')}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CollectionsIcon fontSize="small" color="primary" /> {t('topPicksAdmin.output.collectionHeading')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('topPicksAdmin.output.collectionBody')}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <PlaylistPlayIcon fontSize="small" color="primary" /> {t('topPicksAdmin.output.playlistHeading')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('topPicksAdmin.output.playlistBody')}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Movies & Series Output - Side by Side */}
          <Grid container spacing={3}>
            {/* Movies Output Config */}
            <Grid item xs={12} lg={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <MovieIcon color="primary" />
                    {t('topPicksAdmin.output.moviesOutput')}
                    {images['top-picks-movies']?.url && (
                      <Chip size="small" label={t('topPicksAdmin.output.imageSet')} color="success" variant="outlined" sx={{ ml: 'auto' }} />
                    )}
                  </Typography>

              {/* Library Cover Image */}
              <Box sx={{ mb: 3 }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <ImageIcon fontSize="small" color="action" />
                  <Typography variant="body2" fontWeight={500}>{t('topPicksAdmin.output.libraryCoverImage')}</Typography>
                </Box>
                <Box sx={{ maxWidth: 400 }}>
                  <ImageUpload
                    currentImageUrl={images['top-picks-movies']?.url}
                    isDefault={images['top-picks-movies']?.isDefault}
                    recommendedDimensions={RECOMMENDED_DIMENSIONS}
                    onUpload={(file) => handleUpload('top-picks-movies', file)}
                    onDelete={images['top-picks-movies']?.url ? () => handleDeleteImage('top-picks-movies') : undefined}
                    loading={uploadingFor === 'top-picks-movies'}
                    height={160}
                    label={t('topPicksAdmin.output.dropImage169')}
                    showDelete={!!images['top-picks-movies']?.url}
                  />
                </Box>
              </Box>

              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    {t('topPicksAdmin.fields.outputTypesHeading')}
                  </Typography>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.moviesLibraryEnabled}
                          onChange={(e) => updateConfig({ moviesLibraryEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FolderIcon fontSize="small" />
                          <Typography variant="body2">{t('topPicksAdmin.output.librarySidebar')}</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.moviesCollectionEnabled}
                          onChange={(e) => updateConfig({ moviesCollectionEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CollectionsIcon fontSize="small" />
                          <Typography variant="body2">{t('topPicksAdmin.output.collectionBoxSet')}</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.moviesPlaylistEnabled}
                          onChange={(e) => updateConfig({ moviesPlaylistEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PlaylistPlayIcon fontSize="small" />
                          <Typography variant="body2">{t('topPicksAdmin.output.playlist')}</Typography>
                        </Box>
                      }
                    />
                  </FormGroup>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" fontWeight={500} gutterBottom>
                        {t('topPicksAdmin.fields.names')}
                      </Typography>
                      {config.moviesLibraryEnabled && (
                        <TextField
                          fullWidth
                          label={t('topPicksAdmin.fields.libraryName')}
                          value={config.moviesLibraryName}
                          onChange={(e) => updateConfig({ moviesLibraryName: e.target.value })}
                          size="small"
                          disabled={!config.isEnabled}
                          sx={{ mb: 2 }}
                        />
                      )}
                      {(config.moviesCollectionEnabled || config.moviesPlaylistEnabled) && (
                        <TextField
                          fullWidth
                          label={t('topPicksAdmin.fields.collectionPlaylistName')}
                          value={config.moviesCollectionName}
                          onChange={(e) => updateConfig({ moviesCollectionName: e.target.value })}
                          size="small"
                          disabled={!config.isEnabled}
                        />
                      )}
                    </Box>
                    
                    {config.moviesLibraryEnabled && (
                      <Box>
                        <Typography variant="body2" fontWeight={500} gutterBottom>
                          {t('topPicksAdmin.fields.libraryFileType')}
                        </Typography>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={config.moviesUseSymlinks}
                              onChange={(e) => updateConfig({ moviesUseSymlinks: e.target.checked })}
                              disabled={!config.isEnabled}
                              size="small"
                            />
                          }
                          label={
                            <Typography variant="body2">
                              {config.moviesUseSymlinks
                                ? t('topPicksAdmin.output.symlinks')
                                : t('topPicksAdmin.output.strmFiles')}
                            </Typography>
                          }
                        />
                      </Box>
                    )}
                  </Stack>
                </Grid>
              </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Series Output Config */}
            <Grid item xs={12} lg={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <TvIcon color="primary" />
                    {t('topPicksAdmin.output.seriesOutput')}
                    {images['top-picks-series']?.url && (
                      <Chip size="small" label={t('topPicksAdmin.output.imageSet')} color="success" variant="outlined" sx={{ ml: 'auto' }} />
                    )}
                  </Typography>

                  {/* Library Cover Image */}
                  <Box sx={{ mb: 3 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <ImageIcon fontSize="small" color="action" />
                      <Typography variant="body2" fontWeight={500}>{t('topPicksAdmin.output.libraryCoverImage')}</Typography>
                    </Box>
                    <Box sx={{ maxWidth: 400 }}>
                      <ImageUpload
                        currentImageUrl={images['top-picks-series']?.url}
                        isDefault={images['top-picks-series']?.isDefault}
                        recommendedDimensions={RECOMMENDED_DIMENSIONS}
                        onUpload={(file) => handleUpload('top-picks-series', file)}
                        onDelete={images['top-picks-series']?.url ? () => handleDeleteImage('top-picks-series') : undefined}
                        loading={uploadingFor === 'top-picks-series'}
                        height={160}
                        label={t('topPicksAdmin.output.dropImage169')}
                        showDelete={!!images['top-picks-series']?.url}
                      />
                    </Box>
                  </Box>

                  <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    {t('topPicksAdmin.fields.outputTypesHeading')}
                  </Typography>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.seriesLibraryEnabled}
                          onChange={(e) => updateConfig({ seriesLibraryEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FolderIcon fontSize="small" />
                          <Typography variant="body2">{t('topPicksAdmin.output.librarySidebar')}</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.seriesCollectionEnabled}
                          onChange={(e) => updateConfig({ seriesCollectionEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CollectionsIcon fontSize="small" />
                          <Typography variant="body2">{t('topPicksAdmin.output.collectionBoxSet')}</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.seriesPlaylistEnabled}
                          onChange={(e) => updateConfig({ seriesPlaylistEnabled: e.target.checked })}
                          disabled={!config.isEnabled}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PlaylistPlayIcon fontSize="small" />
                          <Typography variant="body2">{t('topPicksAdmin.output.playlist')}</Typography>
                        </Box>
                      }
                    />
                  </FormGroup>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" fontWeight={500} gutterBottom>
                        {t('topPicksAdmin.fields.names')}
                      </Typography>
                      {config.seriesLibraryEnabled && (
                        <TextField
                          fullWidth
                          label={t('topPicksAdmin.fields.libraryName')}
                          value={config.seriesLibraryName}
                          onChange={(e) => updateConfig({ seriesLibraryName: e.target.value })}
                          size="small"
                          disabled={!config.isEnabled}
                          sx={{ mb: 2 }}
                        />
                      )}
                      {(config.seriesCollectionEnabled || config.seriesPlaylistEnabled) && (
                        <TextField
                          fullWidth
                          label={t('topPicksAdmin.fields.collectionPlaylistName')}
                          value={config.seriesCollectionName}
                          onChange={(e) => updateConfig({ seriesCollectionName: e.target.value })}
                          size="small"
                          disabled={!config.isEnabled}
                        />
                      )}
                    </Box>
                    
                    {config.seriesLibraryEnabled && (
                      <Box>
                        <Typography variant="body2" fontWeight={500} gutterBottom>
                          {t('topPicksAdmin.fields.libraryFileType')}
                        </Typography>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={config.seriesUseSymlinks}
                              onChange={(e) => updateConfig({ seriesUseSymlinks: e.target.checked })}
                              disabled={!config.isEnabled}
                              size="small"
                            />
                          }
                          label={
                            <Typography variant="body2">
                              {config.seriesUseSymlinks
                                ? t('topPicksAdmin.output.symlinks')
                                : t('topPicksAdmin.output.strmFiles')}
                            </Typography>
                          }
                        />
                      </Box>
                    )}
                  </Stack>
                  </Grid>
                </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Symlink Warning */}
          {(config.moviesUseSymlinks || config.seriesUseSymlinks) && (
            <Alert severity="warning" icon={<WarningAmberIcon />}>
              <Typography variant="body2" component="div">
                <Trans i18nKey="topPicksAdmin.output.symlinkWarning" components={{ strong: <strong /> }} />
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>) }