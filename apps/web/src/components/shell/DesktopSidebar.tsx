import React from 'react'
import {
  Box,
  Drawer,
  Typography,
  Tooltip,
  IconButton,
  List,
  ListSubheader,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
} from '@mui/material'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { APP_VERSION } from '@/version'
import { adminNavigation as adminMenuItems, pathActive, type NavItem } from './navigation'
export function DesktopSidebar({
  collapsed,
  drawerWidth,
  items: userMenuItems,
  isAdmin,
  onCollapse: handleCollapseToggle,
  onNavigate: handleNavClick,
}: {
  collapsed: boolean
  drawerWidth: number
  items: NavItem[]
  isAdmin: boolean
  onCollapse: () => void
  onNavigate: (path: string) => void
}) {
  const { t } = useTranslation(),
    theme = useTheme(),
    location = useLocation(),
    studio = theme.aperture.name === 'studio'
  const isPathActive = (path: string) => pathActive(location.pathname, path)
  const isAdminPathActive = isPathActive
  const drawer = (
    <Box sx={{ overflow: 'auto', mt: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <Box
        px={collapsed ? 2 : 3}
        mb={3}
        sx={{
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-start',
          cursor: 'pointer',
          '&:hover': { opacity: 0.8 },
          transition: 'opacity 0.2s',
        }}
        onClick={handleCollapseToggle}
      >
        {collapsed ? (
          <Tooltip title={t('nav.expandSidebar')} placement="right">
            <Box
              component="img"
              src="/aperture.svg"
              alt="Aperture"
              sx={{ width: 40, height: 40 }}
            />
          </Tooltip>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              component="img"
              src="/aperture.svg"
              alt="Aperture"
              sx={{ width: 40, height: 40 }}
            />
            <Typography
              sx={{
                fontFamily: studio ? theme.typography.fontFamily : '"Open Sans", sans-serif',
                fontWeight: studio ? 800 : 600,
                fontSize: '1.5rem',
                color: 'text.primary',
                letterSpacing: '-0.01em',
              }}
            >
              {t('common.appName')}
            </Typography>
          </Box>
        )}
      </Box>

      {/* User Navigation */}
      <List>
        {userMenuItems.map((item) => (
          <React.Fragment key={item.path}>
            {studio && !collapsed && ['/encore', '/top-picks', '/history'].includes(item.path) && (
              <ListSubheader
                disableSticky
                sx={{
                  bgcolor: 'transparent',
                  typography: 'overline',
                  lineHeight: 2.5,
                  px: 3,
                  mt: item.path === '/encore' ? 0 : 1.5,
                }}
              >
                {t(
                  item.path === '/encore'
                    ? 'appearance.forYou'
                    : item.path === '/history'
                      ? 'appearance.activity'
                      : 'appearance.yourLibrary'
                )}
              </ListSubheader>
            )}
            <ListItem disablePadding>
              <Tooltip title={collapsed ? t(item.textKey) : ''} placement="right" arrow>
                <ListItemButton
                  selected={isPathActive(item.path)}
                  aria-current={isPathActive(item.path) ? 'page' : undefined}
                  onClick={() => handleNavClick(item.path)}
                  sx={{
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    px: collapsed ? 2 : studio ? 2 : 3,
                    ...(studio
                      ? {
                          py: 1,
                          '& .MuiListItemText-primary': { fontSize: '0.8125rem', fontWeight: 600 },
                        }
                      : {}),
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: isPathActive(item.path) ? 'primary.main' : 'text.secondary',
                      minWidth: collapsed ? 0 : studio ? 28 : 40,
                      mr: collapsed ? 0 : studio ? 0.5 : 1,
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={t(item.textKey)}
                      primaryTypographyProps={{
                        fontWeight: isPathActive(item.path) ? 600 : 400,
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          </React.Fragment>
        ))}
      </List>

      {/* Spacer */}
      <Box flex={1} />

      {/* Admin Section (only shown to admins) */}
      {isAdmin && (
        <>
          <Divider sx={{ mx: 2, my: 1 }} />
          <List>
            {adminMenuItems.map((item) => (
              <ListItem key={item.path} disablePadding>
                <Tooltip title={collapsed ? t(item.textKey) : ''} placement="right" arrow>
                  <ListItemButton
                    selected={isAdminPathActive(item.path)}
                    onClick={() => handleNavClick(item.path)}
                    sx={{
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      px: collapsed ? 2 : 3,
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: isAdminPathActive(item.path) ? 'primary.main' : 'text.secondary',
                        minWidth: collapsed ? 0 : studio ? 28 : 40,
                        mr: collapsed ? 0 : studio ? 0.5 : 1,
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={t(item.textKey)}
                        primaryTypographyProps={{
                          fontWeight: isAdminPathActive(item.path) ? 600 : 400,
                        }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        </>
      )}

      {/* Collapse toggle and version at bottom */}
      <Box
        px={collapsed ? 1 : 2}
        py={1.5}
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
        }}
      >
        <Tooltip
          title={collapsed ? t('nav.expandSidebarVersion') : t('nav.collapseSidebar')}
          placement="right"
        >
          <IconButton
            onClick={handleCollapseToggle}
            size="small"
            sx={{
              color: 'text.secondary',
              transform: collapsed ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          >
            <MenuOpenIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {!collapsed && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              opacity: 0.6,
              fontFamily: 'monospace',
              fontSize: '0.7rem',
            }}
          >
            v{APP_VERSION}
          </Typography>
        )}
      </Box>
    </Box>
  )

  return (
    <Box
      component="nav"
      aria-label={t('mobile.primaryNavigation')}
      sx={{ width: drawerWidth, flexShrink: 0 }}
    >
      <Drawer
        variant="permanent"
        open
        sx={{
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            overflowX: 'hidden',
          },
        }}
      >
        {drawer}
      </Drawer>
    </Box>
  )
}
