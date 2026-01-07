import { useState, FormEvent } from 'react'
import { 
  Dialog, 
  Fab, 
  Tooltip, 
  Box,
  IconButton,
  Typography,
  Zoom,
} from '@mui/material'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import CloseIcon from '@mui/icons-material/Close'
import { useChat } from 'ai/react'
import { Thread } from './assistant'

export function AssistantModal() {
  const [open, setOpen] = useState(false)
  
  // Use the Vercel AI SDK's useChat with our custom endpoint
  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput, append } = useChat({
    api: '/api/assistant/chat',
    credentials: 'include',
  })

  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)

  const handleSuggestionClick = (suggestion: string) => {
    // Append the suggestion as a user message
    append({ role: 'user', content: suggestion })
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (input.trim()) {
      handleSubmit(e)
    }
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
            <SmartToyIcon />
          </Fab>
        </Zoom>
      </Tooltip>

      {/* Chat Dialog */}
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            height: '80vh',
            maxHeight: 700,
            bgcolor: '#0f0f0f',
            backgroundImage: 'none',
            borderRadius: 3,
            overflow: 'hidden',
          },
        }}
      >
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
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
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
      </Dialog>
    </>
  )
}

