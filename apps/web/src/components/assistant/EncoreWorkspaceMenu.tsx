import {
  Dialog,
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import { useTranslation } from 'react-i18next'
export function EncoreWorkspaceMenu({
  open,
  onClose,
  onSelect,
  view,
}: {
  open: boolean
  onClose: () => void
  onSelect: (view: string) => void
  view: string
}) {
  const { t } = useTranslation()
  const entries = [
    { id: 'chat', icon: <ChatBubbleOutlineIcon /> },
    { id: 'memory', icon: <PsychologyOutlinedIcon /> },
    { id: 'plans', icon: <EventAvailableOutlinedIcon /> },
    { id: 'collections', icon: <PlaylistPlayIcon /> },
    { id: 'curation', icon: <AutorenewOutlinedIcon /> },
    { id: 'connections', icon: <LinkOutlinedIcon /> },
  ]
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="encore-workspace-menu"
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-end' } }}
      PaperProps={{
        sx: {
          m: 0,
          width: '100%',
          maxWidth: 600,
          borderRadius: '24px 24px 0 0',
          pb: 'env(safe-area-inset-bottom, 0px)',
          maxHeight: '85dvh',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 2 }}>
        <Typography id="encore-workspace-menu" variant="h6" sx={{ flex: 1 }}>
          {t('mobile.workspace')}
        </Typography>
        <IconButton aria-label={t('common.close')} onClick={onClose} sx={{ width: 44, height: 44 }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <List sx={{ px: 1, pb: 2 }}>
        {entries.map((entry) => (
          <ListItemButton
            key={entry.id}
            selected={view === entry.id}
            onClick={() => {
              onSelect(entry.id)
              onClose()
            }}
            sx={{ borderRadius: 3, minHeight: 68 }}
          >
            <ListItemIcon sx={{ color: 'primary.main' }}>{entry.icon}</ListItemIcon>
            <ListItemText
              primary={t(`encore.${entry.id === 'chat' ? 'chat' : entry.id}Tab`)}
              secondary={t(`mobile.workspaceDescriptions.${entry.id}`)}
              primaryTypographyProps={{ fontWeight: 600 }}
            />
          </ListItemButton>
        ))}
      </List>
    </Dialog>
  )
}
