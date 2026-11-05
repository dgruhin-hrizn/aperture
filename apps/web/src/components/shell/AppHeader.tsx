import { AppBar, Box, IconButton, Toolbar, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GlobalSearch } from '../GlobalSearch'
import { RunningJobsWidget } from '../RunningJobsWidget'
import { ColorModeToggle } from '@/appearance/ColorModeToggle'
import { AccountMenu } from './AccountMenu'
import { pathActive, type NavItem } from './navigation'
export function AppHeader({
  mobile,
  drawerWidth,
  items,
  onWelcome,
}: {
  mobile: boolean
  drawerWidth: number
  items: NavItem[]
  onWelcome: () => void
}) {
  const { t } = useTranslation(),
    { pathname } = useLocation(),
    navigate = useNavigate()
  const title =
    items.find((item) => pathActive(pathname, item.path))?.textKey ??
    (pathname === '/you'
      ? 'mobile.you'
      : pathname.startsWith('/settings')
        ? 'nav.settings'
        : pathname.startsWith('/admin')
          ? 'nav.admin'
          : 'common.appName')
  const detail = /^\/(movies|series|person|studio)\/.+/.test(pathname)
  return (
    <AppBar
      position={mobile ? 'static' : 'fixed'}
      elevation={0}
      sx={{
        width: mobile ? '100%' : `calc(100% - ${drawerWidth}px)`,
        ml: mobile ? 0 : `${drawerWidth}px`,
        flexShrink: 0,
        paddingTop: mobile ? 'env(safe-area-inset-top, 0px)' : 0,
        bgcolor: 'background.default',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 2, sm: 3 }, gap: 1 }}>
        {mobile && (
          <>
            {detail ? (
              <IconButton
                aria-label={t('mobile.back')}
                onClick={() => {
                  if (window.history.state?.idx > 0) void navigate(-1)
                  else void navigate('/browse')
                }}
                sx={{ width: 44, height: 44, ml: -1 }}
              >
                <ArrowBackIcon />
              </IconButton>
            ) : (
              <Box
                component={Link}
                to="/encore"
                aria-label={t('encore.open')}
                sx={{ display: 'flex', alignItems: 'center' }}
              >
                <Box component="img" src="/aperture.svg" alt="" sx={{ width: 30, height: 30 }} />
              </Box>
            )}
            <Typography
              component="h1"
              fontWeight={700}
              sx={{ flex: 1, minWidth: 0, fontSize: 20 }}
              noWrap
            >
              {t(
                pathname === '/browse'
                  ? 'mobile.library'
                  : pathname === '/watching'
                    ? 'mobile.watching'
                    : title
              )}
            </Typography>
          </>
        )}
        {!mobile && <Box sx={{ flex: 1 }} />}
        {!mobile && <RunningJobsWidget />}
        <GlobalSearch />
        {!mobile && (
          <>
            <ColorModeToggle />
            <AccountMenu onWelcome={onWelcome} />
          </>
        )}
      </Toolbar>
    </AppBar>
  )
}
