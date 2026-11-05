import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  CircularProgress,
  Drawer,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
  Tabs,
  Tab,
} from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined'
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
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
const views = ['chat', 'memory', 'plans', 'collections', 'curation', 'connections']
export default function EncoreWorkspace({
  onRunningChange,
}: {
  onRunningChange?: (running: boolean) => void
}) {
  const { t } = useTranslation(),
    mobile = useMediaQuery(useTheme().breakpoints.down('md')),
    navigate = useNavigate(),
    [params] = useSearchParams()
  const view = views.includes(params.get('view') ?? '') ? params.get('view')! : 'chat'
  const [historyOpen, setHistoryOpen] = useState(false),
    [menuOpen, setMenuOpen] = useState(false),
    state = useConversations()
  function selectView(next: string) {
    void navigate({ pathname: '/encore', search: next === 'chat' ? '' : `?view=${next}` })
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
        void state.select(id)
        setHistoryOpen(false)
      }}
      onCreate={() => {
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
        bgcolor: mobile ? 'background.default' : 'background.paper',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          gap: 1,
          px: { xs: 2, md: 3 },
          pt: mobile ? 'calc(env(safe-area-inset-top, 0px) + 12px)' : 2,
          pb: mobile ? 1 : 1.5,
          borderBottom: mobile ? 0 : 1,
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
            component="h1"
            fontWeight={750}
            fontSize={mobile ? 22 : 24}
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
            sx={{ display: 'block', fontSize: mobile ? 11 : 12, lineHeight: 1.4, mt: 0.25 }}
          >
            {mobile
              ? view === 'chat' && activeTitle && activeTitle !== 'New Chat'
                ? activeTitle
                : t('mobile.encoreSubtitle')
              : t('encore.subtitle')}
          </Typography>
        </Box>
        {mobile && (
          <IconButton aria-label={t('encore.conversations')} onClick={() => setHistoryOpen(true)}>
            <HistoryOutlinedIcon />
          </IconButton>
        )}
        {(view === 'chat' || !mobile) && (
          <IconButton
            aria-label={t('encore.newConversation')}
            disabled={state.busy}
            onClick={() => void state.create()}
          >
            <AddCommentOutlinedIcon />
          </IconButton>
        )}
        {mobile && (
          <IconButton aria-label={t('mobile.workspace')} onClick={() => setMenuOpen(true)}>
            <GridViewOutlinedIcon />
          </IconButton>
        )}
      </Box>
      {!mobile && (
        <Tabs
          value={view}
          onChange={(_e, value: string) => selectView(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 2,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
          }}
        >
          {views.map((value) => (
            <Tab
              key={value}
              value={value}
              label={t(`encore.${value === 'chat' ? 'chat' : value}Tab`)}
            />
          ))}
        </Tabs>
      )}
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
        {!mobile && sidebar}
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
        open={mobile && menuOpen}
        onClose={() => setMenuOpen(false)}
        view={view}
        onSelect={selectView}
      />
      <Drawer
        anchor="bottom"
        open={mobile && historyOpen}
        onClose={() => setHistoryOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '24px 24px 0 0',
            width: '100%',
            maxWidth: 600,
            mx: 'auto',
            maxHeight: '85dvh',
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
