import React, { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  IconButton,
  Alert,
  Tooltip,
  Fade,
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteIcon from '@mui/icons-material/Delete'
import ImageIcon from '@mui/icons-material/Image'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

export interface ImageUploadProps {
  /** Current image URL (if any) */
  currentImageUrl?: string | null
  /** Whether the current image is a default (admin-set) image */
  isDefault?: boolean
  /** Recommended dimensions for this image type */
  recommendedDimensions?: { width: number; height: number }
  /** Callback when a new image is uploaded */
  onUpload: (file: File) => Promise<void>
  /** Callback when the current image is deleted */
  onDelete?: () => Promise<void>
  /** Whether the component is in a loading state */
  loading?: boolean
  /** Whether the component is disabled */
  disabled?: boolean
  /** Custom height for the drop zone */
  height?: number | string
  /** Label for the upload area (defaults to translated drop hint) */
  label?: string
  /** Whether to show the delete button */
  showDelete?: boolean
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function ImageUpload({
  currentImageUrl,
  isDefault = false,
  recommendedDimensions,
  onUpload,
  onDelete,
  loading = false,
  disabled = false,
  height = 200,
  label,
  showDelete = true,
}: ImageUploadProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        return t('imageUpload.invalidType', {
          types: ACCEPTED_TYPES.map((x) => x.split('/')[1]).join(', '),
        })
      }

      if (file.size > MAX_FILE_SIZE) {
        return t('imageUpload.fileTooLarge', { mb: MAX_FILE_SIZE / 1024 / 1024 })
      }

      return null
    },
    [t]
  )

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }

      setError(null)
      setUploadProgress(true)

      try {
        await onUpload(file)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('imageUpload.uploadFailed'))
      } finally {
        setUploadProgress(false)
      }
    },
    [onUpload, validateFile, t]
  )

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (disabled || loading || uploadProgress) return

      const files = e.dataTransfer.files
      if (files.length > 0) {
        handleFile(files[0])
      }
    },
    [disabled, loading, uploadProgress, handleFile]
  )

  const handleClick = useCallback(() => {
    if (disabled || loading || uploadProgress) return
    fileInputRef.current?.click()
  }, [disabled, loading, uploadProgress])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        handleFile(files[0])
      }
      // Reset input so the same file can be selected again
      e.target.value = ''
    },
    [handleFile]
  )

  const handleDelete = useCallback(async () => {
    if (!onDelete || disabled || loading) return

    setError(null)
    setUploadProgress(true)

    try {
      await onDelete()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('imageUpload.deleteFailed'))
    } finally {
      setUploadProgress(false)
    }
  }, [onDelete, disabled, loading, t])

  const isLoading = loading || uploadProgress

  return (
    <Box>
      <Paper
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        elevation={isDragging ? 8 : 2}
        sx={{
          position: 'relative',
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled || isLoading ? 'default' : 'pointer',
          border: '2px dashed',
          borderColor: isDragging
            ? 'primary.main'
            : error
              ? 'error.main'
              : 'divider',
          borderRadius: 2,
          backgroundColor: isDragging
            ? 'action.hover'
            : currentImageUrl
              ? 'transparent'
              : 'background.paper',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: disabled || isLoading ? 'divider' : 'primary.main',
            backgroundColor: disabled || isLoading ? 'background.paper' : 'action.hover',
          },
        }}
      >
        {/* Background image if present */}
        {currentImageUrl && (
          <Box
            component="img"
            src={currentImageUrl}
            alt={t('imageUpload.altCurrent')}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: isLoading ? 0.5 : 1,
              transition: 'opacity 0.2s',
            }}
          />
        )}

        {/* Overlay for existing image */}
        {currentImageUrl && !isLoading && (
          <Fade in={!isDragging}>
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.2s',
                '&:hover': {
                  opacity: 1,
                },
              }}
            >
              <CloudUploadIcon sx={{ fontSize: 48, color: 'white', mb: 1 }} />
              <Typography color="white" variant="body2">
                {t('imageUpload.clickOrDragReplace')}
              </Typography>
            </Box>
          </Fade>
        )}

        {/* Default badge */}
        {currentImageUrl && isDefault && (
          <Tooltip title={t('imageUpload.tooltipDefaultBadge')}>
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                backgroundColor: 'primary.main',
                borderRadius: 1,
                px: 1,
                py: 0.25,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 14, color: 'white' }} />
              <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
                {t('imageUpload.badgeDefault')}
              </Typography>
            </Box>
          </Tooltip>
        )}

        {/* Delete button */}
        {currentImageUrl && showDelete && onDelete && !isLoading && (
          <Tooltip
            title={
              isDefault ? t('imageUpload.tooltipDeleteRevert') : t('imageUpload.tooltipDelete')
            }
          >
            <IconButton
              onClick={(e) => {
                e.stopPropagation()
                handleDelete()
              }}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'error.main',
                },
              }}
              size="small"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }}
          >
            <CircularProgress size={48} sx={{ color: 'white' }} />
          </Box>
        )}

        {/* Empty state / drop zone content */}
        {!currentImageUrl && !isLoading && (
          <>
            {isDragging ? (
              <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 1 }} />
            ) : (
              <ImageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 1 }} />
            )}
            <Typography
              variant="body1"
              color={isDragging ? 'primary' : 'text.secondary'}
              textAlign="center"
              sx={{ px: 2 }}
            >
              {label ?? t('imageUpload.dropLabel')}
            </Typography>
            {recommendedDimensions && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                {t('imageUpload.recommended', {
                  w: recommendedDimensions.width,
                  h: recommendedDimensions.height,
                })}
              </Typography>
            )}
          </>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </Paper>

      {/* Error message */}
      {error && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Dimensions hint */}
      {currentImageUrl && recommendedDimensions && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {t('imageUpload.recommended', {
            w: recommendedDimensions.width,
            h: recommendedDimensions.height,
          })}
        </Typography>
      )}
    </Box>
  )
}


