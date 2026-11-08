import { useState } from 'react'
import {
  Alert,
  Box,
  CircularProgress,
  Drawer,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined'
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import OpenInFullOutlinedIcon from '@mui/icons-material/OpenInFullOutlined'
import CloseFullscreenOutlinedIcon from '@mui/icons-material/CloseFullscreenOutlined'
import { useEncore, type EncoreView } from './encoreContext'
import { useTranslation } from 'react-i18next'
import { MemoryPanel } from './MemoryPanel'
import { PlansPanel } from './PlansPanel'
import { CollectionsPanel } from './CollectionsPanel'
import { CurationPanel } from './CurationPanel'
import { ConnectionsPanel } from './ConnectionsPanel'
import { EncoreWorkspaceMenu } from './EncoreWorkspaceMenu'
import { useConversations } from './hooks/useConversations'
import { ConversationSidebar } from './ConversationSidebar'
import { ChatSession } from './ChatSession'
export default function EncoreWorkspace({
  onRunningChange,
  expanded = false,
  onExpand,
}: {
  expanded?: boolean
  onExpand?: () => void
  onRunningChange?: (running: boolean) => void
}) {
  const { t } = useTranslation(),
    mobile = useMediaQuery(useTheme().breakpoints.down('md')),
    { view, selectView: setView, closeEncore } = useEncore()
  const [historyOpen, setHistoryOpen] = useState(false),
    [menuOpen, setMenuOpen] = useState(false),
    state = useConversations()
  function selectView(next: string) {
    setView(next as EncoreView)
  }
  const activeTitle =
    state.conversations.find((item) => item.id === state.active?.conversation.id)?.title ??
    state.active?.conversation.title
  const sidebar = (
    <ConversationSidebar
      conversations={state.conversations}
      activeId={state.active?.conversation.id}
      disabled={state.busy}
      onSelect={(id) => {
        setView('chat')
        void state.select(id)
        setHistoryOpen(false)
      }}
      onCreate={() => {
        setView('chat')
        void state.create()
        setHistoryOpen(false)
      }}
      onRemove={(id) => void state.remove(id)}
      onRename={(id, title) => void state.rename(id, title)}
    />
  )
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        bgcolor: 'background.default',
        '& .MuiTypography-body1': { fontSize: 16, lineHeight: 1.6 },
        '& .MuiTypography-body2': { fontSize: { xs: 14, md: 15 }, lineHeight: 1.55 },
        '& .MuiTypography-caption': { fontSize: 13, lineHeight: 1.5 },
        '& .MuiButton-root': { fontSize: 14, minHeight: 44 },
        '& .MuiIconButton-root': { width: 44, height: 44 },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          gap: 0.5,
          px: { xs: 1.5, sm: 2, md: 3 },
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {mobile && view !== 'chat' ? (
          <IconButton aria-label={t('mobile.backToChat')} onClick={() => selectView('chat')}>
            <ArrowBackIcon />
          </IconButton>
        ) : (
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 36,
              height: 36,
              borderRadius: mobile ? '50%' : 2.5,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              flexShrink: 0,
            }}
          >
            <AutoAwesomeOutlinedIcon fontSize="small" />
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            component="h2"
            id="encore-agent-title"
            variant="h6"
            fontWeight={750}
            fontSize={22}
            letterSpacing="-.035em"
            lineHeight={1.2}
            noWrap
          >
            {mobile && view !== 'chat' ? t(`encore.${view}Tab`) : 'Encore'}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ display: 'block', fontSize: 13, lineHeight: 1.4, mt: 0.25 }}
          >
            {mobile
              ? view === 'chat' && activeTitle && activeTitle !== 'New Chat'
                ? activeTitle
                : t('mobile.encoreSubtitle')
              : t('encore.subtitle')}
          </Typography>
        </Box>
        {(!expanded || view !== 'chat') && (
          <IconButton aria-label={t('encore.conversations')} onClick={() => setHistoryOpen(true)}>
            <HistoryOutlinedIcon />
          </IconButton>
        )}
        {!mobile && (
          <IconButton
            aria-label={t('encore.newConversation')}
            disabled={state.busy}
            onClick={() => {
              setView('chat')
              void state.create()
            }}
          >
            <AddCommentOutlinedIcon />
          </IconButton>
        )}
        <IconButton aria-label={t('mobile.workspace')} onClick={() => setMenuOpen(true)}>
          <GridViewOutlinedIcon />
        </IconButton>
        {onExpand && (
          <IconButton
            aria-label={t(expanded ? 'encore.collapseAgent' : 'encore.expandAgent')}
            onClick={onExpand}
          >
            {expanded ? <CloseFullscreenOutlinedIcon /> : <OpenInFullOutlinedIcon />}
          </IconButton>
        )}
        <IconButton aria-label={t('encore.closeAgent')} onClick={closeEncore}>
          <CloseIcon />
        </IconButton>
      </Box>
      {state.error && <Alert severity="error">{state.error}</Alert>}
      {view === 'memory' && <MemoryPanel />}
      {view === 'plans' && <PlansPanel />}
      {view === 'collections' && <CollectionsPanel />}
      {view === 'curation' && <CurationPanel />}
      {view === 'connections' && <ConnectionsPanel />}
      <Box
        hidden={view !== 'chat'}
        sx={{
          display: view === 'chat' ? 'flex' : 'none',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {expanded && sidebar}
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          {state.busy ? (
            <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
              <CircularProgress size={26} />
            </Box>
          ) : (
            state.active && (
              <ChatSession
                key={state.active.conversation.id}
                conversationId={state.active.conversation.id}
                messages={state.active.messages}
                onRunningChange={onRunningChange}
                onComplete={() => {
                  void state.refresh()
                }}
              />
            )
          )}
        </Box>
      </Box>
      <EncoreWorkspaceMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        view={view}
        onSelect={selectView}
      />
      <Drawer
        sx={{ zIndex: (theme) => theme.zIndex.modal }}
        anchor={mobile ? 'bottom' : 'right'}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: mobile ? '24px 24px 0 0' : 0,
            width: mobile ? '100%' : 340,
            maxWidth: '100%',
            mx: 'auto',
            maxHeight: mobile ? '85dvh' : '100%',
            pb: 'env(safe-area-inset-bottom, 0px)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            {t('encore.conversations')}
          </Typography>
          <IconButton aria-label={t('common.close')} onClick={() => setHistoryOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        {sidebar}
      </Drawer>
    </Box>
  )
}
