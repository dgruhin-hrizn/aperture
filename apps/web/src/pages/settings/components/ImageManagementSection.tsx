import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  Button,
  Grid,
} from '@mui/material'
import ImageIcon from '@mui/icons-material/Image'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import RefreshIcon from '@mui/icons-material/Refresh'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { ImageUpload } from '../../../components/ImageUpload'

// The 4 global library types
const LIBRARY_TYPES = [
  {
    id: 'ai-recs-movies',
    name: 'AI Recommendations - Movies',
    description: 'Image applied to all users\' AI movie recommendation libraries',
    icon: AutoAwesomeIcon,
    secondaryIcon: MovieIcon,
  },
  {
    id: 'ai-recs-series',
    name: 'AI Recommendations - Series',
    description: 'Image applied to all users\' AI series recommendation libraries',
    icon: AutoAwesomeIcon,
    secondaryIcon: TvIcon,
  },
  {
    id: 'top-picks-movies',
    name: 'Top Picks - Movies',
    description: 'Image for the global Top Picks movies library',
    icon: TrendingUpIcon,
    secondaryIcon: MovieIcon,
  },
  {
    id: 'top-picks-series',
    name: 'Top Picks - Series',
    description: 'Image for the global Top Picks series library',
    icon: TrendingUpIcon,
    secondaryIcon: TvIcon,
  },
]

interface LibraryTypeImageInfo {
  url?: string
  isDefault?: boolean
}

const RECOMMENDED_DIMENSIONS = {
  width: 1920,
  height: 1080, // 16:9 landscape banner
}

export function ImageManagementSection() {
  const [loading, setLoading] = useState(true)
  const [images, setImages] = useState<Record<string, LibraryTypeImageInfo>>({})
  const [error, setError] = useState<string | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  // Fetch images for all library types
  const fetchImages = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const imagePromises = LIBRARY_TYPES.map(async (libraryType) => {
        try {
          const response = await fetch(`/api/images/library/${libraryType.id}?imageType=Primary`, {
            credentials: 'include',
          })
          if (response.ok) {
            const data = await response.json()
            return { id: libraryType.id, url: data.url, isDefault: data.isDefault }
          }
          return { id: libraryType.id, url: null, isDefault: false }
        } catch {
          return { id: libraryType.id, url: null, isDefault: false }
        }
      })

      const results = await Promise.all(imagePromises)
      const imageMap: Record<string, LibraryTypeImageInfo> = {}
      results.forEach((r) => {
        imageMap[r.id] = { url: r.url || undefined, isDefault: r.isDefault }
      })
      setImages(imageMap)
    } catch (err) {
      setError('Failed to load library images')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  const handleUpload = useCallback(async (libraryTypeId: string, file: File) => {
    setUploadingFor(libraryTypeId)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/admin/images/library/${libraryTypeId}/default?imageType=Primary`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await response.json()
      setImages((prev) => ({
        ...prev,
        [libraryTypeId]: { url: data.url, isDefault: true },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      throw err
    } finally {
      setUploadingFor(null)
    }
  }, [])

  const handleDelete = useCallback(async (libraryTypeId: string) => {
    setUploadingFor(libraryTypeId)
    setError(null)

    try {
      const response = await fetch(`/api/admin/images/library/${libraryTypeId}/default?imageType=Primary`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Delete failed')
      }

      setImages((prev) => ({
        ...prev,
        [libraryTypeId]: { url: undefined, isDefault: false },
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      throw err
    } finally {
      setUploadingFor(null)
    }
  }, [])

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <ImageIcon color="primary" />
            <Box>
              <Typography variant="h6">Library Images</Typography>
              <Typography variant="body2" color="text.secondary">
                Set global images for Aperture library types. Images apply to all users' libraries of each type.
              </Typography>
            </Box>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={fetchImages}
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
        ) : (
          <Grid container spacing={3}>
            {LIBRARY_TYPES.map((libraryType) => {
              const imageInfo = images[libraryType.id] || {}
              const Icon = libraryType.icon
              const SecondaryIcon = libraryType.secondaryIcon
              const hasImage = !!imageInfo.url

              return (
                <Grid item xs={12} md={6} key={libraryType.id}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <Icon color="primary" fontSize="small" />
                        <SecondaryIcon color="action" fontSize="small" />
                        <Typography variant="subtitle1" fontWeight={600}>
                          {libraryType.name}
                        </Typography>
                        {hasImage && (
                          <Chip
                            size="small"
                            label="Set"
                            color="success"
                            variant="outlined"
                            sx={{ ml: 'auto' }}
                          />
                        )}
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {libraryType.description}
                      </Typography>

                      <Box sx={{ maxWidth: 400 }}>
                        <ImageUpload
                          currentImageUrl={imageInfo.url}
                          isDefault={imageInfo.isDefault}
                          recommendedDimensions={RECOMMENDED_DIMENSIONS}
                          onUpload={(file) => handleUpload(libraryType.id, file)}
                          onDelete={hasImage ? () => handleDelete(libraryType.id) : undefined}
                          loading={uploadingFor === libraryType.id}
                          height={225}
                          label="Drop library image (16:9)"
                          showDelete={hasImage}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )}

        <Alert severity="info" sx={{ mt: 3 }}>
          Library images are pushed to your media server when you run "Sync Libraries" or generate recommendations.
          Recommended size: 1920×1080 (16:9 landscape).
        </Alert>
      </CardContent>
    </Card>
  )
}
