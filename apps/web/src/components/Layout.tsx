import { Suspense, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Box, GlobalStyles, useMediaQuery, useTheme } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { PageLoading } from './PageLoading'
import { WelcomeModal } from './WelcomeModal'
import { useWelcomeModal } from './useWelcomeModal'
import { ReleaseHighlightsModal } from './ReleaseHighlightsModal'
import { ExplorationConfigModal } from './ExplorationConfigModal'
import { DesktopSidebar } from './shell/DesktopSidebar'
import { AppHeader } from './shell/AppHeader'
import { MobileNavigation } from './shell/MobileNavigation'
import { availableNavigation, isEncoreLocation } from './shell/navigation'
import { useShellState } from './shell/useShellState'
import { useMobileViewport } from './shell/useMobileViewport'
import { usePaneScroll } from './shell/usePaneScroll'
import { EncoreSurface } from './assistant/EncoreSurface'

export function Layout() {
  const { t, i18n } = useTranslation(),
    theme = useTheme(),
    { user } = useAuth(),
    location = useLocation(),
    navigate = useNavigate()
  const mobile = useMediaQuery(theme.breakpoints.down('md')),
    viewport = useMobileViewport(mobile),
    state = useShellState()
  const encore = isEncoreLocation(location.pathname, mobile),
    drawerWidth = state.collapsed ? 72 : theme.aperture.name === 'studio' ? 228 : 260
  const [running, setRunning] = useState(false),
    main = useRef<HTMLElement>(null)
  const { open: welcomeOpen, showWelcome, hideWelcome } = useWelcomeModal()
  const items = useMemo(
    () => availableNavigation(user?.provider, state.watchingEnabled),
    [user?.provider, state.watchingEnabled]
  )
  usePaneScroll(main, mobile && !encore)
  return (
    <Box
      data-mobile-shell={mobile ? 'true' : undefined}
      sx={
        mobile
          ? {
              '--ap-header-height': { xs: '57px', sm: '65px' },
              '--ap-dock-height': '68px',
              '--ap-dock-rise': '16px',
              '--ap-nav-height': viewport?.keyboard
                ? '0px'
                : 'calc(var(--ap-dock-height) + var(--ap-dock-rise) + max(12px, env(safe-area-inset-bottom, 0px)))',
              '--ap-content-height':
                'calc(var(--ap-viewport-height, 100dvh) - var(--ap-header-height) - var(--ap-nav-height) - env(safe-area-inset-top, 0px))',
              '--ap-layout-inset': '-16px',
              paddingInlineStart:
                theme.direction === 'rtl'
                  ? 'env(safe-area-inset-right, 0px)'
                  : 'env(safe-area-inset-left, 0px)',
              paddingInlineEnd:
                theme.direction === 'rtl'
                  ? 'env(safe-area-inset-left, 0px)'
                  : 'env(safe-area-inset-right, 0px)',
              position: 'fixed',
              top: viewport?.top ?? 0,
              left: 0,
              right: 0,
              height: viewport ? `${viewport.height}px` : '100dvh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              bgcolor: 'background.default',
            }
          : { display: 'flex', minHeight: '100dvh' }
      }
    >
      {mobile && (
        <GlobalStyles
          styles={{
            body: { overflow: 'hidden' },
            '[data-mobile-shell] *': { scrollbarWidth: 'thin' },
            '.MuiDialog-root, .MuiDrawer-modal': {
              height: 'var(--ap-viewport-height, 100dvh)',
              top: 'var(--ap-viewport-top, 0px)',
              bottom: 'auto',
            },
            '.MuiDialog-root .MuiDialog-paper': {
              maxHeight: 'calc(var(--ap-viewport-height, 100dvh) - 24px)',
            },
            '.MuiDrawer-modal .MuiDrawer-paper': {
              position: 'absolute',
              maxHeight: 'calc(var(--ap-viewport-height, 100dvh) - 24px)',
            },
            // Dialogs and sheets are portalled outside the shell; include their controls too.
            'body .MuiButton-root, body .MuiListItemButton-root': { minHeight: 44 },
            'body .MuiIconButton-root': { minWidth: 44, minHeight: 44 },
            '[data-mobile-shell] :focus-visible': {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: 2,
            },
            '@media (prefers-reduced-motion: reduce)': {
              '[data-mobile-shell] *': { scrollBehavior: 'auto' },
            },
          }}
        />
      )}
      {!mobile && (
        <DesktopSidebar
          collapsed={state.collapsed}
          drawerWidth={drawerWidth}
          items={items}
          isAdmin={user?.isAdmin ?? false}
          onCollapse={() => void state.toggleCollapsed()}
          onNavigate={(path) => void navigate(path)}
        />
      )}
      {(!mobile || !encore) && (
        <AppHeader
          mobile={mobile}
          drawerWidth={drawerWidth}
          items={items}
          onWelcome={showWelcome}
        />
      )}
      <Box
        component="main"
        ref={main}
        sx={
          mobile
            ? {
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                overflowY: encore ? 'hidden' : 'auto',
                overflowX: 'hidden',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                p: encore ? 0 : 2,
                paddingInlineStart: encore ? 0 : 2,
                paddingInlineEnd: encore ? 0 : 2,
              }
            : {
                flexGrow: 1,
                minWidth: 0,
                p: 3,
                width: `calc(100% - ${drawerWidth}px)`,
                mt: '64px',
                height: encore ? 'calc(100dvh - 64px)' : undefined,
                minHeight: 'calc(100dvh - 64px)',
                overflowX: 'hidden',
              }
        }
      >
        {state.error && <Alert severity="error">{t('mobile.preferenceError')}</Alert>}
        <EncoreSurface
          key={user?.id}
          visible={encore}
          mobile={mobile}
          onRunningChange={setRunning}
        />
        {!encore && (
          <Suspense fallback={<PageLoading />}>
            <Outlet
              key={`${user?.id}:${i18n.language}`}
              context={{ items, onWelcome: showWelcome }}
            />
          </Suspense>
        )}
      </Box>
      {mobile && !viewport?.keyboard && (
        <MobileNavigation watchingEnabled={state.watchingEnabled} running={running} />
      )}
      {state.canShowOtherPrompts && <WelcomeModal />}
      <WelcomeModal open={welcomeOpen} onClose={hideWelcome} />
      {state.canShowOtherPrompts && <ExplorationConfigModal />}
      {state.releaseOpen && (
        <ReleaseHighlightsModal
          key={state.releaseKey}
          isAdmin={user?.isAdmin ?? false}
          onDismiss={state.dismissRelease}
        />
      )}
    </Box>
  )
}
