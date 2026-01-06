import React, { useState, useCallback, useRef } from 'react'
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
  /** Label for the upload area */
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
  label = 'Drag & drop an image here, or click to browse',
  showDelete = true,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        return `Invalid file type. Accepted: ${ACCEPTED_TYPES.map((t) => t.split('/')[1]).join(', ')}`
      }

      if (file.size > MAX_FILE_SIZE) {
        return `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
      }

      return null
    },
    []
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
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploadProgress(false)
      }
    },
    [onUpload, validateFile]
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
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setUploadProgress(false)
    }
  }, [onDelete, disabled, loading])

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
            alt="Current image"
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
                Click or drag to replace
              </Typography>
            </Box>
          </Fade>
        )}

        {/* Default badge */}
        {currentImageUrl && isDefault && (
          <Tooltip title="This is the default image set by admin">
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
                Default
              </Typography>
            </Box>
          </Tooltip>
        )}

        {/* Delete button */}
        {currentImageUrl && showDelete && onDelete && !isLoading && (
          <Tooltip title={isDefault ? 'Remove custom image (revert to default)' : 'Delete image'}>
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
              {label}
            </Typography>
            {recommendedDimensions && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Recommended: {recommendedDimensions.width} × {recommendedDimensions.height}px
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
          Recommended: {recommendedDimensions.width} × {recommendedDimensions.height}px
        </Typography>
      )}
    </Box>
  )
}

