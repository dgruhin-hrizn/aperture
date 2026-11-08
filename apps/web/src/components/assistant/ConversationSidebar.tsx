import { useState } from 'react'
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslation } from 'react-i18next'
import type { Conversation } from './hooks/useConversations'

export function ConversationSidebar({
  conversations,
  activeId,
  disabled,
  onSelect,
  onCreate,
  onRemove,
  onRename,
}: {
  conversations: Conversation[]
  activeId?: string
  disabled: boolean
  onSelect: (id: string) => void
  onCreate: () => void
  onRemove: (id: string) => void
  onRename: (id: string, title: string) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [menu, setMenu] = useState<{ anchor: HTMLElement; conversation: Conversation } | null>(null)
  return (
    <Box
      component="nav"
      aria-label={t('encore.conversations')}
      sx={{
        width: { xs: '100%', md: 280 },
        boxSizing: 'border-box',
        flexShrink: 0,
        p: 2,
        bgcolor: 'background.paper',
        overflowY: 'auto',
      }}
    >
      <Button
        fullWidth
        variant="outlined"
        startIcon={<AddIcon />}
        disabled={disabled}
        onClick={onCreate}
        sx={{ borderRadius: 3, py: 1, fontSize: 15, minHeight: 44 }}
      >
        {t('encore.newConversation')}
      </Button>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2.5, mb: 1, fontSize: 14 }}>
        {t('encore.conversations')}
      </Typography>
      <List disablePadding>
        {conversations.map((item) => (
          <ListItem key={item.id} disablePadding sx={{ mb: 0.5, gap: 0.25 }}>
            {editing === item.id ? (
              <Box
                component="form"
                sx={{ display: 'flex', width: '100%', alignItems: 'center' }}
                onSubmit={(event) => {
                  event.preventDefault()
                  if (title.trim()) {
                    onRename(item.id, title.trim())
                    setEditing(null)
                  }
                }}
              >
                <TextField
                  autoFocus
                  fullWidth
                  size="small"
                  value={title}
                  disabled={disabled}
                  onChange={(event) => setTitle(event.target.value)}
                  inputProps={{ 'aria-label': t('encore.rename'), maxLength: 120 }}
                />
                <IconButton
                  type="submit"
                  disabled={disabled || !title.trim()}
                  aria-label={t('common.save')}
                  sx={{ width: 44, height: 44 }}
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton
                  disabled={disabled}
                  aria-label={t('common.cancel')}
                  onClick={() => setEditing(null)}
                  sx={{ width: 44, height: 44 }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <>
                <ListItemButton
                  selected={activeId === item.id}
                  disabled={disabled}
                  onClick={() => onSelect(item.id)}
                  sx={{ borderRadius: 2, minWidth: 0, minHeight: 52, px: 1.25, py: 1 }}
                >
                  <ListItemText
                    primary={item.title}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontSize: 15,
                      lineHeight: 1.5,
                      title: item.title,
                      sx: {
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        overflowWrap: 'anywhere',
                      },
                    }}
                  />
                </ListItemButton>
                <IconButton
                  disabled={disabled}
                  aria-label={t('encore.conversationActions', { title: item.title })}
                  aria-haspopup="menu"
                  aria-expanded={menu?.conversation.id === item.id}
                  onClick={(event) => setMenu({ anchor: event.currentTarget, conversation: item })}
                  sx={{ width: 44, height: 44 }}
                >
                  <MoreHorizIcon />
                </IconButton>
              </>
            )}
          </ListItem>
        ))}
      </List>
      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem
          disabled={disabled}
          sx={{ gap: 1, minHeight: 44, fontSize: 15 }}
          onClick={() => {
            if (menu) {
              setEditing(menu.conversation.id)
              setTitle(menu.conversation.title)
            }
            setMenu(null)
          }}
        >
          <EditOutlinedIcon fontSize="small" />
          {t('encore.rename')}
        </MenuItem>
        <MenuItem
          disabled={disabled}
          sx={{ gap: 1, minHeight: 44, fontSize: 15, color: 'error.main' }}
          onClick={() => {
            if (menu) onRemove(menu.conversation.id)
            setMenu(null)
          }}
        >
          <DeleteOutlineIcon fontSize="small" />
          {t('encore.delete')}
        </MenuItem>
      </Menu>
    </Box>
  )
}
