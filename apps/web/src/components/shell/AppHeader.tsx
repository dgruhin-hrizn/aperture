import { AppBar, Box, IconButton, Toolbar, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEncore } from '../assistant/encoreContext'
import { GlobalSearch } from '../GlobalSearch'
import { RunningJobsWidget } from '../RunningJobsWidget'
import { ColorModeToggle } from '@/appearance/ColorModeToggle'
import { AccountMenu } from './AccountMenu'
import { pathActive, type NavItem } from './navigation'

const pageTitles: Record<string, string> = {
  '/movies': 'browse.movies.title',
  '/series': 'browse.series.title',
  '/search': 'search.title',
  '/franchises': 'browse.franchises.title',
  '/admin/gaps': 'nav.gapAnalysis',
}

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
  const encore = useEncore()
  const { t } = useTranslation(),
    { pathname } = useLocation(),
    navigate = useNavigate()
  const title =
    pageTitles[pathname] ??
    items.find((item) => pathActive(pathname, item.path))?.textKey ??
    (pathname === '/you'
      ? 'mobile.you'
      : pathname.startsWith('/settings')
        ? 'nav.settings'
        : pathname.startsWith('/admin')
          ? 'nav.admin'
          : 'common.appName')
  const adminDetail = pathname.startsWith('/admin/users/')
  const detail = adminDetail || /^\/(movies|series|person|studio)\/.+/.test(pathname)
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
      <Toolbar
        sx={{
          minHeight: mobile ? 'calc(var(--ap-header-height) - 1px)' : 64,
          px: mobile ? 'var(--ap-page-gutter)' : 3,
          gap: 1,
        }}
      >
        {mobile && (
          <>
            {detail ? (
              <IconButton
                aria-label={t('mobile.back')}
                onClick={() => {
                  if (window.history.state?.idx > 0) void navigate(-1)
                  else void navigate(adminDetail ? '/admin/users' : '/browse')
                }}
                sx={{ width: 44, height: 44, ml: -1 }}
              >
                <ArrowBackIcon />
              </IconButton>
            ) : (
              <IconButton
                onClick={() => encore.openEncore('chat')}
                aria-label={t('encore.open')}
                sx={{ display: 'grid', placeItems: 'center', width: 44, height: 44, ml: -1 }}
              >
                <Box
                  component="img"
                  src="/aperture.svg"
                  alt=""
                  sx={{ width: { xs: 26, sm: 30 }, height: { xs: 26, sm: 30 } }}
                />
              </IconButton>
            )}
            <Typography
              component="h1"
              fontWeight={700}
              sx={{ flex: 1, minWidth: 0, fontSize: { xs: 18, sm: 20 } }}
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
