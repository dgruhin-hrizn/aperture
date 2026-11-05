import { useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import LogoutIcon from '@mui/icons-material/Logout'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { adminNavigation } from '@/components/shell/navigation'
import type { ShellContext } from '@/components/shell/shellContext'
import { APP_VERSION } from '@/version'
export function AccountHub() {
  const { t } = useTranslation(),
    { user, logout } = useAuth(),
    { items, onWelcome } = useOutletContext<ShellContext>(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const secondary = items.filter(
    (item) => !['/encore', '/discovery', '/browse', '/watching'].includes(item.path)
  )
  async function signOut() {
    setBusy(true)
    setError('')
    try {
      await logout()
      void navigate('/login')
    } catch (e) {
      setError(String(e))
      setBusy(false)
    }
  }
  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', pb: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 2, mb: 2 }}>
        <Avatar
          src={user?.avatarUrl ?? undefined}
          sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: 26 }}
        >
          {user?.username[0].toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" fontWeight={700}>
            {user?.displayName || user?.username}
          </Typography>
          <Typography color="text.secondary">{t('mobile.accountIntro')}</Typography>
        </Box>
      </Stack>
      <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden', mb: 3 }}>
        <List disablePadding>
          {[
            { path: '/settings', textKey: 'nav.settings', icon: <SettingsOutlinedIcon /> },
            {
              path: '/settings?tab=preferences#appearance',
              textKey: 'appearance.title',
              icon: <PaletteOutlinedIcon />,
            },
          ].map((item) => (
            <ListItemButton component={Link} to={item.path} key={item.path} sx={{ minHeight: 60 }}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={t(item.textKey)} />
              <ChevronRightIcon fontSize="small" color="action" />
            </ListItemButton>
          ))}
        </List>
      </Paper>
      <Typography variant="overline" color="text.secondary">
        {t('mobile.yourAperture')}
      </Typography>
      <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden', mt: 1, mb: 3 }}>
        <List disablePadding>
          {secondary.map((item) => (
            <ListItemButton key={item.path} component={Link} to={item.path} sx={{ minHeight: 58 }}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={t(item.textKey)} />
              <ChevronRightIcon fontSize="small" color="action" />
            </ListItemButton>
          ))}
        </List>
      </Paper>
      {user?.isAdmin && (
        <>
          <Typography variant="overline" color="text.secondary">
            {t('nav.roleLabelAdmin')}
          </Typography>
          <Paper variant="outlined" sx={{ borderRadius: 4, mt: 1, mb: 3 }}>
            <List>
              {adminNavigation.map((item) => (
                <ListItemButton
                  key={item.path}
                  component={Link}
                  to={item.path}
                  sx={{ minHeight: 56 }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={t(item.textKey)} />
                  <ChevronRightIcon fontSize="small" color="action" />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </>
      )}
      <Button startIcon={<HelpOutlineIcon />} onClick={onWelcome} sx={{ minHeight: 48 }}>
        {t('nav.howItWorks')}
      </Button>
      <Divider sx={{ my: 2 }} />
      {error && <Alert severity="error">{error}</Alert>}
      <Button
        color="error"
        startIcon={<LogoutIcon />}
        disabled={busy}
        onClick={() => void signOut()}
        sx={{ minHeight: 48 }}
      >
        {t('nav.logout')}
      </Button>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
        Aperture · {APP_VERSION}
      </Typography>
    </Box>
  )
}
