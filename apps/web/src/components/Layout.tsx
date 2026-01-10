import React, { useState } from 'react'
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
import { useAuth } from '@/hooks/useAuth'
import { WelcomeModal, useWelcomeModal } from './WelcomeModal'
import { RunningJobsWidget } from './RunningJobsWidget'
import { GlobalSearch } from './GlobalSearch'

const DRAWER_WIDTH = 260

// User-facing navigation items (shown to all users)
const userMenuItems = [
  { text: 'Home', icon: <HomeIcon />, path: '/' },
  { text: 'Search', icon: <SearchIcon />, path: '/search' },
  { text: 'Recommendations', icon: <AutoAwesomeIcon />, path: '/recommendations' },
  { text: "Shows You Watch", icon: <AddToQueueIcon />, path: '/watching' },
  { text: 'Top Pick Movies', icon: <WhatshotIcon />, path: '/top-picks/movies' },
  { text: 'Top Pick Series', icon: <TvIcon />, path: '/top-picks/series' },
  { text: 'Franchises', icon: <CollectionsIcon />, path: '/franchises' },
  { text: 'Watch History', icon: <HistoryIcon />, path: '/history' },
  { text: 'Watch Stats', icon: <InsightsIcon />, path: '/stats' },
  { text: 'Browse Movies', icon: <MovieIcon />, path: '/movies' },
  { text: 'Browse Series', icon: <TvIcon />, path: '/series' },
  { text: 'Playlists', icon: <PlaylistPlayIcon />, path: '/playlists' },
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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const { user, logout } = useAuth()
  const { open: welcomeOpen, showWelcome, hideWelcome } = useWelcomeModal()

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
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
      <Box px={3} mb={3}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Aperture
        </Typography>
        <Typography variant="caption" color="text.secondary">
          AI Movie Recommendations
        </Typography>
      </Box>

      {/* User Navigation */}
      <List>
        {userMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={isPathActive(item.path)}
              onClick={() => handleNavClick(item.path)}
            >
              <ListItemIcon
                sx={{
                  color: isPathActive(item.path) ? 'primary.main' : 'text.secondary',
                  minWidth: 40,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  fontWeight: isPathActive(item.path) ? 600 : 400,
                }}
              />
            </ListItemButton>
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
                <ListItemButton
                  selected={isPathActive(item.path)}
                  onClick={() => handleNavClick(item.path)}
                >
                  <ListItemIcon
                    sx={{
                      color: isPathActive(item.path) ? 'primary.main' : 'text.secondary',
                      minWidth: 40,
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontWeight: isPathActive(item.path) ? 600 : 400,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </>
      )}

      {/* User info at bottom */}
      {user && (
        <Box px={2} py={2} sx={{ borderTop: 1, borderColor: 'divider' }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar
              src={user.avatarUrl || undefined}
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'primary.main',
                fontSize: '0.875rem',
              }}
            >
              {user.username[0].toUpperCase()}
            </Avatar>
            <Box flex={1} minWidth={0}>
              <Typography variant="body2" fontWeight={500} noWrap>
                {user.displayName || user.username}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user.isAdmin ? 'Administrator' : 'User'}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
        elevation={0}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Global Search */}
          <GlobalSearch />

          <Box sx={{ flexGrow: 1 }} />

          {/* Running Jobs Widget (admin only) */}
          <RunningJobsWidget />

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
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
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
              width: DRAWER_WIDTH,
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
              width: DRAWER_WIDTH,
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
          p: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: '64px',
          backgroundColor: 'background.default',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <Outlet />
      </Box>

      {/* Welcome Modal - shows on first visit */}
      <WelcomeModal />
      
      {/* Welcome Modal - manually triggered from menu */}
      <WelcomeModal open={welcomeOpen} onClose={hideWelcome} />
    </Box>
  )
}
