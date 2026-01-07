import { Box, Paper, Typography, Avatar, CircularProgress, TextField, IconButton, Button } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import PersonIcon from '@mui/icons-material/Person'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useComposerRuntime,
} from '@assistant-ui/react'
import {
  ContentCarousel,
  ContentDetail,
  PersonResult,
  StatsDisplay,
  StudiosDisplay,
  getToolSkeleton,
  type ContentCarouselData,
  type ContentDetailData,
  type PersonResultData,
  type StatsData,
  type StudiosData,
} from './tool-ui'

// Custom link renderer for markdown
const MarkdownLink: Components['a'] = ({ href, children }) => {
  const text = String(children)
  const isPlayLink = text.toLowerCase().includes('play') || text.includes('▶️')
  
  if (isPlayLink && href) {
    return (
      <Button
        variant="contained"
        size="small"
        startIcon={<PlayArrowIcon />}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          mt: 1,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          textTransform: 'none',
          '&:hover': {
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          },
        }}
      >
        Play on Emby
      </Button>
    )
  }

  return (
    <a
      href={href}
      target={href?.startsWith('/') ? undefined : '_blank'}
      rel={href?.startsWith('/') ? undefined : 'noopener noreferrer'}
      style={{
        color: '#818cf8',
        textDecoration: 'none',
      }}
    >
      {children}
    </a>
  )
}

// Render tool result based on tool name
function renderToolResult(toolName: string, result: unknown): React.ReactNode {
  if (!result || typeof result !== 'object') return null
  
  const data = result as Record<string, unknown>
  
  // Check if result has an error
  if ('error' in data && typeof data.error === 'string') {
    return (
      <Box sx={{ p: 2, bgcolor: 'rgba(26, 26, 26, 0.7)', borderRadius: 2, my: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {data.error}
        </Typography>
      </Box>
    )
  }

  // Content carousel tools (search, similar, recommendations, history, ratings, unwatched, top rated)
  if ('items' in data && Array.isArray(data.items)) {
    return <ContentCarousel data={data as unknown as ContentCarouselData} />
  }

  // Content detail tool
  if ('contentId' in data && 'actions' in data) {
    return <ContentDetail data={data as unknown as ContentDetailData} />
  }

  // Person search results
  if ('people' in data && Array.isArray(data.people)) {
    return <PersonResult data={data as unknown as PersonResultData} />
  }

  // Library stats
  if ('movieCount' in data && 'seriesCount' in data) {
    return <StatsDisplay data={data as unknown as StatsData} />
  }

  // Studios/networks
  if (('studios' in data && Array.isArray(data.studios)) || ('networks' in data && Array.isArray(data.networks))) {
    return <StudiosDisplay data={data as unknown as StudiosData} />
  }

  // Fallback - don't render anything for unrecognized tool results
  return null
}

// Tool UI component for rendering tool results (or skeleton while loading)
function ToolUI({ toolName, result }: { toolName: string; result: unknown }) {
  // Show skeleton if result is undefined (tool still running)
  if (result === undefined) {
    return <>{getToolSkeleton(toolName)}</>
  }
  return <>{renderToolResult(toolName, result)}</>
}

// User message component
function UserMessage() {
  return (
    <MessagePrimitive.Root>
      <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', py: 1.5 }}>
        <Paper
          sx={{
            maxWidth: '80%',
            p: 2,
            bgcolor: '#6366f1',
            borderRadius: 2,
            borderTopRightRadius: 0,
          }}
        >
          <Typography variant="body1" sx={{ color: '#fff' }}>
            <MessagePrimitive.Content />
          </Typography>
        </Paper>
        <Avatar sx={{ bgcolor: '#3a3a3a', width: 36, height: 36 }}>
          <PersonIcon fontSize="small" />
        </Avatar>
      </Box>
    </MessagePrimitive.Root>
  )
}

// Assistant message component
function AssistantMessage() {
  return (
    <MessagePrimitive.Root>
      <Box 
        sx={{ 
          display: 'flex', 
          gap: 1.5, 
          py: 1.5,
          // Hide the entire row if content area is empty (no visible children)
          '&:has(.assistant-content:empty)': {
            display: 'none',
          },
        }}
      >
        <Avatar
          sx={{
            width: 36,
            height: 36,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            flexShrink: 0,
          }}
        >
          <SmartToyIcon fontSize="small" />
        </Avatar>
        <Box className="assistant-content" sx={{ flex: 1, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
          <MessagePrimitive.Content
            components={{
              Text: ({ text }) => {
                // Don't render empty text parts
                if (!text || !text.trim()) return null
                return (
                  <Paper
                    sx={{
                      maxWidth: '90%',
                      p: 2,
                      bgcolor: 'rgba(26, 26, 26, 0.7)',
                      borderRadius: 2,
                      borderTopLeftRadius: 0,
                    }}
                  >
                    <Box
                      sx={{
                        '& p': { my: 1.5 },
                        '& p:first-of-type': { mt: 0 },
                        '& p:last-of-type': { mb: 0 },
                        '& ul, & ol': { pl: 2, my: 1.5 },
                        '& li': { mb: 0.75 },
                        '& strong': { color: '#818cf8' },
                        '& code': {
                          bgcolor: '#2a2a2a',
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 0.5,
                          fontFamily: 'monospace',
                        },
                        '& img': {
                          maxWidth: 120,
                          height: 'auto',
                          borderRadius: 1,
                          display: 'block',
                          my: 1.5,
                        },
                        '& hr': {
                          border: 'none',
                          borderTop: '1px solid #3a3a3a',
                          my: 2.5,
                        },
                        '& blockquote': {
                          borderLeft: '3px solid #6366f1',
                          pl: 2,
                          my: 1.5,
                          color: '#a1a1aa',
                          fontStyle: 'italic',
                        },
                        '& h1, & h2, & h3, & h4': {
                          mt: 2,
                          mb: 1,
                          color: '#e4e4e7',
                        },
                      }}
                    >
                      <ReactMarkdown components={{ a: MarkdownLink }}>{text}</ReactMarkdown>
                    </Box>
                  </Paper>
                )
              },
              tools: {
                Fallback: ({ toolName, result }) => (
                  <Box sx={{ maxWidth: '100%', overflow: 'hidden', mb: 2 }}>
                    <ToolUI toolName={toolName} result={result} />
                  </Box>
                ),
              },
            }}
          />
        </Box>
      </Box>
    </MessagePrimitive.Root>
  )
}

// Default suggestions (fallback)
const DEFAULT_SUGGESTIONS = [
  'What should I watch tonight?',
  'Show me my top picks',
  'Find me something like Inception',
  'What sci-fi movies do you recommend?',
]

// Thread welcome screen
function ThreadWelcome({ suggestions }: { suggestions: string[] }) {
  const composerRuntime = useComposerRuntime()
  
  const displaySuggestions = suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS

  const handleSuggestionClick = (suggestion: string) => {
    composerRuntime.setText(suggestion)
    composerRuntime.send()
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        textAlign: 'center',
        p: 4,
      }}
    >
      <Avatar
        sx={{
          width: 64,
          height: 64,
          mb: 2,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        }}
      >
        <SmartToyIcon sx={{ fontSize: 36 }} />
      </Avatar>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
        Hi! I'm Aperture
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400 }}>
        Your AI movie and TV recommendation assistant. Ask me to find something to watch, discover similar titles, or explore your personalized picks!
      </Typography>
      <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
        {displaySuggestions.map((suggestion) => (
          <Paper
            key={suggestion}
            component="button"
            type="button"
            onClick={() => handleSuggestionClick(suggestion)}
            sx={{
              px: 2,
              py: 1,
              bgcolor: 'rgba(26, 26, 26, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 2,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: '#252525',
                borderColor: '#6366f1',
              },
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {suggestion}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  )
}

// Loading indicator
function LoadingIndicator() {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 1.5 }}>
      <Avatar
        sx={{
          width: 36,
          height: 36,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        }}
      >
        <SmartToyIcon fontSize="small" />
      </Avatar>
      <Paper
        sx={{
          maxWidth: '80%',
          p: 2,
          bgcolor: 'rgba(26, 26, 26, 0.7)',
          borderRadius: 2,
          borderTopLeftRadius: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
          <CircularProgress size={16} />
          <Typography variant="body2">Thinking...</Typography>
        </Box>
      </Paper>
    </Box>
  )
}

// Composer component
function Composer() {
  const composerRuntime = useComposerRuntime()
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    composerRuntime.send()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      composerRuntime.send()
    }
  }

  return (
    <ComposerPrimitive.Root>
      <Box sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <ComposerPrimitive.Input asChild>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="Ask me anything about movies or shows..."
              onKeyDown={handleKeyDown}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(26, 26, 26, 0.7)',
                  borderRadius: 3,
                  '& fieldset': {
                    borderColor: '#2a2a2a',
                  },
                  '&:hover fieldset': {
                    borderColor: '#3a3a3a',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#6366f1',
                  },
                },
                '& .MuiInputBase-input': {
                  py: 1.5,
                },
              }}
            />
          </ComposerPrimitive.Input>
          <ComposerPrimitive.Send asChild>
            <IconButton
              type="submit"
              sx={{
                bgcolor: '#6366f1',
                color: '#fff',
                width: 44,
                height: 44,
                '&:hover': {
                  bgcolor: '#4f46e5',
                },
                '&:disabled': {
                  bgcolor: '#3a3a3a',
                  color: '#666',
                },
              }}
            >
              <SendIcon />
            </IconButton>
          </ComposerPrimitive.Send>
        </form>
      </Box>
    </ComposerPrimitive.Root>
  )
}

// Historical message type (from backend)
interface HistoricalMessage {
  id: string
  role: string
  content: string
  tool_invocations?: Array<{
    toolCallId: string
    toolName: string
    args: unknown
    result?: unknown
  }>
}

// Render a historical user message
function HistoricalUserMessage({ message }: { message: HistoricalMessage }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', py: 1.5 }}>
      <Paper
        sx={{
          maxWidth: '80%',
          p: 2,
          bgcolor: '#6366f1',
          borderRadius: 2,
          borderTopRightRadius: 0,
        }}
      >
        <Typography variant="body1" sx={{ color: '#fff' }}>
          {message.content}
        </Typography>
      </Paper>
      <Avatar sx={{ bgcolor: '#3a3a3a', width: 36, height: 36 }}>
        <PersonIcon fontSize="small" />
      </Avatar>
    </Box>
  )
}

// Render a historical assistant message
function HistoricalAssistantMessage({ message }: { message: HistoricalMessage }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 1.5 }}>
      <Avatar
        sx={{
          width: 36,
          height: 36,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          flexShrink: 0,
        }}
      >
        <SmartToyIcon fontSize="small" />
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
        {/* Render text content */}
        {message.content && (
          <Paper
            sx={{
              maxWidth: '90%',
              p: 2,
              bgcolor: 'rgba(26, 26, 26, 0.7)',
              borderRadius: 2,
              borderTopLeftRadius: 0,
              mb: 2,
            }}
          >
            <Box
              sx={{
                '& p': { my: 1.5 },
                '& p:first-of-type': { mt: 0 },
                '& p:last-of-type': { mb: 0 },
              }}
            >
              <ReactMarkdown components={{ a: MarkdownLink }}>{message.content}</ReactMarkdown>
            </Box>
          </Paper>
        )}
        {/* Render tool results */}
        {message.tool_invocations?.map((invocation) => (
          <Box key={invocation.toolCallId} sx={{ maxWidth: '100%', overflow: 'hidden', mb: 2 }}>
            <ToolUI toolName={invocation.toolName} result={invocation.result} />
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// Props for Thread component
interface ThreadProps {
  historicalMessages?: HistoricalMessage[]
  suggestions?: string[]
}

// Main Thread component
export function Thread({ historicalMessages = [], suggestions = [] }: ThreadProps) {
  const hasHistoricalMessages = historicalMessages.length > 0
  
  return (
    <ThreadPrimitive.Root
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'transparent',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {/* Messages */}
      <ThreadPrimitive.Viewport
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 0,
        }}
      >
        {/* Show welcome only if no historical messages */}
        {!hasHistoricalMessages && (
          <ThreadPrimitive.Empty>
            <ThreadWelcome suggestions={suggestions} />
          </ThreadPrimitive.Empty>
        )}

        {/* Render historical messages manually */}
        {historicalMessages.map((msg) => (
          msg.role === 'user' 
            ? <HistoricalUserMessage key={msg.id} message={msg} />
            : <HistoricalAssistantMessage key={msg.id} message={msg} />
        ))}

        {/* Runtime handles new messages */}
        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />

        <ThreadPrimitive.If running>
          <LoadingIndicator />
        </ThreadPrimitive.If>
      </ThreadPrimitive.Viewport>

      {/* Composer */}
      <Composer />
    </ThreadPrimitive.Root>
  )
}
