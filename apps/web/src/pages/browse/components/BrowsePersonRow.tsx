import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, Box, Typography } from '@mui/material'
import { usePersonPortrait } from '../../../hooks/usePersonPortrait'
import type { BrowsePerson } from '../types'
import { personSubtitle } from '../utils/personSubtitle'

interface BrowsePersonRowProps {
  person: BrowsePerson
  onNavigate: () => void
}

export function BrowsePersonRow({ person, onNavigate }: BrowsePersonRowProps) {
  const { t } = useTranslation()
  const { displaySrc, phase, onImageError } = usePersonPortrait({
    personName: person.name,
    mediaImageUrl: `/api/media/images/Persons/${encodeURIComponent(person.name)}/Images/Primary`,
    fetchTmdbFallback: true,
  })
  const subtitle = personSubtitle(person, t)
  const [avatarImgShown, setAvatarImgShown] = useState(false)

  useEffect(() => {
    setAvatarImgShown(false)
  }, [displaySrc])

  return (
    <Box
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
