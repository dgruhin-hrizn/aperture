import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, Box, Paper, Typography } from '@mui/material'
import { usePersonPortrait } from '../../../hooks/usePersonPortrait'
import type { BrowsePerson } from '../types'
import { personSubtitle } from '../utils/personSubtitle'

interface BrowsePersonCardProps {
  person: BrowsePerson
  onNavigate: () => void
}

export function BrowsePersonCard({ person, onNavigate }: BrowsePersonCardProps) {
  const { t } = useTranslation()
  const { displaySrc, phase, onImageError } = usePersonPortrait({
    personName: person.name,
    mediaImageUrl: `/api/media/images/Persons/${encodeURIComponent(person.name)}/Images/Primary`,
    fetchTmdbFallback: true,
  })
  const subtitle = personSubtitle(person, t)
  const [cardImgShown, setCardImgShown] = useState(false)

  useEffect(() => {
    setCardImgShown(false)
  }, [displaySrc])

  return (
    <Paper
      elevation={0}
      onClick={onNavigate}
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: 4,
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '2/3',
          width: '100%',
          bgcolor: 'action.hover',
        }}
      >
        {phase !== 'none' && displaySrc ? (
          <Box
            component="img"
            src={displaySrc}
            alt=""
            onLoad={() => setCardImgShown(true)}
            onError={onImageError}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              opacity: cardImgShown ? 1 : 0,
              transition: 'opacity 0.2s ease',
            }}
          />
        ) : (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%">
            <Avatar
              sx={{
                width: '45%',
                height: 'auto',
                aspectRatio: '1',
                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
              }}
            >
              {person.name.charAt(0)}
            </Avatar>
          </Box>
        )}
      </Box>
      <Box sx={{ p: 1.25 }}>
        <Typography
          variant="subtitle2"
          fontWeight={600}
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: 1.3,
            minHeight: '2.6em',
          }}
        >
          {person.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
          {subtitle}
        </Typography>
      </Box>
    </Paper>
  )
}
