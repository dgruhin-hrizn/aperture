import React from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
} from '@mui/material'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PeopleIcon from '@mui/icons-material/People'
import WorkIcon from '@mui/icons-material/Work'
import SyncIcon from '@mui/icons-material/Sync'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AddToQueueIcon from '@mui/icons-material/AddToQueue'
import ExtensionIcon from '@mui/icons-material/Extension'
import SettingsIcon from '@mui/icons-material/Settings'
import { Breadcrumbs } from './Breadcrumbs'

interface AdminTab {
  label: string
  path: string
  icon: React.ReactElement
}

const adminTabs: AdminTab[] = [
  { label: 'Overview', path: '/admin', icon: <DashboardIcon /> },
  { label: 'Users', path: '/admin/users', icon: <PeopleIcon /> },
  { label: 'Media Sync', path: '/admin/media-sync', icon: <SyncIcon /> },
  { label: 'AI Recommendations', path: '/admin/ai-recommendations', icon: <AutoAwesomeIcon /> },
  { label: 'AI Chat', path: '/admin/ai-chat', icon: <SmartToyIcon /> },
  { label: 'Top Picks', path: '/admin/top-picks', icon: <TrendingUpIcon /> },
  { label: 'Shows You Watch', path: '/admin/watching', icon: <AddToQueueIcon /> },
  { label: 'Integrations', path: '/admin/integrations', icon: <ExtensionIcon /> },
  { label: 'System', path: '/admin/system', icon: <SettingsIcon /> },
  { label: 'Jobs', path: '/admin/jobs', icon: <WorkIcon /> },
]

export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  // Determine active tab based on current path
  const getActiveTab = () => {
    const path = location.pathname
    
    // Check for exact match first
    const exactMatch = adminTabs.findIndex((tab) => tab.path === path)
    if (exactMatch !== -1) return exactMatch
    
    // Check for prefix match (e.g., /admin/users/123 matches /admin/users)
    for (let i = adminTabs.length - 1; i >= 0; i--) {
      if (path.startsWith(adminTabs[i].path) && adminTabs[i].path !== '/admin') {
        return i
      }
    }
    
    // Default to Overview
    return 0
  }

  const activeTab = getActiveTab()

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    navigate(adminTabs[newValue].path)
  }

  return (
    <Box>
      {/* Admin Header */}
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs />
        
        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <AdminPanelSettingsIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography variant="h4" fontWeight={700}>
            Administration
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Manage users, run jobs, and configure system settings
        </Typography>
      </Box>

      {/* Tab Navigation */}
      <Paper
        sx={{
          mb: 3,
          backgroundColor: 'background.paper',
          borderRadius: 2,
        }}
        elevation={0}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            '& .MuiTab-root': {
              minHeight: 56,
              textTransform: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'primary.main',
                fontWeight: 600,
              },
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          {adminTabs.map((tab) => (
            <Tab
              key={tab.path}
              icon={tab.icon}
              iconPosition="start"
              label={tab.label}
              sx={{
                gap: 1,
                '& .MuiSvgIcon-root': {
                  fontSize: 20,
                },
              }}
            />
          ))}
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box>
        <Outlet />
      </Box>
    </Box>
  )
}

