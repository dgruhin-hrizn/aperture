import { Box, Button, Typography } from '@mui/material'
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import UpcomingOutlinedIcon from '@mui/icons-material/UpcomingOutlined'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'
import { useTranslation } from 'react-i18next'
import { useAui } from '@assistant-ui/react'
export function MobileWelcome() {
  const { t } = useTranslation(),
    composer = useAui().composer
  const prompts = [
    { id: 'tonight', icon: <NightsStayOutlinedIcon /> },
    { id: 'plan', icon: <EventAvailableOutlinedIcon /> },
    { id: 'releases', icon: <UpcomingOutlinedIcon /> },
    { id: 'curate', icon: <PlaylistPlayIcon /> },
  ]
  return (
    <Box sx={{ px: 2.5, pt: { xs: 3, sm: 5 }, pb: 2, maxWidth: 650, mx: 'auto' }}>
      <Typography
        variant="overline"
        color="primary.main"
        sx={{ fontSize: 10, letterSpacing: '.14em', fontWeight: 700 }}
      >
        {t('mobile.welcomeEyebrow')}
      </Typography>
      <Typography
        component="h2"
        sx={{
          fontSize: 'clamp(30px, 8.2vw, 42px)',
          fontWeight: 750,
          lineHeight: 1.15,
          letterSpacing: '-.045em',
          mt: 1,
          mb: 1.5,
          maxWidth: 350,
        }}
      >
        {t('mobile.welcomeTitle')}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ lineHeight: 1.7, maxWidth: 420, mb: 3 }}
      >
        {t('mobile.welcomeIntro')}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
        {prompts.map((prompt) => (
          <Button
            variant="outlined"
            key={prompt.id}
            onClick={() => {
              composer.setText(t(`mobile.prompts.${prompt.id}.message`))
              composer.send()
            }}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              textAlign: 'start',
              p: 1.75,
              borderRadius: 3.5,
              borderColor: 'divider',
              textTransform: 'none',
              color: 'text.primary',
              minHeight: 116,
              bgcolor: 'background.default',
              lineHeight: 1.4,
            }}
          >
            <Box sx={{ color: 'primary.main', mb: 1 }}>{prompt.icon}</Box>
            <Typography fontSize={13} fontWeight={700}>
              {t(`mobile.prompts.${prompt.id}.title`)}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: 11, lineHeight: 1.5, mt: 0.5 }}
            >
              {t(`mobile.prompts.${prompt.id}.description`)}
            </Typography>
          </Button>
        ))}
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 2, fontSize: 11, lineHeight: 1.6 }}
      >
        {t('mobile.suggestionFirst')}
      </Typography>
    </Box>
  )
}
