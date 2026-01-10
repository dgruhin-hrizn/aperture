import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
  IconButton,
  Alert,
  Button,
  CircularProgress,
  Radio,
} from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SaveIcon from '@mui/icons-material/Save'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

interface ChatAssistantModel {
  id: string
  name: string
  description: string
  inputCostPerMillion: number
  outputCostPerMillion: number
  contextWindow: string
}

interface ChatModelData {
  currentModel: string
  availableModels: ChatAssistantModel[]
}

export function ChatAssistantModelSection() {
  const [data, setData] = useState<ChatModelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/settings/chat-assistant-model')
      if (!response.ok) {
        throw new Error('Failed to fetch chat assistant model settings')
      }
      const result: ChatModelData = await response.json()
      setData(result)
      setSelectedModel(result.currentModel)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!selectedModel) return

    try {
      setSaving(true)
      setSaveSuccess(false)
      const response = await fetch('/api/settings/chat-assistant-model', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      })
      if (!response.ok) {
        throw new Error('Failed to save chat assistant model')
      }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = data && selectedModel !== data.currentModel

  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading chat assistant settings...</Typography>
      </Paper>
    )
  }

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Paper>
    )
  }

  if (!data) return null

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AutoAwesomeIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>
          Chat Assistant Model
        </Typography>
        <Tooltip title="Select the OpenAI model used for the AI chat assistant. More powerful models provide better recommendations but cost more.">
          <IconButton size="small">
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        This model powers the <strong>AI chat assistant</strong> for finding content, getting recommendations,
        and answering questions about your library. Changes take effect immediately.
      </Typography>

      {/* Model Selection Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={50}></TableCell>
              <TableCell>Model</TableCell>
              <TableCell>Context Window</TableCell>
              <TableCell align="right">Input Cost</TableCell>
              <TableCell align="right">Output Cost</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.availableModels.map((model) => (
              <TableRow
                key={model.id}
                hover
                onClick={() => setSelectedModel(model.id)}
                sx={{
                  cursor: 'pointer',
                  bgcolor: selectedModel === model.id ? 'action.selected' : 'inherit',
                }}
              >
                <TableCell>
                  <Radio
                    checked={selectedModel === model.id}
                    value={model.id}
                    size="small"
                    onChange={() => setSelectedModel(model.id)}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={selectedModel === model.id ? 600 : 400}>
                    {model.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {model.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={model.contextWindow} size="small" variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">${model.inputCostPerMillion.toFixed(2)}/M tokens</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">${model.outputCostPerMillion.toFixed(2)}/M tokens</Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Save Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          startIcon={saving ? <CircularProgress size={16} /> : saveSuccess ? <CheckCircleIcon /> : <SaveIcon />}
        >
          {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Model Selection'}
        </Button>
        {hasChanges && (
          <Typography variant="caption" color="warning.main">
            You have unsaved changes
          </Typography>
        )}
        {saveSuccess && (
          <Typography variant="caption" color="success.main">
            Model saved successfully
          </Typography>
        )}
      </Box>
    </Paper>
  )
}


