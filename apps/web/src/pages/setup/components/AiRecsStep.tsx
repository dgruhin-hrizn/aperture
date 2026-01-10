import {
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  Chip,
  Grid,
} from '@mui/material'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import LinkIcon from '@mui/icons-material/Link'
import { ImageUpload } from '@/components/ImageUpload'
import type { SetupWizardContext } from '../types'

interface AiRecsStepProps {
  wizard: SetupWizardContext
}

const RECOMMENDED_DIMENSIONS = {
  width: 1000,
  height: 563,
}

export function AiRecsStep({ wizard }: AiRecsStepProps) {
  const {
    error,
    aiRecsOutput,
    setAiRecsOutput,
    libraryImages,
    uploadingImage,
    uploadLibraryImage,
    deleteLibraryImage,
    saveAiRecsOutput,
    saving,
    goToStep,
  } = wizard

  const moviesImage = libraryImages['ai-recs-movies'] || {}
  const seriesImage = libraryImages['ai-recs-series'] || {}

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configure AI Recommendation Libraries
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Aperture creates virtual libraries in your media server containing personalized recommendations for each user.
        Configure how these libraries are created and optionally customize their cover images.
      </Typography>

      <Alert severity="info" sx={{ mb: 2, py: 0.5 }} icon={false}>
        <Typography variant="caption">
          <strong>STRM vs Symlinks:</strong> STRM files work universally and support streaming URLs, while Symlinks
          provide direct file access (better for local playback) but require Aperture to access your media files at the
          same paths as your media server. For TV series, symlinks are recommended for better performance.
        </Typography>
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Side-by-side Cards */}
      <Grid container spacing={3}>
        {/* Movies Card */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <MovieIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={600}>
                  Movies Library
                </Typography>
                {moviesImage.url && (
                  <Chip size="small" label="Image Set" color="success" variant="outlined" sx={{ ml: 'auto' }} />
                )}
              </Box>

              {/* Output Format */}
              <Typography variant="body2" fontWeight={500} gutterBottom>
                Output Format
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={aiRecsOutput.moviesUseSymlinks}
                    onChange={(e) => setAiRecsOutput((c) => ({ ...c, moviesUseSymlinks: e.target.checked }))}
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {aiRecsOutput.moviesUseSymlinks ? <LinkIcon fontSize="small" /> : <FolderOpenIcon fontSize="small" />}
                    <Typography variant="body2">
                      {aiRecsOutput.moviesUseSymlinks ? 'Symlinks' : 'STRM Files'}
                    </Typography>
                  </Box>
                }
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {aiRecsOutput.moviesUseSymlinks
                  ? 'Creates symbolic links to original movie files'
                  : 'Creates .strm files with paths or streaming URLs'}
              </Typography>

              {/* Cover Image */}
              <Typography variant="body2" fontWeight={500} gutterBottom>
                Library Cover Image
              </Typography>
              <Box sx={{ maxWidth: 250 }}>
                <ImageUpload
                  currentImageUrl={moviesImage.url}
                  isDefault={moviesImage.isDefault}
                  recommendedDimensions={RECOMMENDED_DIMENSIONS}
                  onUpload={(file) => uploadLibraryImage('ai-recs-movies', file)}
                  onDelete={moviesImage.url ? () => deleteLibraryImage('ai-recs-movies') : undefined}
                  loading={uploadingImage === 'ai-recs-movies'}
                  height={141}
                  label="Drop image"
                  showDelete={!!moviesImage.url}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Series Card */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <TvIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={600}>
                  Series Library
                </Typography>
                {seriesImage.url && (
                  <Chip size="small" label="Image Set" color="success" variant="outlined" sx={{ ml: 'auto' }} />
                )}
              </Box>

              {/* Output Format */}
              <Typography variant="body2" fontWeight={500} gutterBottom>
                Output Format
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={aiRecsOutput.seriesUseSymlinks}
                    onChange={(e) => setAiRecsOutput((c) => ({ ...c, seriesUseSymlinks: e.target.checked }))}
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {aiRecsOutput.seriesUseSymlinks ? <LinkIcon fontSize="small" /> : <FolderOpenIcon fontSize="small" />}
                    <Typography variant="body2">
                      {aiRecsOutput.seriesUseSymlinks ? 'Symlinks' : 'STRM Files'}
                    </Typography>
                  </Box>
                }
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {aiRecsOutput.seriesUseSymlinks
                  ? 'Creates symlinks to original season folders (recommended)'
                  : 'Creates .strm files for each episode'}
              </Typography>

              {/* Cover Image */}
              <Typography variant="body2" fontWeight={500} gutterBottom>
                Library Cover Image
              </Typography>
              <Box sx={{ maxWidth: 250 }}>
                <ImageUpload
                  currentImageUrl={seriesImage.url}
                  isDefault={seriesImage.isDefault}
                  recommendedDimensions={RECOMMENDED_DIMENSIONS}
                  onUpload={(file) => uploadLibraryImage('ai-recs-series', file)}
                  onDelete={seriesImage.url ? () => deleteLibraryImage('ai-recs-series') : undefined}
                  loading={uploadingImage === 'ai-recs-series'}
                  height={141}
                  label="Drop image"
                  showDelete={!!seriesImage.url}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button variant="outlined" onClick={() => goToStep('mediaLibraries')}>
          Back
        </Button>
        <Button variant="contained" onClick={saveAiRecsOutput} disabled={saving}>
          {saving ? <CircularProgress size={20} /> : 'Save & Continue'}
        </Button>
      </Box>
    </Box>
  )
}
