import { useState, useEffect, FormEvent, useCallback } from 'react'
import { 
  Dialog, 
  Fab, 
  Tooltip, 
  Box,
  IconButton,
  Typography,
  Zoom,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
  CircularProgress,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import CloseIcon from '@mui/icons-material/Close'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import AddIcon from '@mui/icons-material/Add'
import ChatIcon from '@mui/icons-material/Chat'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useChat } from 'ai/react'
import { Thread } from './assistant'

interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export function AssistantModal() {
  const [open, setOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [savingMessages, setSavingMessages] = useState(false)
  
  // Use the Vercel AI SDK's useChat with our custom endpoint
  const { messages, input, handleSubmit, isLoading, setInput, append, setMessages } = useChat({
    api: '/api/assistant/chat',
    credentials: 'include',
  })

  // Fetch conversations when modal opens
  const fetchConversations = useCallback(async () => {
    setLoadingConversations(true)
    try {
      const res = await fetch('/api/assistant/conversations', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    } finally {
      setLoadingConversations(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchConversations()
    }
  }, [open, fetchConversations])

  // Save messages when they change (debounced)
  useEffect(() => {
    if (!activeConversationId || messages.length === 0) return

    const timeoutId = setTimeout(async () => {
      setSavingMessages(true)
      try {
        // Get existing messages from the conversation
        const res = await fetch(`/api/assistant/conversations/${activeConversationId}`, { 
          credentials: 'include' 
        })
        if (!res.ok) return

        const data = await res.json()
        const existingCount = data.messages?.length || 0
        
        // Only save new messages
        const newMessages = messages.slice(existingCount).map(m => ({
          role: m.role,
          content: m.content,
        }))

        if (newMessages.length > 0) {
          await fetch(`/api/assistant/conversations/${activeConversationId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ messages: newMessages }),
          })
          // Refresh conversations to update titles/timestamps
          fetchConversations()
        }
      } catch (err) {
        console.error('Failed to save messages:', err)
      } finally {
        setSavingMessages(false)
      }
    }, 1000) // Debounce 1 second

    return () => clearTimeout(timeoutId)
  }, [messages, activeConversationId, fetchConversations])

  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)
  const toggleFullscreen = () => setFullscreen(prev => !prev)

  const handleNewChat = async () => {
    try {
      const res = await fetch('/api/assistant/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      })
      if (res.ok) {
        const data = await res.json()
        setActiveConversationId(data.conversation.id)
        setMessages([])
        fetchConversations()
      }
    } catch (err) {
      console.error('Failed to create conversation:', err)
    }
  }

  const handleSelectConversation = async (conversationId: string) => {
    if (conversationId === activeConversationId) return

    try {
      const res = await fetch(`/api/assistant/conversations/${conversationId}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setActiveConversationId(conversationId)
        // Convert to useChat message format
        setMessages(
          data.messages.map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))
        )
      }
    } catch (err) {
      console.error('Failed to load conversation:', err)
    }
  }

  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/assistant/conversations/${conversationId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== conversationId))
        if (activeConversationId === conversationId) {
          setActiveConversationId(null)
          setMessages([])
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  const handleSuggestionClick = async (suggestion: string) => {
    // Create a new conversation if none exists
    if (!activeConversationId) {
      try {
        const res = await fetch('/api/assistant/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        })
        if (res.ok) {
          const data = await res.json()
          setActiveConversationId(data.conversation.id)
          fetchConversations()
        }
      } catch (err) {
        console.error('Failed to create conversation:', err)
      }
    }
    append({ role: 'user', content: suggestion })
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim()) return

    // Create a new conversation if none exists
    if (!activeConversationId) {
      try {
        const res = await fetch('/api/assistant/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        })
        if (res.ok) {
          const data = await res.json()
          setActiveConversationId(data.conversation.id)
          fetchConversations()
        }
      } catch (err) {
        console.error('Failed to create conversation:', err)
      }
    }

    handleSubmit(e)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      {/* Floating Action Button */}
      <Tooltip title="AI Assistant" placement="left">
        <Zoom in={!open}>
          <Fab
            color="primary"
            onClick={handleOpen}
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 1000,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              },
            }}
          >
            <AutoAwesomeIcon />
          </Fab>
        </Zoom>
      </Tooltip>

      {/* Chat Dialog */}
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        fullScreen={fullscreen}
        PaperProps={{
          sx: {
            height: fullscreen ? '100%' : '80vh',
            maxHeight: fullscreen ? '100%' : 700,
            bgcolor: '#0f0f0f',
            backgroundImage: 'none',
            borderRadius: fullscreen ? 0 : 3,
            overflow: 'hidden',
          },
        }}
      >
        <Box sx={{ display: 'flex', height: '100%' }}>
          {/* Sidebar - only in fullscreen */}
          {fullscreen && (
            <Box
              sx={{
                width: 280,
                borderRight: '1px solid #2a2a2a',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: '#0a0a0a',
              }}
            >
              {/* New Chat Button */}
              <Box sx={{ p: 2 }}>
                <Box
                  component="button"
                  onClick={handleNewChat}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1.5,
                    bgcolor: '#1a1a1a',
                    border: '1px solid #2a2a2a',
                    borderRadius: 2,
                    color: '#f5f5f5',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: '#252525',
                      borderColor: '#6366f1',
                    },
                  }}
                >
                  <AddIcon fontSize="small" />
                  <Typography variant="body2" fontWeight={500}>
                    New Chat
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ borderColor: '#2a2a2a' }} />

              {/* Conversations List */}
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {loadingConversations ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : conversations.length === 0 ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No conversations yet
                    </Typography>
                  </Box>
                ) : (
                  <List dense sx={{ px: 1 }}>
                    {conversations.map((convo) => (
                      <ListItemButton
                        key={convo.id}
                        selected={convo.id === activeConversationId}
                        onClick={() => handleSelectConversation(convo.id)}
                        sx={{
                          borderRadius: 1,
                          mb: 0.5,
                          '&.Mui-selected': {
                            bgcolor: 'rgba(99, 102, 241, 0.15)',
                          },
                          '&:hover .delete-btn': {
                            opacity: 1,
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <ChatIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={convo.title}
                          secondary={formatDate(convo.updated_at)}
                          primaryTypographyProps={{
                            noWrap: true,
                            variant: 'body2',
                          }}
                          secondaryTypographyProps={{
                            variant: 'caption',
                          }}
                        />
                        <IconButton
                          className="delete-btn"
                          size="small"
                          onClick={(e) => handleDeleteConversation(convo.id, e)}
                          sx={{
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            '&:hover': { color: 'error.main' },
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </Box>

              {/* Saving indicator */}
              {savingMessages && (
                <Box sx={{ p: 1, borderTop: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={12} />
                  <Typography variant="caption" color="text.secondary">
                    Saving...
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Main Chat Area */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                borderBottom: '1px solid #2a2a2a',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  }}
                >
                  <SmartToyIcon sx={{ fontSize: 20, color: '#fff' }} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Aperture Assistant
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    AI-powered recommendations
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {!fullscreen && (
                  <Tooltip title="New chat">
                    <IconButton onClick={handleNewChat} size="small">
                      <AddIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                  <IconButton onClick={toggleFullscreen} size="small">
                    {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                  </IconButton>
                </Tooltip>
                <IconButton onClick={handleClose} size="small">
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>

            {/* Chat Content */}
            <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Thread
                messages={messages}
                input={input}
                isLoading={isLoading}
                onInputChange={(value) => setInput(value)}
                onSubmit={onSubmit}
                onSuggestionClick={handleSuggestionClick}
              />
            </Box>
          </Box>
        </Box>
      </Dialog>
    </>
  )
}
