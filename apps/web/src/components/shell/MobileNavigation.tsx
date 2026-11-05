import { Badge, BottomNavigation, BottomNavigationAction, Box, alpha } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined'
import VideoLibraryOutlinedIcon from '@mui/icons-material/VideoLibraryOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import SubscriptionsOutlinedIcon from '@mui/icons-material/SubscriptionsOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import { useTranslation } from 'react-i18next'
import { mobileDestination } from './navigation'
export function MobileNavigation({
  watchingEnabled,
  running,
}: {
  watchingEnabled: boolean
  running: boolean
}) {
  const { t } = useTranslation(),
    { pathname } = useLocation(),
    selected = mobileDestination(pathname, watchingEnabled)
  const destinations = [
    {
      id: 'discover',
      path: '/discovery',
      label: t('mobile.discover'),
      icon: <ExploreOutlinedIcon />,
    },
    {
      id: 'library',
      path: '/browse',
      label: t('mobile.library'),
      icon: <VideoLibraryOutlinedIcon />,
    },
    {
      id: 'encore',
      path: '/encore',
      label: t('mobile.encore'),
      icon: (
        <Badge color="success" variant="dot" invisible={!running}>
          <AutoAwesomeOutlinedIcon />
        </Badge>
      ),
    },
    {
      id: 'watching',
      path: watchingEnabled ? '/watching' : '/recommendations',
      label: t(watchingEnabled ? 'mobile.watching' : 'mobile.picks'),
      icon: <SubscriptionsOutlinedIcon />,
    },
    { id: 'you', path: '/you', label: t('mobile.you'), icon: <PersonOutlineIcon /> },
  ]
  return (
    <Box
      component="nav"
      aria-label={t('mobile.primaryNavigation')}
      sx={{
        flexShrink: 0,
        pb: 'env(safe-area-inset-bottom, 0px)',
        px: 1,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.96),
        backdropFilter: 'blur(20px)',
        boxShadow: '0 -8px 32px rgba(0,0,0,.04)',
      }}
    >
      <BottomNavigation
        value={selected}
        showLabels
        sx={{
          height: 72,
          bgcolor: 'transparent',
          gap: 0.25,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 0,
            maxWidth: 'none',
            minHeight: 56,
            px: 0.5,
            color: 'text.secondary',
            gap: 0.5,
            borderRadius: 3,
            my: 0.75,
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: 11,
            fontWeight: 600,
            mt: 0.5,
            '&.Mui-selected': { fontSize: 11 },
          },
          '& .Mui-selected': { color: 'primary.main' },
        }}
      >
        {destinations.map((item) => (
          <BottomNavigationAction
            key={item.id}
            component={Link}
            to={item.path}
            value={item.id}
            label={item.label}
            aria-current={selected === item.id ? 'page' : undefined}
            aria-label={item.id === 'encore' && running ? t('mobile.encoreWorking') : item.label}
            icon={item.icon}
            sx={
              item.id === 'encore'
                ? {
                    bgcolor: (theme) =>
                      alpha(theme.palette.primary.main, selected === 'encore' ? 0.16 : 0.08),
                    '& .MuiSvgIcon-root': { fontSize: 27 },
                  }
                : undefined
            }
          />
        ))}
      </BottomNavigation>
    </Box>
  )
}
