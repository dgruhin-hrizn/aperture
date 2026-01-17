/**
 * ExplorationConfigModal - Prompts admins to configure the new Exploration AI provider
 * Shows once to admins when exploration is not configured
 */
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  FormControlLabel,
  Checkbox,
  alpha,
  useTheme,
} from '@mui/material'
import {
  HubOutlined as HubOutlinedIcon,
  Settings as SettingsIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const STORAGE_KEY = 'aperture_exploration_config_dismissed'

interface ExplorationConfigModalProps {
  open?: boolean
  onClose?: () => void
}

export function ExplorationConfigModal({ open: controlledOpen, onClose }: ExplorationConfigModalProps) {
  const theme = useTheme()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [internalOpen, setInternalOpen] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [explorationConfigured, setExplorationConfigured] = useState<boolean | null>(null)

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  // Check if exploration is configured
  useEffect(() => {
    if (!user?.isAdmin) return

    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed) return

    // Fetch AI config to check if exploration is configured
    fetch('/api/settings/ai/features', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        const configured = data.exploration?.configured ?? false
        setExplorationConfigured(configured)
        
        // Only show modal if not controlled and exploration is not configured
        if (!isControlled && !configured) {
          setInternalOpen(true)
        }
      })
      .catch(() => {
        // Ignore errors - don't show modal on error
      })
  }, [user, isControlled])

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    if (isControlled) {
      onClose?.()
    } else {
      setInternalOpen(false)
    }
  }

  const handleConfigureNow = () => {
    localStorage.setItem(STORAGE_KEY, 'true') // Don't show again after they go to configure
    handleClose()
    navigate('/admin/settings')
  }

  // Don't show if not admin or exploration is already configured
  if (!user?.isAdmin || explorationConfigured === true) {
    return null
  }

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          borderRadius: 3,
          overflow: 'hidden',
        },
      }}
    >
      {/* Header with gradient */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.15)} 0%, ${alpha(theme.palette.primary.main, 0.15)} 100%)`,
          p: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.success.main, 0.2),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <HubOutlinedIcon sx={{ fontSize: 32, color: 'success.main' }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            New Feature: Exploration AI
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure a dedicated AI for the Explore page
          </Typography>
        </Box>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        <Typography variant="body1" paragraph>
          Aperture now supports a dedicated <strong>Exploration AI provider</strong> for the Explore page's semantic graph generation.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <AutoAwesomeIcon sx={{ color: 'success.main', mt: 0.5 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={600}>
                Conceptual Understanding
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Use a more powerful model to understand queries like "feel-good comedies" or "mind-bending sci-fi"
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <HubOutlinedIcon sx={{ color: 'success.main', mt: 0.5 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={600}>
                Better Graph Connections
              </Typography>
              <Typography variant="body2" color="text.secondary">
                AI analyzes your library to find meaningful thematic connections between items
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <SettingsIcon sx={{ color: 'success.main', mt: 0.5 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={600}>
                Independent Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Use GPT-4 or Claude for exploration while keeping cheaper models for other functions
              </Typography>
            </Box>
          </Box>
        </Box>

        <FormControlLabel
          control={
            <Checkbox
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="body2" color="text.secondary">
              Don't show this again
            </Typography>
          }
        />
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0, gap: 1 }}>
        <Button variant="outlined" onClick={handleClose}>
          Later
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={<SettingsIcon />}
          onClick={handleConfigureNow}
        >
          Configure Now
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// Hook to manually trigger the modal (optional)
export function useExplorationConfigModal() {
  const [open, setOpen] = useState(false)

  const showModal = () => setOpen(true)
  const hideModal = () => setOpen(false)
  const resetModal = () => {
    localStorage.removeItem(STORAGE_KEY)
    setOpen(true)
  }

  return { open, showModal, hideModal, resetModal }
}

