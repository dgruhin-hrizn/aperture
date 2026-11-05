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
    <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pt: { xs: 1.25, sm: 5 }, pb: 1, maxWidth: 650, mx: 'auto' }}>
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
          fontSize: { xs: 'clamp(24px, 6.8vw, 32px)', sm: 42 },
          fontWeight: 750,
          lineHeight: 1.15,
          letterSpacing: '-.045em',
          mt: { xs: 0.5, sm: 1 },
          mb: { xs: 0.75, sm: 1.5 },
          maxWidth: 350,
        }}
      >
        {t('mobile.welcomeTitle')}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ lineHeight: { xs: 1.5, sm: 1.7 }, maxWidth: 420, mb: { xs: 1.5, sm: 3 } }}
      >
        {t('mobile.welcomeIntro')}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: { xs: 0.75, sm: 1.25 } }}>
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
              p: { xs: 1, sm: 1.75 },
              borderRadius: { xs: 2, sm: '24px' },
              borderColor: 'divider',
              textTransform: 'none',
              color: 'text.primary',
              minHeight: { xs: 82, sm: 116 },
              bgcolor: 'background.paper',
              lineHeight: 1.4,
            }}
          >
            <Box sx={{ color: 'primary.main', mb: { xs: 0.25, sm: 1 } }}>{prompt.icon}</Box>
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
        sx={{ display: 'block', mt: { xs: 1, sm: 2 }, fontSize: 11, lineHeight: 1.6 }}
      >
        {t('mobile.suggestionFirst')}
      </Typography>
    </Box>
  )
}
