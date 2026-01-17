import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useTheme,
  useMediaQuery,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import HomeIcon from '@mui/icons-material/Home'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import HistoryIcon from '@mui/icons-material/History'
import MovieIcon from '@mui/icons-material/Movie'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import LogoutIcon from '@mui/icons-material/Logout'
import PersonIcon from '@mui/icons-material/Person'
import SettingsIcon from '@mui/icons-material/Settings'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import WhatshotIcon from '@mui/icons-material/Whatshot'
import TvIcon from '@mui/icons-material/Tv'
import InsightsIcon from '@mui/icons-material/Insights'
import SearchIcon from '@mui/icons-material/Search'
import CollectionsIcon from '@mui/icons-material/Collections'
import AddToQueueIcon from '@mui/icons-material/AddToQueue'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import ExploreIcon from '@mui/icons-material/Explore'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import { useAuth } from '@/hooks/useAuth'
import { WelcomeModal, useWelcomeModal } from './WelcomeModal'
import { ExplorationConfigModal } from './ExplorationConfigModal'
import { RunningJobsWidget } from './RunningJobsWidget'
import { GlobalSearch } from './GlobalSearch'

const DRAWER_WIDTH = 260
const DRAWER_WIDTH_COLLAPSED = 72

// User-facing navigation items (shown to all users)
const userMenuItems = [
  { text: 'Dashboard', icon: <HomeIcon />, path: '/' },
  { text: 'Recommendations', icon: <AutoAwesomeIcon />, path: '/recommendations' },
  { text: 'Shows You Watch', icon: <AddToQueueIcon />, path: '/watching' },
  { text: 'Top Picks', icon: <WhatshotIcon />, path: '/top-picks' },
  { text: 'Playlists', icon: <PlaylistPlayIcon />, path: '/playlists' },
  { text: 'Explore', icon: <HubOutlinedIcon />, path: '/explore' },
  { text: 'Discover', icon: <ExploreIcon />, path: '/discovery' },
  { text: 'Browse', icon: <VideoLibraryIcon />, path: '/browse' },
  { text: 'Watch History', icon: <HistoryIcon />, path: '/history' },
  { text: 'Watch Stats', icon: <InsightsIcon />, path: '/stats' },
]

// Admin navigation items (shown only to admins)
const adminMenuItems = [
  { text: 'Admin', icon: <AdminPanelSettingsIcon />, path: '/admin' },
]

export function Layout() {
  const theme = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const { user, logout } = useAuth()
  const { open: welcomeOpen, showWelcome, hideWelcome } = useWelcomeModal()

  const drawerWidth = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH

  // Fetch user's sidebar preference on mount
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch('/api/auth/me/preferences', { credentials: 'include' })
        if (response.ok) {
          const prefs = await response.json()
          if (prefs.sidebarCollapsed !== undefined) {
            setCollapsed(prefs.sidebarCollapsed)
          }
        }
      } catch {
        // Ignore errors, use default
      }
    }
    fetchPreferences()
  }, [])

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleCollapseToggle = async () => {
    const newCollapsed = !collapsed
    setCollapsed(newCollapsed)

    // Persist preference to server
    try {
      await fetch('/api/auth/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sidebarCollapsed: newCollapsed }),
      })
    } catch {
      // Ignore errors, state is already updated locally
    }
  }

  const handleNavClick = (path: string) => {
    navigate(path)
    if (isMobile) {
      setMobileOpen(false)
    }
  }

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleUserMenuClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = async () => {
    handleUserMenuClose()
    await logout()
    navigate('/login')
  }

  // Check if current path matches or starts with the menu item path
  const isPathActive = (itemPath: string) => {
    if (itemPath === '/') {
      return location.pathname === '/'
    }
    return location.pathname === itemPath || location.pathname.startsWith(itemPath + '/')
  }

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
          <Tooltip title="Expand sidebar" placement="right">
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
                fontFamily: '"Open Sans", sans-serif',
                fontWeight: 600,
                fontSize: '1.5rem',
                color: 'text.primary',
                letterSpacing: '-0.01em',
              }}
            >
              Aperture
            </Typography>
          </Box>
        )}
      </Box>

      {/* User Navigation */}
      <List>
        {userMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
              <ListItemButton
                selected={isPathActive(item.path)}
                onClick={() => handleNavClick(item.path)}
                sx={{
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  px: collapsed ? 2 : 3,
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isPathActive(item.path) ? 'primary.main' : 'text.secondary',
                    minWidth: collapsed ? 0 : 40,
                    mr: collapsed ? 0 : 1,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontWeight: isPathActive(item.path) ? 600 : 400,
                    }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>

      {/* Spacer */}
      <Box flex={1} />

      {/* Admin Section (only shown to admins) */}
      {user?.isAdmin && (
        <>
          <Divider sx={{ mx: 2, my: 1 }} />
          <List>
            {adminMenuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
                  <ListItemButton
                    selected={isPathActive(item.path)}
                    onClick={() => handleNavClick(item.path)}
                    sx={{
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      px: collapsed ? 2 : 3,
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: isPathActive(item.path) ? 'primary.main' : 'text.secondary',
                        minWidth: collapsed ? 0 : 40,
                        mr: collapsed ? 0 : 1,
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          fontWeight: isPathActive(item.path) ? 600 : 400,
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
          title={collapsed ? 'Expand sidebar (v0.5.1)' : 'Collapse sidebar'}
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
            v0.5.1
          </Typography>
        )}
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
        elevation={0}
      >
        <Toolbar>
          {/* Mobile: Hamburger on left */}
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Mobile: Centered logo and name */}
          <Box
            sx={{
              display: { xs: 'flex', md: 'none' },
              alignItems: 'center',
              gap: 1,
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            <Box
              component="img"
              src="/aperture.svg"
              alt="Aperture"
              sx={{ width: 28, height: 28 }}
            />
            <Typography
              sx={{
                fontFamily: '"Open Sans", sans-serif',
                fontWeight: 600,
                fontSize: '1.1rem',
                color: 'text.primary',
                letterSpacing: '-0.01em',
              }}
            >
              Aperture
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Running Jobs Widget (admin only) */}
          <RunningJobsWidget />

          {/* Global Search */}
          <GlobalSearch />

          {/* User menu */}
          {user && (
            <>
              <IconButton onClick={handleUserMenuOpen} size="small">
                <Avatar
                  src={user.avatarUrl || undefined}
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: 'primary.main',
                  }}
                >
                  {user.username[0].toUpperCase()}
                </Avatar>
              </IconButton>

              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleUserMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                <Box px={2} py={1}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {user.displayName || user.username}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user.isAdmin ? 'Administrator' : 'User'}
                  </Typography>
                </Box>
                <Divider />
                <MenuItem onClick={() => { handleUserMenuClose(); navigate('/settings'); }}>
                  <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                  Settings
                </MenuItem>
                <MenuItem onClick={() => { handleUserMenuClose(); navigate('/history'); }}>
                  <ListItemIcon>
                    <PersonIcon fontSize="small" />
                  </ListItemIcon>
                  My Watch History
                </MenuItem>
                <MenuItem onClick={() => { handleUserMenuClose(); showWelcome(); }}>
                  <ListItemIcon>
                    <HelpOutlineIcon fontSize="small" />
                  </ListItemIcon>
                  How It Works
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  Logout
                </MenuItem>
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Box
        component="nav"
        sx={{
          width: { md: drawerWidth },
          flexShrink: { md: 0 },
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen,
              }),
              overflowX: 'hidden',
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen,
              }),
              overflowX: 'hidden',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          maxWidth: '100%',
          overflowX: 'hidden',
          mt: '64px',
          backgroundColor: 'background.default',
          minHeight: 'calc(100vh - 64px)',
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Outlet />
      </Box>

      {/* Welcome Modal - shows on first visit */}
      <WelcomeModal />

      {/* Welcome Modal - manually triggered from menu */}
      <WelcomeModal open={welcomeOpen} onClose={hideWelcome} />

      {/* Exploration Config Modal - prompts admins to configure new AI provider */}
      <ExplorationConfigModal />
    </Box>
  )
}
