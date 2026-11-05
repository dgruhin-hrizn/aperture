import { Badge, Box, ButtonBase, alpha, useTheme } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { mobileDestination } from './navigation'
import { MobileNavIcon } from './MobileNavIcon'

export function MobileNavigation({
  watchingEnabled,
  running,
}: {
  watchingEnabled: boolean
  running: boolean
}) {
  const { t } = useTranslation(),
    theme = useTheme(),
    { pathname } = useLocation(),
    selected = mobileDestination(pathname, watchingEnabled),
    dark = theme.palette.mode === 'dark'
  const destinations = [
    { id: 'discover', path: '/discovery', label: t('mobile.discover') },
    { id: 'library', path: '/browse', label: t('mobile.library') },
    { id: 'encore', path: '/encore', label: t('mobile.encore') },
    {
      id: 'watching',
      path: watchingEnabled ? '/watching' : '/recommendations',
      label: t(watchingEnabled ? 'mobile.watching' : 'mobile.picks'),
    },
    { id: 'you', path: '/you', label: t('mobile.you') },
  ] as const
  return (
    <Box
      component="nav"
      aria-label={t('mobile.primaryNavigation')}
      sx={{
        position: 'relative',
        zIndex: theme.zIndex.appBar,
        flexShrink: 0,
        px: { xs: 1.5, sm: 3 },
        pt: 'var(--ap-dock-rise)',
        pb: 'max(var(--ap-dock-bottom), env(safe-area-inset-bottom, 0px))',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr 62px 1fr 1fr', sm: '1fr 1fr 76px 1fr 1fr' },
          gridTemplateRows: 'minmax(0, 1fr)',
          alignItems: 'center',
          height: 'var(--ap-dock-height)',
          maxWidth: 520,
          mx: 'auto',
          px: 0.5,
          borderRadius: '999px',
          border: '1px solid',
          borderColor: alpha(dark ? '#ffffff' : theme.palette.text.primary, dark ? 0.12 : 0.09),
          bgcolor: alpha(theme.palette.background.paper, 0.97),
          backgroundImage: `linear-gradient(160deg, ${alpha('#ffffff', dark ? 0.045 : 0.55)}, ${alpha('#ffffff', 0)} 55%)`,
          boxShadow: dark
            ? `inset 0 1px 0 ${alpha('#ffffff', 0.035)}, 0 12px 36px ${alpha('#000000', 0.35)}`
            : `inset 0 1px 0 ${alpha('#ffffff', 0.9)}, 0 10px 32px ${alpha('#14213b', 0.13)}`,
          '@supports (backdrop-filter: blur(1px))': {
            bgcolor: alpha(theme.palette.background.paper, dark ? 0.88 : 0.82),
            backdropFilter: 'blur(28px) saturate(145%)',
          },
        }}
      >
        {destinations.map((item) => {
          const active = selected === item.id,
            encore = item.id === 'encore'
          return (
            <ButtonBase
              key={item.id}
              component={Link}
              to={item.path}
              disableRipple
              aria-current={active ? 'page' : undefined}
              aria-label={encore && running ? t('mobile.encoreWorking') : item.label}
              sx={
                encore
                  ? {
                      width: { xs: 58, sm: 72 },
                      height: { xs: 58, sm: 72 },
                      justifySelf: 'center',
                      borderRadius: '50%',
                      bgcolor: 'background.default',
                      transform: { xs: 'translateY(-9px)', sm: 'translateY(-14px)' },
                      boxShadow: `0 6px 24px ${alpha(theme.palette.primary.main, active ? 0.22 : 0.12)}`,
                      transition: 'transform 160ms ease, box-shadow 160ms ease',
                      '&:active': { transform: { xs: 'translateY(-7px) scale(.94)', sm: 'translateY(-12px) scale(.94)' } },
                      '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                    }
                  : {
                      height: '100%',
                      minWidth: 0,
                      px: 0.25,
                      flexDirection: 'column',
                      gap: 0.5,
                      borderRadius: '999px',
                      color: active ? 'text.primary' : 'text.secondary',
                      transition: 'color 160ms ease, transform 160ms ease',
                      '&:active': { transform: 'scale(.94)' },
                      '@media (hover: hover)': {
                        '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.04) },
                      },
                      '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                    }
              }
            >
              {encore ? (
                <Badge
                  color="success"
                  variant="dot"
                  invisible={!running}
                  overlap="circular"
                  sx={{
                    '& .MuiBadge-badge': {
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      boxShadow: `0 0 0 3px ${theme.palette.background.default}`,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: { xs: 48, sm: 60 },
                      height: { xs: 48, sm: 60 },
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: '50%',
                      color: 'primary.contrastText',
                      bgcolor: 'primary.main',
                      backgroundImage: `linear-gradient(145deg, ${alpha('#ffffff', 0.15)}, ${alpha('#ffffff', 0)} 65%)`,
                      boxShadow: `inset 0 1px 0 ${alpha('#ffffff', 0.28)}`,
                    }}
                  >
                    <MobileNavIcon name={item.id} sx={{ fontSize: { xs: 25, sm: 30 } }} />
                  </Box>
                </Badge>
              ) : (
                <>
                  <MobileNavIcon
                    name={item.id}
                    sx={{ fontSize: { xs: 21, sm: 24 }, color: active ? 'primary.main' : 'inherit' }}
                  />
                  <Box
                    component="span"
                    sx={{
                      fontSize: 10.5,
                      lineHeight: '15px',
                      fontWeight: active ? 650 : 500,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.label}
                  </Box>
                </>
              )}
            </ButtonBase>
          )
        })}
      </Box>
    </Box>
  )
}
