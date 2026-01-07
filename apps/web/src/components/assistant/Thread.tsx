import { useRef, useEffect, FormEvent, KeyboardEvent } from 'react'
import { Box, IconButton, Paper, Typography, Avatar, CircularProgress, TextField } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import PersonIcon from '@mui/icons-material/Person'
import ReactMarkdown from 'react-markdown'
import type { Message } from 'ai'

interface ThreadProps {
  messages: Message[]
  input: string
  isLoading: boolean
  onInputChange: (value: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onSuggestionClick: (suggestion: string) => void
}

// Custom styled Thread for Aperture's dark theme
export function Thread({ messages, input, isLoading, onInputChange, onSubmit, onSuggestionClick }: ThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const form = e.currentTarget.closest('form')
      if (form) {
        form.requestSubmit()
      }
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: '#0f0f0f',
      }}
    >
      {/* Messages */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {messages.length === 0 ? (
          <ThreadWelcome onSuggestionClick={onSuggestionClick} />
        ) : (
          <>
            {messages.map((message) =>
              message.role === 'user' ? (
                <UserMessage key={message.id} content={message.content} />
              ) : (
                <AssistantMessage key={message.id} content={message.content} />
              )
            )}
            {isLoading && (
              <Box sx={{ display: 'flex', gap: 1.5 }}>
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
                    bgcolor: '#1a1a1a',
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
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Composer */}
      <Box sx={{ p: 2, borderTop: '1px solid #2a2a2a' }}>
        <form onSubmit={onSubmit} style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder="Ask me anything about movies or shows..."
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#1a1a1a',
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
          <IconButton
            type="submit"
            disabled={isLoading || !input.trim()}
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
        </form>
      </Box>
    </Box>
  )
}

function ThreadWelcome({ onSuggestionClick }: { onSuggestionClick: (suggestion: string) => void }) {
  const suggestions = [
    'Find me something like Inception',
    'What sci-fi movies do you recommend?',
    'Show me my top picks',
    'What should I watch tonight?',
  ]

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
        {suggestions.map((suggestion) => (
          <Paper
            key={suggestion}
            component="button"
            type="button"
            onClick={() => onSuggestionClick(suggestion)}
            sx={{
              px: 2,
              py: 1,
              bgcolor: '#1a1a1a',
              border: '1px solid #2a2a2a',
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

function UserMessage({ content }: { content: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        justifyContent: 'flex-end',
      }}
    >
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
          {content}
        </Typography>
      </Paper>
      <Avatar sx={{ bgcolor: '#3a3a3a', width: 36, height: 36 }}>
        <PersonIcon fontSize="small" />
      </Avatar>
    </Box>
  )
}

function AssistantMessage({ content }: { content: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
      }}
    >
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
          bgcolor: '#1a1a1a',
          borderRadius: 2,
          borderTopLeftRadius: 0,
        }}
      >
        <Box
          sx={{
            '& p': { my: 1 },
            '& p:first-of-type': { mt: 0 },
            '& p:last-of-type': { mb: 0 },
            '& ul, & ol': { pl: 2, my: 1 },
            '& li': { mb: 0.5 },
            '& strong': { color: '#818cf8' },
            '& code': {
              bgcolor: '#2a2a2a',
              px: 0.5,
              py: 0.25,
              borderRadius: 0.5,
              fontFamily: 'monospace',
            },
          }}
        >
          <ReactMarkdown>{content}</ReactMarkdown>
        </Box>
      </Paper>
    </Box>
  )
}

