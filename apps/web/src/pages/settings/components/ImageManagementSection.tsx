import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Chip,
  Button,
  Tooltip,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ImageIcon from '@mui/icons-material/Image'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'
import CollectionsIcon from '@mui/icons-material/Collections'
import RefreshIcon from '@mui/icons-material/Refresh'
import PersonIcon from '@mui/icons-material/Person'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import DownloadIcon from '@mui/icons-material/Download'
import { ImageUpload } from '../../../components/ImageUpload'

interface ApertureLibrary {
  id: string
  name: string
  providerLibraryId: string
  type: 'top-picks' | 'user-recommendations'
  mediaType: 'movies' | 'series'
  userId?: string
  userName?: string
}

interface LibraryImageInfo {
  url?: string
  isDefault?: boolean
  embyUrl?: string // URL to the image on Emby (fallback)
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box pt={2}>{children}</Box>}
    </div>
  )
}

const RECOMMENDED_DIMENSIONS = {
  library: {
    Primary: { width: 1920, height: 1080 }, // 16:9 landscape banner
  },
  collection: {
    Primary: { width: 400, height: 600 }, // 2:3 portrait poster
  },
  playlist: {
    Primary: { width: 400, height: 600 }, // 2:3 portrait poster
  },
}

export function ImageManagementSection() {
  const [tabValue, setTabValue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [libraries, setLibraries] = useState<ApertureLibrary[]>([])
  const [libraryImages, setLibraryImages] = useState<Record<string, LibraryImageInfo>>({})
  const [error, setError] = useState<string | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  // Fetch Aperture-created libraries
  const fetchApertureLibraries = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch strm_libraries and Top Picks config
      const [strmRes, topPicksRes] = await Promise.all([
        fetch('/api/settings/strm-libraries', { credentials: 'include' }),
        fetch('/api/settings/top-picks', { credentials: 'include' }),
      ])

      const apertureLibs: ApertureLibrary[] = []

      // Process STRM libraries (user recommendations)
      if (strmRes.ok) {
        const strmData = await strmRes.json()
        if (strmData.libraries && Array.isArray(strmData.libraries)) {
          for (const lib of strmData.libraries) {
            if (lib.providerLibraryId) {
              apertureLibs.push({
                id: lib.id,
                name: lib.name,
                providerLibraryId: lib.providerLibraryId,
                type: 'user-recommendations',
                mediaType: lib.mediaType || 'movies',
                userId: lib.userId,
                userName: lib.userName,
              })
            }
          }
        }
      }

      // Process Top Picks libraries
      if (topPicksRes.ok) {
        const topPicksData = await topPicksRes.json()
        if (topPicksData.libraries) {
          const { movies, series } = topPicksData.libraries
          if (movies && movies.id) {
            apertureLibs.push({
              id: `top-picks-movies`,
              name: movies.name || 'Top Picks - Movies',
              providerLibraryId: movies.id,
              type: 'top-picks',
              mediaType: 'movies',
            })
          }
          if (series && series.id) {
            apertureLibs.push({
              id: `top-picks-series`,
              name: series.name || 'Top Picks - Series',
              providerLibraryId: series.id,
              type: 'top-picks',
              mediaType: 'series',
            })
          }
        }
      }

      setLibraries(apertureLibs)

      // Fetch Aperture images AND check Emby for existing images via backend
      const imagePromises = apertureLibs.map(async (lib) => {
        // Check if Emby has an image (via backend to avoid CORS issues)
        let embyImageUrl: string | undefined
        try {
          const embyCheckRes = await fetch(
            `/api/images/library/${lib.providerLibraryId}/emby-check?imageType=Primary`,
            { credentials: 'include' }
          )
          if (embyCheckRes.ok) {
            const embyData = await embyCheckRes.json()
            if (embyData.hasImage) {
              embyImageUrl = embyData.url
            }
          }
        } catch {
          // Emby check failed, continue without it
        }

        // Check if Aperture has a custom image
        try {
          const response = await fetch(`/api/images/library/${lib.providerLibraryId}?imageType=Primary`, {
            credentials: 'include',
          })
          if (response.ok) {
            const data = await response.json()
            return { 
              id: lib.providerLibraryId, 
              url: data.url, 
              isDefault: data.isDefault,
              embyUrl: embyImageUrl
            }
          }
          return { 
            id: lib.providerLibraryId, 
            url: null, 
            isDefault: false, 
            embyUrl: embyImageUrl 
          }
        } catch {
          return { 
            id: lib.providerLibraryId, 
            url: null, 
            isDefault: false, 
            embyUrl: embyImageUrl 
          }
        }
      })

      const results = await Promise.all(imagePromises)
      const imageMap: Record<string, LibraryImageInfo> = {}
      results.forEach((r) => {
        imageMap[r.id] = { 
          url: r.url || undefined, 
          isDefault: r.isDefault,
          embyUrl: r.embyUrl
        }
      })
      setLibraryImages(imageMap)
    } catch (err) {
      setError('Failed to load Aperture libraries')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchApertureLibraries()
  }, [fetchApertureLibraries])

  const handleUpload = useCallback(async (entityType: string, entityId: string, file: File) => {
    setUploadingFor(entityId)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/admin/images/${entityType}/${entityId}/default?imageType=Primary`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await response.json()
      setLibraryImages((prev) => ({
        ...prev,
        [entityId]: { url: data.url, isDefault: true },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      throw err
    } finally {
      setUploadingFor(null)
    }
  }, [])

  const handleDelete = useCallback(async (entityType: string, entityId: string) => {
    setUploadingFor(entityId)
    setError(null)

    try {
      const response = await fetch(`/api/admin/images/${entityType}/${entityId}/default?imageType=Primary`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Delete failed')
      }

      setLibraryImages((prev) => ({
        ...prev,
        [entityId]: { ...prev[entityId], url: undefined, isDefault: false },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      throw err
    } finally {
      setUploadingFor(null)
    }
  }, [])

  // Import image from Emby
  const handleImportFromEmby = useCallback(async (entityType: string, entityId: string) => {
    setUploadingFor(entityId)
    setError(null)

    try {
      const response = await fetch(`/api/admin/images/${entityType}/${entityId}/import-from-emby?imageType=Primary`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Import failed')
      }

      const data = await response.json()
      setLibraryImages((prev) => ({
        ...prev,
        [entityId]: { ...prev[entityId], url: data.url, isDefault: true },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setUploadingFor(null)
    }
  }, [])

  // Group libraries by type
  const topPicksLibraries = libraries.filter((l) => l.type === 'top-picks')
  const userRecommendationLibraries = libraries.filter((l) => l.type === 'user-recommendations')
  const movieLibraries = userRecommendationLibraries.filter((l) => l.mediaType === 'movies')
  const seriesLibraries = userRecommendationLibraries.filter((l) => l.mediaType === 'series')

  const renderLibraryCard = (lib: ApertureLibrary) => {
    const imageInfo = libraryImages[lib.providerLibraryId] || {}
    const Icon = lib.mediaType === 'movies' ? MovieIcon : TvIcon
    const TypeIcon = lib.type === 'top-picks' ? TrendingUpIcon : PersonIcon

    // Determine which image to show: Aperture override > Emby original
    const displayImageUrl = imageInfo.url || imageInfo.embyUrl
    const hasApertureImage = !!imageInfo.url
    const hasEmbyImage = !!imageInfo.embyUrl && !imageInfo.url

    return (
      <Accordion key={lib.id} sx={{ mb: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TypeIcon fontSize="small" color="action" />
              <Icon color="action" />
            </Box>
            <Typography fontWeight={500}>{lib.name}</Typography>
            {lib.userName && (
              <Chip size="small" label={lib.userName} variant="outlined" />
            )}
            {hasApertureImage && (
              <Chip
                size="small"
                label="Custom Image"
                color="success"
                variant="outlined"
              />
            )}
            {hasEmbyImage && (
              <Chip
                size="small"
                label="Emby Image"
                color="info"
                variant="outlined"
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Library image preview - 16:9 landscape, max 400px wide */}
            <Box sx={{ maxWidth: 400 }}>
              <Typography variant="subtitle2" gutterBottom>
                Library Image (16:9)
              </Typography>
              <ImageUpload
                currentImageUrl={displayImageUrl}
                isDefault={imageInfo.isDefault}
                recommendedDimensions={RECOMMENDED_DIMENSIONS.library.Primary}
                onUpload={(file) => handleUpload('library', lib.providerLibraryId, file)}
                onDelete={hasApertureImage ? () => handleDelete('library', lib.providerLibraryId) : undefined}
                loading={uploadingFor === lib.providerLibraryId}
                height={225}
                label="Drop library image (16:9 landscape)"
                showDelete={hasApertureImage}
              />
              
              {/* Import from Emby button - only show if Emby has an image but we don't have a local copy */}
              {hasEmbyImage && (
                <Tooltip title="Save a copy of the current Emby image to Aperture">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleImportFromEmby('library', lib.providerLibraryId)}
                    disabled={uploadingFor === lib.providerLibraryId}
                    sx={{ mt: 1 }}
                  >
                    Import from Emby
                  </Button>
                </Tooltip>
              )}
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary">
                {hasEmbyImage 
                  ? 'This library has an image set in Emby. You can import it to Aperture or upload a new one.'
                  : 'Upload a custom image for this Aperture-managed library. This image will be displayed in your media server.'
                }
              </Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary">
                  Library ID: {lib.providerLibraryId}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Type: {lib.type === 'top-picks' ? 'Top Picks' : 'User Recommendations'}
                </Typography>
              </Box>
              {hasApertureImage && (
                <Typography variant="caption" color="success.main" display="block" sx={{ mt: 1 }}>
                  ✓ Custom image saved in Aperture
                </Typography>
              )}
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>
    )
  }

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <ImageIcon color="primary" />
            <Box>
              <Typography variant="h6">Image Management</Typography>
              <Typography variant="body2" color="text.secondary">
                Set custom images for Aperture-created libraries
              </Typography>
            </Box>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={fetchApertureLibraries}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : libraries.length === 0 ? (
          <Alert severity="info">
            No Aperture-managed libraries found. Libraries are created when you run Top Picks or generate user recommendations.
          </Alert>
        ) : (
          <>
            <Tabs
              value={tabValue}
              onChange={(_, newValue) => setTabValue(newValue)}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab
                icon={<TrendingUpIcon />}
                iconPosition="start"
                label={`Top Picks (${topPicksLibraries.length})`}
              />
              <Tab
                icon={<PersonIcon />}
                iconPosition="start"
                label={`User Libraries (${userRecommendationLibraries.length})`}
              />
              <Tab
                icon={<CollectionsIcon />}
                iconPosition="start"
                label="Collections"
                disabled
              />
              <Tab
                icon={<PlaylistPlayIcon />}
                iconPosition="start"
                label="Playlists"
                disabled
              />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              {topPicksLibraries.length === 0 ? (
                <Alert severity="info">
                  No Top Picks libraries created yet. Enable and run Top Picks to create them.
                </Alert>
              ) : (
                <Box>
                  {topPicksLibraries.map(renderLibraryCard)}
                </Box>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {userRecommendationLibraries.length === 0 ? (
                <Alert severity="info">
                  No user recommendation libraries created yet. Generate recommendations for users to create them.
                </Alert>
              ) : (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                    Movie Libraries ({movieLibraries.length})
                  </Typography>
                  {movieLibraries.map(renderLibraryCard)}
                  
                  {seriesLibraries.length > 0 && (
                    <>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 2 }}>
                        Series Libraries ({seriesLibraries.length})
                      </Typography>
                      {seriesLibraries.map(renderLibraryCard)}
                    </>
                  )}
                </Box>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <Alert severity="info">
                Collection image management coming soon. Collections are created dynamically from Top Picks.
              </Alert>
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              <Alert severity="info">
                Playlist image management coming soon. Playlists are created for user recommendations.
              </Alert>
            </TabPanel>
          </>
        )}
      </CardContent>
    </Card>
  )
}
