import { useState, type MouseEvent } from 'react'
import {
  Alert,
  Box,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Snackbar,
  Tooltip,
} from '@mui/material'
import AddToQueueOutlinedIcon from '@mui/icons-material/AddToQueueOutlined'
import FavoriteIcon from '@mui/icons-material/Favorite'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../hooks/useAuth'
import { useUserRatings } from '../../../hooks/useUserRatings'
import { useWatching } from '../../../hooks/useWatching'
import { ContentRatingDialog, ContentPlaylistDialog } from './ContentActionDialogs'
import type { ContentItem } from './types'

const iconButton = { width: 44, height: 44, flexShrink: 0, borderRadius: '50%' }

export function ContentCardActions({
  item,
  detailsHref,
  playHref,
  onPlay,
  featured,
}: {
  item: ContentItem
  detailsHref?: string
  playHref?: string
  onPlay?: (id: string, href: string) => void
  featured: boolean
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const ratings = useUserRatings()
  const watching = useWatching()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [dialog, setDialog] = useState<'rating' | 'playlist' | null>(null)
  const [watchingBusy, setWatchingBusy] = useState(false)
  const [watchingError, setWatchingError] = useState(false)

  const library =
    (item.availability ?? 'library') === 'library' &&
    detailsHref === `/${item.type === 'movie' ? 'movies' : 'series'}/${item.id}`
  const canPlaylist = library && item.type === 'movie' && user?.provider === 'emby'
  const canWatch = library && item.type === 'series'
  const currentRating = library ? ratings.getRating(item.type, item.id) : null
  const isWatching = canWatch && watching.isWatching(item.id)
  const watchLabel = t(
    isWatching ? 'mediaDetail.hero.removeFromWatchingList' : 'mediaDetail.hero.addToWatchingList'
  )
  const ratingLabel = t('browse.listItem.yourRating')
  const playlistLabel = t('encore.actionOperations.create')
  const detailsLabel = t('assistantToolUi.viewDetails')
  const menuLabel = t('assistantToolUi.mediaActions')
  const ratingIcon =
    currentRating === null ? <FavoriteBorderIcon /> : <FavoriteIcon color="error" />
  const watchingIcon = isWatching ? (
    <PlaylistAddCheckIcon color="primary" />
  ) : (
    <AddToQueueOutlinedIcon />
  )
  const external = !detailsHref?.startsWith('/')
  const detailsLink = external ? { target: '_blank', rel: 'noopener noreferrer' } : {}

  function openDialog(next: 'rating' | 'playlist') {
    setMenuAnchor(null)
    setDialog(next)
  }

  async function toggleWatching() {
    setMenuAnchor(null)
    setWatchingBusy(true)
    try {
      await watching.toggleWatching(item.id)
    } catch {
      setWatchingError(true)
      await watching.refresh()
    } finally {
      setWatchingBusy(false)
    }
  }

  function play(event: MouseEvent<HTMLAnchorElement>) {
    if (!onPlay || !playHref) return
    event.preventDefault()
    onPlay(item.id, playHref)
  }

  if (!playHref && !detailsHref) return null
  return (
    <Box
      role="group"
      aria-label={`${menuLabel} · ${item.name}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.25,
        mt: 'auto',
        ...(featured && library && { justifyContent: 'space-between', maxWidth: 236 }),
      }}
    >
      {playHref && (
        <Tooltip title={t('assistantToolUi.play')}>
          <IconButton
            aria-label={t('assistantToolUi.play')}
            href={playHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={play}
            color="primary"
            sx={{ ...iconButton, bgcolor: 'action.selected' }}
          >
            <PlayArrowRoundedIcon />
          </IconButton>
        </Tooltip>
      )}
      {featured && library && (
        <Tooltip
          title={currentRating === null ? ratingLabel : `${ratingLabel} · ${currentRating}/10`}
        >
          <span>
            <IconButton
              aria-label={ratingLabel}
              sx={iconButton}
              disabled={ratings.loading}
              onClick={() => openDialog('rating')}
            >
              {ratingIcon}
            </IconButton>
          </span>
        </Tooltip>
      )}
      {featured && canPlaylist && (
        <Tooltip title={playlistLabel}>
          <IconButton
            aria-label={playlistLabel}
            sx={iconButton}
            onClick={() => openDialog('playlist')}
          >
            <PlaylistAddOutlinedIcon />
          </IconButton>
        </Tooltip>
      )}
      {featured && canWatch && (
        <Tooltip title={watchLabel}>
          <span>
            <IconButton
              aria-label={watchLabel}
              disabled={watching.loading || watchingBusy}
              onClick={() => void toggleWatching()}
              sx={iconButton}
            >
              {watchingIcon}
            </IconButton>
          </span>
        </Tooltip>
      )}
      {detailsHref && (featured || !library) && (
        <Tooltip title={detailsLabel}>
          <IconButton aria-label={detailsLabel} href={detailsHref} {...detailsLink} sx={iconButton}>
            <InfoOutlinedIcon />
          </IconButton>
        </Tooltip>
      )}
      {!featured && library && (
        <>
          <Tooltip title={menuLabel}>
            <IconButton
              aria-label={menuLabel}
              aria-haspopup="menu"
              aria-expanded={Boolean(menuAnchor)}
              onClick={(event) => setMenuAnchor(event.currentTarget)}
              sx={iconButton}
            >
              <MoreHorizIcon />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
          >
            <MenuItem component="a" href={detailsHref}>
              <ListItemIcon>
                <InfoOutlinedIcon fontSize="small" />
              </ListItemIcon>
              {detailsLabel}
            </MenuItem>
            <MenuItem disabled={ratings.loading} onClick={() => openDialog('rating')}>
              <ListItemIcon>{ratingIcon}</ListItemIcon>
              {ratingLabel}
            </MenuItem>
            {canPlaylist && (
              <MenuItem onClick={() => openDialog('playlist')}>
                <ListItemIcon>
                  <PlaylistAddOutlinedIcon fontSize="small" />
                </ListItemIcon>
                {playlistLabel}
              </MenuItem>
            )}
            {canWatch && (
              <MenuItem
                disabled={watching.loading || watchingBusy}
                onClick={() => void toggleWatching()}
              >
                <ListItemIcon>{watchingIcon}</ListItemIcon>
                {watchLabel}
              </MenuItem>
            )}
          </Menu>
        </>
      )}
      {dialog === 'rating' && (
        <ContentRatingDialog
          title={item.name}
          value={currentRating}
          save={(rating) => ratings.setRating(item.type, item.id, rating)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'playlist' && (
        <ContentPlaylistDialog item={item} onClose={() => setDialog(null)} />
      )}
      {watchingError && (
        <Snackbar open autoHideDuration={6000} onClose={() => setWatchingError(false)}>
          <Alert severity="error" onClose={() => setWatchingError(false)}>
            {t('assistantToolUi.watchingSaveFailed')}
          </Alert>
        </Snackbar>
      )}
    </Box>
  )
}
