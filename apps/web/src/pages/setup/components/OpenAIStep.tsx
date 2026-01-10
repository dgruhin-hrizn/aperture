import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  LooksOne as LooksOneIcon,
  LooksTwo as LooksTwoIcon,
  Looks3 as Looks3Icon,
  Looks4 as Looks4Icon,
  OpenInNew as OpenInNewIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material'
import { useState } from 'react'
import type { SetupWizardContext } from '../types'

interface OpenAIStepProps {
  wizard: SetupWizardContext
}

export function OpenAIStep({ wizard }: OpenAIStepProps) {
  const {
    error,
    openaiKey,
    setOpenaiKey,
    showOpenaiKey,
    setShowOpenaiKey,
    existingOpenaiKey,
    openaiTestSuccess,
    testing,
    saving,
    handleTestOpenAI,
    handleSaveOpenAI,
    goToStep,
  } = wizard

  // Local state for expanding the "replace key" section
  const [showReplaceSection, setShowReplaceSection] = useState(false)

  // If there's an existing key and user hasn't started entering a new one
  const hasExistingKey = !!existingOpenaiKey

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Connect OpenAI API
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Aperture uses OpenAI to power its AI recommendation engine. This includes generating embeddings to understand
        your media library, creating personalized recommendations, and powering the AI chat assistant.
      </Typography>

      {/* Existing Key Display */}
      {hasExistingKey && (
        <Alert
          severity="success"
          icon={<CheckCircleIcon />}
          sx={{ mb: 3 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Box>
              <Typography variant="body2" fontWeight={500}>
                API Key Configured
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary', mt: 0.5 }}>
                {existingOpenaiKey}
              </Typography>
            </Box>
          </Box>
        </Alert>
      )}

      {/* Instructions - collapsed if existing key */}
      {!hasExistingKey && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight={500} gutterBottom>
            How to get your OpenAI API Key:
          </Typography>
          <List dense disablePadding sx={{ mt: 1 }}>
            <ListItem disableGutters sx={{ py: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <LooksOneIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2">
                    Go to{' '}
                    <Link href="https://platform.openai.com/signup" target="_blank" rel="noopener noreferrer">
                      platform.openai.com
                      <OpenInNewIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle' }} />
                    </Link>{' '}
                    and create an account (or sign in)
                  </Typography>
                }
              />
            </ListItem>
            <ListItem disableGutters sx={{ py: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <LooksTwoIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2">
                    Navigate to{' '}
                    <Link href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                      API Keys
                      <OpenInNewIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle' }} />
                    </Link>{' '}
                    in your dashboard
                  </Typography>
                }
              />
            </ListItem>
            <ListItem disableGutters sx={{ py: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <Looks3Icon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={<Typography variant="body2">Click "Create new secret key" and give it a name (e.g., "Aperture")</Typography>}
              />
            </ListItem>
            <ListItem disableGutters sx={{ py: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <Looks4Icon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2">
                    Copy the key (starts with <code>sk-</code>) and paste it below
                  </Typography>
                }
              />
            </ListItem>
          </List>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            💡 OpenAI offers $5 free credits for new accounts. Typical Aperture usage costs ~$0.10-0.50/month.
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {openaiTestSuccess && openaiKey && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
          New API key is valid!
        </Alert>
      )}

      {/* Replace Key Section - Collapsible when existing key */}
      {hasExistingKey ? (
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            color="inherit"
            onClick={() => setShowReplaceSection(!showReplaceSection)}
            endIcon={<ExpandMoreIcon sx={{ transform: showReplaceSection ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />}
            sx={{ color: 'text.secondary', textTransform: 'none' }}
          >
            Replace with a different key
          </Button>
          <Collapse in={showReplaceSection}>
            <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <TextField
                fullWidth
                label="New OpenAI API Key"
                type={showOpenaiKey ? 'text' : 'password'}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                size="small"
                placeholder="sk-proj-..."
                helperText="Enter a new key to replace the existing one"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowOpenaiKey(!showOpenaiKey)} edge="end" size="small">
                        {showOpenaiKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              {openaiKey && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleTestOpenAI}
                  disabled={testing}
                  sx={{ mt: 2 }}
                >
                  {testing ? <CircularProgress size={16} /> : 'Test New Key'}
                </Button>
              )}
            </Box>
          </Collapse>
        </Box>
      ) : (
        <TextField
          fullWidth
          label="OpenAI API Key"
          type={showOpenaiKey ? 'text' : 'password'}
          value={openaiKey}
          onChange={(e) => setOpenaiKey(e.target.value)}
          margin="normal"
          placeholder="sk-proj-..."
          helperText="Your API key is stored securely and never shared"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowOpenaiKey(!showOpenaiKey)} edge="end">
                  {showOpenaiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      )}

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button variant="outlined" onClick={() => goToStep('topPicks')}>
          Back
        </Button>
        {/* Only show separate test button when no existing key */}
        {!hasExistingKey && openaiKey && (
          <Button variant="outlined" onClick={handleTestOpenAI} disabled={testing}>
            {testing ? <CircularProgress size={20} /> : 'Test Key'}
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleSaveOpenAI}
          disabled={saving || (!!openaiKey && !openaiTestSuccess)}
        >
          {saving ? (
            <CircularProgress size={20} />
          ) : openaiKey && openaiTestSuccess ? (
            'Save New Key & Continue'
          ) : hasExistingKey ? (
            'Continue'
          ) : (
            'Continue'
          )}
        </Button>
      </Box>
    </Box>
  )
}
