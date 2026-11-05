import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, Box, Typography } from '@mui/material'
import { useVisibleImage } from '../../../hooks/useVisibleImage'
import { usePersonPortrait } from '../../../hooks/usePersonPortrait'
import type { BrowsePerson } from '../types'
import { personSubtitle } from '../utils/personSubtitle'

interface BrowsePersonRowProps {
  person: BrowsePerson
  onNavigate: () => void
}

export function BrowsePersonRow({ person, onNavigate }: BrowsePersonRowProps) {
  const { t } = useTranslation()
  const { imageRef, visible } = useVisibleImage()
  const { displaySrc, phase, onImageError } = usePersonPortrait({
    enabled: visible,
    tmdbImageUrl: person.tmdbProfilePath
      ? `https://image.tmdb.org/t/p/w185${person.tmdbProfilePath}`
      : null,
    personName: person.name,
  })
  const subtitle = personSubtitle(person, t)
  const [avatarImgShown, setAvatarImgShown] = useState(false)

  useEffect(() => {
    setAvatarImgShown(false)
  }, [displaySrc])

  return (
    <Box
      ref={imageRef}
      onClick={onNavigate}
      display="flex"
      alignItems="center"
      gap={2}
      bgcolor="background.paper"
      borderRadius={2}
      p={2}
      sx={{
        cursor: 'pointer',
        transition: 'background-color 0.15s',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Avatar
        src={phase === 'none' ? undefined : displaySrc}
        onError={onImageError}
        alt=""
        slotProps={{
          img: {
            loading: 'lazy',
            decoding: 'async',
            onLoad: () => setAvatarImgShown(true),
            style: {
              opacity: displaySrc ? (avatarImgShown ? 1 : 0) : 1,
              transition: 'opacity 0.2s ease',
            },
          },
        }}
        sx={{ width: 56, height: 56 }}
      >
        {person.name.charAt(0)}
      </Avatar>
      <Box flex={1} minWidth={0}>
        <Typography variant="subtitle1" fontWeight={600} noWrap>
          {person.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>
    </Box>
  )
}
