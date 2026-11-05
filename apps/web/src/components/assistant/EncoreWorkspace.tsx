import { useState } from 'react'
import { Alert, Box, CircularProgress, IconButton, Typography, useMediaQuery, useTheme, Tabs, Tab } from '@mui/material'
import { ConnectionsPanel } from './ConnectionsPanel'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CloseIcon from '@mui/icons-material/Close'
import MenuIcon from '@mui/icons-material/Menu'
import { useTranslation } from 'react-i18next'
import { useConversations } from './hooks/useConversations'
import { ConversationSidebar } from './ConversationSidebar'
import { ChatSession } from './ChatSession'

export default function EncoreWorkspace({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('md'))
  const [view, setView] = useState('chat')
  const [showHistory, setShowHistory] = useState(false)
  const state = useConversations()
  return <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, bgcolor: 'background.paper' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 2, md: 3 }, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
      {mobile && <IconButton aria-label={t('encore.conversations')} onClick={() => setShowHistory(!showHistory)}><MenuIcon /></IconButton>}
      <Box sx={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}><AutoAwesomeOutlinedIcon /></Box>
      <Box sx={{ flex: 1 }}><Typography component="h1" variant="h6">Encore</Typography><Typography variant="caption" color="text.secondary">{t('encore.subtitle')}</Typography></Box>
      <IconButton aria-label={t('common.close')} onClick={onClose}><CloseIcon /></IconButton>
    </Box>
    <Tabs value={view} onChange={(_e, value: string) => setView(value)} sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}><Tab value="chat" label={t('encore.chatTab')} /><Tab value="connections" label={t('encore.connectionsTab')} /></Tabs>
    {state.error && <Alert severity="error">{state.error}</Alert>}
    {view === 'connections' && <ConnectionsPanel />}
    <Box aria-hidden={view !== 'chat'} sx={{ display: view === 'chat' ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {(!mobile || showHistory) && <ConversationSidebar conversations={state.conversations} activeId={state.active?.conversation.id} disabled={state.busy}
        onSelect={(id) => { void state.select(id); setShowHistory(false) }} onCreate={() => { void state.create(); setShowHistory(false) }}
        onRemove={(id) => void state.remove(id)} onRename={(id, title) => void state.rename(id, title)} />}
      {(!mobile || !showHistory) && <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        {state.busy ? <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}><CircularProgress size={26} /></Box> : state.active &&
          <ChatSession key={state.active.conversation.id} conversationId={state.active.conversation.id} messages={state.active.messages} onComplete={() => { void state.refresh() }} />}
      </Box>}
    </Box>
  </Box>
}

