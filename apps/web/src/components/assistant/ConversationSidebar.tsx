import { useState } from 'react'
import { Box, Button, IconButton, List, ListItem, ListItemButton, ListItemText, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import CheckIcon from '@mui/icons-material/Check'
import { useTranslation } from 'react-i18next'
import type { Conversation } from './hooks/useConversations'

export function ConversationSidebar({ conversations, activeId, disabled, onSelect, onCreate, onRemove, onRename }: {
  conversations: Conversation[]; activeId?: string; disabled: boolean
  onSelect: (id: string) => void; onCreate: () => void; onRemove: (id: string) => void; onRename: (id: string, title: string) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  return <Box component="nav" aria-label={t('encore.conversations')} sx={{ width: { xs: '100%', md: 250 }, flexShrink: 0, p: 2, borderInlineEnd: { md: '1px solid' }, borderColor: 'divider', bgcolor: 'action.hover', overflowY: 'auto' }}>
    <Button fullWidth variant="outlined" startIcon={<AddIcon />} disabled={disabled} onClick={onCreate} sx={{ borderRadius: 3, py: 1 }}>{t('encore.newConversation')}</Button>
    <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 3, mb: 1 }}>{t('encore.conversations')}</Typography>
    <List disablePadding>{conversations.map((item) => <ListItem key={item.id} disablePadding sx={{ mb: .5, gap: .25 }}>
      {editing === item.id ? <Box component="form" sx={{ display: 'flex', width: '100%' }} onSubmit={(e) => { e.preventDefault(); if (title.trim()) { onRename(item.id, title.trim()); setEditing(null) } }}>
        <TextField autoFocus size="small" value={title} onChange={(e) => setTitle(e.target.value)} inputProps={{ 'aria-label': t('encore.rename'), maxLength: 120 }} />
        <IconButton type="submit" aria-label={t('common.save')}><CheckIcon fontSize="small" /></IconButton>
      </Box> : <>
        <ListItemButton selected={activeId === item.id} disabled={disabled} onClick={() => onSelect(item.id)} sx={{ borderRadius: 3, minWidth: 0 }}>
          <ListItemText primary={item.title} primaryTypographyProps={{ noWrap: true, fontSize: 13 }} />
        </ListItemButton>
        <IconButton size="small" disabled={disabled} aria-label={t('encore.rename')} onClick={() => { setEditing(item.id); setTitle(item.title) }}><EditOutlinedIcon sx={{ fontSize: 15 }} /></IconButton>
        <IconButton size="small" disabled={disabled} aria-label={t('encore.delete')} onClick={() => onRemove(item.id)}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton>
      </>}
    </ListItem>)}</List>
  </Box>
}
