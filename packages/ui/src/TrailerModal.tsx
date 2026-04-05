import type { ComponentType } from 'react'
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Typography,
} from '@mui/material'
import CloseIconImport from '@mui/icons-material/Close'

const CloseIcon = CloseIconImport as unknown as ComponentType<{ sx?: object }>

const YT_ID = /^[A-Za-z0-9_-]{11}$/

/**
 * Convert a YouTube watch, share, or embed URL to an embed URL for iframe playback.
 */
export function youtubeWatchUrlToEmbedUrl(watchUrl: string): string | null {
  try {
    const u = new URL(watchUrl)
    const host = u.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      if (id && YT_ID.test(id)) {
        return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`
      }
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.pathname.startsWith('/embed/')) {
        const id = u.pathname.slice('/embed/'.length).split('/')[0]
        if (id && YT_ID.test(id)) {
          return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`
        }
      }
      if (u.pathname === '/watch' || u.pathname === '/watch/') {
        const v = u.searchParams.get('v')
        if (v && YT_ID.test(v)) {
          return `https://www.youtube.com/embed/${v}?autoplay=1&rel=0`
        }
      }
    }
  } catch {
    return null
  }
  return null
}

export interface TrailerModalProps {
  open: boolean
  onClose: () => void
  /** YouTube page URL (watch, short, or embed). */
  watchUrl: string | null
  /** Dialog title; defaults to "Trailer". */
  title?: string | null
}

/**
 * Full-screen–friendly dialog with a 16:9 YouTube iframe (embedded player only, not the full site).
 */
export function TrailerModal({ open, onClose, watchUrl, title }: TrailerModalProps) {
  const embedUrl = watchUrl ? youtubeWatchUrlToEmbedUrl(watchUrl) : null
  const heading = title?.trim() || 'Trailer'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      scroll="body"
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          pr: 1,
        }}
      >
        <Typography component="span" variant="h6" noWrap sx={{ flex: 1 }}>
          {heading}
        </Typography>
        <IconButton aria-label="Close trailer" onClick={onClose} edge="end" size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 0, pb: 2 }}>
        {open && embedUrl && (
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              pt: '56.25%',
              bgcolor: 'black',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <Box
              component="iframe"
              src={embedUrl}
              title={heading}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                border: 0,
              }}
            />
          </Box>
        )}
        {open && watchUrl && !embedUrl && (
          <Typography variant="body2" color="text.secondary">
            This trailer link could not be embedded.{' '}
            <Link href={watchUrl} target="_blank" rel="noopener noreferrer">
              Open on YouTube
            </Link>
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  )
}
