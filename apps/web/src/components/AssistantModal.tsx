import { useState, useEffect, useCallback, useRef } from 'react'
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
  TextField,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import CloseIcon from '@mui/icons-material/Close'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import AddIcon from '@mui/icons-material/Add'
import ChatIcon from '@mui/icons-material/Chat'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import { AssistantRuntimeProvider, useThreadRuntime } from '@assistant-ui/react'
import { useChatRuntime, AssistantChatTransport } from '@assistant-ui/react-ai-sdk'
import type { UIMessage } from 'ai'
import { Thread } from './assistant'

interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

// Message format from our backend
interface BackendMessage {
  id: string
  role: string
  content: string
  tool_invocations?: Array<{
    toolCallId: string
    toolName: string
    args: unknown
    result?: unknown
  }>
  created_at: string
}

// Convert backend messages to UIMessage format
// Using type assertions because the runtime format works with assistant-ui
// even if TypeScript types don't align perfectly
function convertToUIMessages(messages: BackendMessage[]): UIMessage[] {
  return messages.map((msg) => {
    // Build the content array (parts) - use 'any' to bypass strict type checking
    // as the runtime structure is compatible with assistant-ui
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = []
    // Also build toolInvocations array for AI SDK compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolInvocations: any[] = []
    
    // Add text part if there's content
    if (msg.content) {
      content.push({ type: 'text', text: msg.content })
    }
    
    // Add tool-call parts from tool_invocations
    if (msg.tool_invocations && msg.tool_invocations.length > 0) {
      for (const invocation of msg.tool_invocations) {
        // Add to content array (ThreadMessage format)
        content.push({
          type: 'tool-call',
          toolCallId: invocation.toolCallId,
          toolName: invocation.toolName,
          args: invocation.args,
          argsText: JSON.stringify(invocation.args),
          isError: false,
          result: invocation.result,
        })
        
        // Also add to toolInvocations array (AI SDK format)
        toolInvocations.push({
          state: 'result',
          toolCallId: invocation.toolCallId,
          toolName: invocation.toolName,
          args: invocation.args,
          result: invocation.result,
        })
      }
    }
    
    // Return message with multiple format properties for compatibility
    return {
      id: msg.id,
      role: msg.role as 'user' | 'assistant' | 'system',
      content,
      parts: content,
      ...(toolInvocations.length > 0 && { toolInvocations }),
    } as unknown as UIMessage
  })
}

// Chat thread area that gets remounted when conversation changes
function ChatThreadArea({
  conversationId,
  initialMessages,
  historicalMessages,
  suggestions,
  setSavingMessages,
  fetchConversations,
}: {
  conversationId: string | null
  initialMessages: UIMessage[]
  historicalMessages: BackendMessage[]
  suggestions: string[]
  setSavingMessages: (saving: boolean) => void
  fetchConversations: () => Promise<void>
}) {
  // Memoize transport to prevent recreation on re-renders
  const transport = useRef(new AssistantChatTransport({ 
    api: '/api/assistant/chat',
    credentials: 'include',
  }))
  
  // Don't pass messages to runtime - it doesn't properly parse tool results
  // Instead, we'll pass historical messages directly to Thread for manual rendering
  const runtime = useChatRuntime({
    transport: transport.current,
  })
  
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <MessageSaver
        conversationId={conversationId}
        initialMessageCount={initialMessages.length}
        setSavingMessages={setSavingMessages}
        fetchConversations={fetchConversations}
      />
      <Thread historicalMessages={historicalMessages} suggestions={suggestions} />
    </AssistantRuntimeProvider>
  )
}

// Component to handle message saving inside the runtime context
function MessageSaver({
  conversationId,
  initialMessageCount,
  setSavingMessages,
  fetchConversations,
}: {
  conversationId: string | null
  initialMessageCount: number
  setSavingMessages: (saving: boolean) => void
  fetchConversations: () => Promise<void>
}) {
  const threadRuntime = useThreadRuntime()
  const savedCountRef = useRef(initialMessageCount)
  const isSavingRef = useRef(false)
  
  // Reset saved count when initialMessageCount changes (new conversation loaded)
  useEffect(() => {
    savedCountRef.current = initialMessageCount
  }, [initialMessageCount])
  
  useEffect(() => {
    // Subscribe to thread state changes
    const unsubscribe = threadRuntime.subscribe(() => {
      const state = threadRuntime.getState()
      
      // Only save when not currently running (assistant has finished)
      // and we have new messages to save
      if (state.isRunning) return
      if (isSavingRef.current) return
      if (!conversationId) return
      
      const messages = state.messages
      if (messages.length <= savedCountRef.current) return
      
      // Get messages that haven't been saved yet
      const unsavedMessages = messages.slice(savedCountRef.current)
      if (unsavedMessages.length === 0) return
      
      // Convert to backend format
      // ThreadMessage uses 'content' as the parts array
      const messagesToSave = unsavedMessages.map(msg => {
        // Extract text content and tool invocations from message content (parts array)
        let textContent = ''
        const toolInvocations: Array<{ toolCallId: string; toolName: string; args: unknown; result?: unknown }> = []
        
        // Collect all parts from the content array
        // Use 'any' type as ThreadMessage content types don't perfectly match
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const part of msg.content as any[]) {
          if (part.type === 'text') {
            textContent += part.text
          } else if (part.type === 'tool-call') {
            // In ThreadMessage, the result is embedded directly in the tool-call part
            toolInvocations.push({
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              args: part.args,
              result: part.result,
            })
          }
        }
        
        return {
          role: msg.role,
          content: textContent,
          ...(toolInvocations.length > 0 && { toolInvocations }),
        }
      })
      
      // Save to backend
      isSavingRef.current = true
      setSavingMessages(true)
      
      fetch(`/api/assistant/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages: messagesToSave }),
      })
        .then((res) => {
          if (!res.ok) {
            return res.text().then(text => {
              console.error('Failed to save messages:', text)
            })
          }
          savedCountRef.current = messages.length
          fetchConversations() // Refresh to update titles
        })
        .catch(err => {
          console.error('Failed to save messages:', err)
        })
        .finally(() => {
          isSavingRef.current = false
          setSavingMessages(false)
        })
    })
    
    return () => unsubscribe()
  }, [threadRuntime, conversationId, setSavingMessages, fetchConversations])
  
  return null
}


export function AssistantModal() {
  const [open, setOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [savingMessages, setSavingMessages] = useState(false)
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([])
  const [historicalMessages, setHistoricalMessages] = useState<BackendMessage[]>([])
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])

  // Fetch personalized suggestions
  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch('/api/assistant/suggestions', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions || [])
      }
    } catch {
      // Silently fail - will use default suggestions
    }
  }, [])

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
      fetchSuggestions()
    }
  }, [open, fetchConversations, fetchSuggestions])

  const handleOpen = async () => {
    setOpen(true)
    
    // Auto-create a conversation if none exists
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
        }
      } catch (err) {
        console.error('Failed to auto-create conversation:', err)
      }
    }
  }
  const handleClose = () => setOpen(false)
  const toggleFullscreen = () => setFullscreen(prev => !prev)

  const handleNewChat = async () => {
    // Clear messages first to trigger remount with empty state
    setInitialMessages([])
    setHistoricalMessages([])
    
    // Create a new conversation in the backend
    try {
      const res = await fetch('/api/assistant/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      })
      if (res.ok) {
        const data = await res.json()
        // Set to null first to force key change, then set new ID
        setActiveConversationId(null)
        // Use setTimeout to ensure React processes the null before setting new ID
        setTimeout(() => {
          setActiveConversationId(data.conversation.id)
        }, 0)
        fetchConversations()
      } else {
        const text = await res.text()
        console.error('Failed to create conversation:', text)
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
        const backendMessages = data.messages || []
        // Store raw backend messages for historical rendering
        setHistoricalMessages(backendMessages)
        // Convert backend messages to UIMessage format (for message count tracking)
        const uiMessages = convertToUIMessages(backendMessages)
        setInitialMessages(uiMessages)
        // Setting the conversation ID after messages triggers remount with loaded messages
        setActiveConversationId(conversationId)
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
          setInitialMessages([])
          setHistoricalMessages([])
          setActiveConversationId(null)
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  const handleStartRename = (conversationId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingConversationId(conversationId)
    setEditTitle(currentTitle)
  }

  const handleCancelRename = () => {
    setEditingConversationId(null)
    setEditTitle('')
  }

  const handleSaveRename = async (conversationId: string) => {
    if (!editTitle.trim()) {
      handleCancelRename()
      return
    }
    
    try {
      const res = await fetch(`/api/assistant/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: editTitle.trim() }),
      })
      if (res.ok) {
        setConversations(prev => 
          prev.map(c => c.id === conversationId ? { ...c, title: editTitle.trim() } : c)
        )
      }
    } catch (err) {
      console.error('Failed to rename conversation:', err)
    }
    handleCancelRename()
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

      {/* Chat Dialog - stable, doesn't remount on conversation switch */}
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        fullScreen={fullscreen}
        PaperProps={{
          sx: {
            height: fullscreen ? '100%' : '95vh',
            maxHeight: fullscreen ? '100%' : '90vh',
            bgcolor: 'rgba(15, 15, 15, 0.85)',
            backdropFilter: 'blur(20px)',
            backgroundImage: 'none',
            borderRadius: fullscreen ? 0 : 3,
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        <Box sx={{ display: 'flex', height: '100%' }}>
          {/* Sidebar - only in fullscreen */}
          {fullscreen && (
            <Box
              sx={{
                width: 280,
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'transparent',
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
                    bgcolor: 'rgba(26, 26, 26, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 2,
                    color: '#f5f5f5',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(37, 37, 37, 0.8)',
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

              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />

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
                        onClick={() => editingConversationId !== convo.id && handleSelectConversation(convo.id)}
                        sx={{
                          borderRadius: 1,
                          mb: 0.5,
                          '&.Mui-selected': {
                            bgcolor: 'rgba(99, 102, 241, 0.15)',
                          },
                          '&:hover .action-btn': {
                            opacity: 1,
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <ChatIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        </ListItemIcon>
                        {editingConversationId === convo.id ? (
                          <TextField
                            size="small"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveRename(convo.id)
                              } else if (e.key === 'Escape') {
                                handleCancelRename()
                              }
                            }}
                            onBlur={() => handleSaveRename(convo.id)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            sx={{
                              flex: 1,
                              '& .MuiInputBase-input': {
                                py: 0.5,
                                fontSize: '0.875rem',
                              },
                              '& .MuiOutlinedInput-root': {
                                bgcolor: 'rgba(26, 26, 26, 0.6)',
                              },
                            }}
                          />
                        ) : (
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
                        )}
                        {editingConversationId !== convo.id && (
                          <>
                            <IconButton
                              className="action-btn"
                              size="small"
                              onClick={(e) => handleStartRename(convo.id, convo.title, e)}
                              sx={{
                                opacity: 0,
                                transition: 'opacity 0.2s',
                                '&:hover': { color: 'primary.main' },
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              className="action-btn"
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
                          </>
                        )}
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </Box>

              {/* Saving indicator */}
              {savingMessages && (
                <Box sx={{ p: 1, borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={12} />
                  <Typography variant="caption" color="text.secondary">
                    Saving...
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Main Chat Area */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
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

            {/* Chat Content - Only this part remounts on conversation switch */}
            <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <ChatThreadArea
                key={activeConversationId || 'new'}
                conversationId={activeConversationId}
                initialMessages={initialMessages}
                historicalMessages={historicalMessages}
                suggestions={suggestions}
                setSavingMessages={setSavingMessages}
                fetchConversations={fetchConversations}
              />
            </Box>
          </Box>
        </Box>
      </Dialog>
    </>
  )
}
