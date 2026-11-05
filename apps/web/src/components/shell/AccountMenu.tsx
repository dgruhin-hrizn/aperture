import { useState } from 'react'
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import LogoutIcon from '@mui/icons-material/Logout'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
export function AccountMenu({ onWelcome }: { onWelcome: () => void }) {
  const { t } = useTranslation(),
    { user, logout } = useAuth(),
    navigate = useNavigate(),
    [anchor, setAnchor] = useState<HTMLElement | null>(null)
  if (!user) return null
  const go = (path: string) => {
    setAnchor(null)
    navigate(path)
  }
  return (
    <>
      <IconButton aria-label={t('mobile.account')} onClick={(e) => setAnchor(e.currentTarget)}>
        <Avatar
          src={user.avatarUrl ?? undefined}
          sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}
        >
          {user.username[0].toUpperCase()}
        </Avatar>
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography fontWeight={600}>{user.displayName || user.username}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t(user.isAdmin ? 'nav.roleLabelAdmin' : 'nav.roleLabelUser')}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => go('/settings?tab=preferences#appearance')}>
          <ListItemIcon>
            <PaletteOutlinedIcon />
          </ListItemIcon>
          {t('appearance.title')}
        </MenuItem>
        <MenuItem onClick={() => go('/settings')}>
          <ListItemIcon>
            <SettingsOutlinedIcon />
          </ListItemIcon>
          {t('nav.settings')}
        </MenuItem>
        <MenuItem onClick={() => go('/history')}>
          <ListItemIcon>
            <HistoryOutlinedIcon />
          </ListItemIcon>
          {t('nav.myWatchHistory')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null)
            onWelcome()
          }}
        >
          <ListItemIcon>
            <HelpOutlineIcon />
          </ListItemIcon>
          {t('nav.howItWorks')}
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null)
            void logout().then(() => navigate('/login'))
          }}
        >
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          {t('nav.logout')}
        </MenuItem>
      </Menu>
    </>
  )
}
