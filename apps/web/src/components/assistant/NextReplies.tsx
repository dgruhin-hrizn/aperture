import { useAui, useAuiState } from '@assistant-ui/react'
import { Box, Chip, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

export function NextReplies() {
  const { t } = useTranslation()
  const composer = useAui().thread().composer()
  const result = useAuiState(({ message, thread }) => {
    if (message.role !== 'assistant' || !message.isLast || thread.isRunning) return undefined
    const part = message.content.find(part => part.type === 'tool-call' && part.toolName === 'suggestNextReplies')
    return part?.type === 'tool-call' ? part.result : undefined
  })
  if (!result || typeof result !== 'object' || !('suggestions' in result)) return null
  if (!Array.isArray(result.suggestions)) return null

  const suggestions = result.suggestions.filter((value): value is string => typeof value === 'string')
  if (!suggestions.length) return null
  const label = t('encore.nextReplies')

  return (
    <Box role="group" aria-label={label}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.75 }}>
        {suggestions.map(suggestion => (
          <Chip
            key={suggestion}
            label={suggestion}
            variant="outlined"
            onClick={() => composer.setText(suggestion)}
            sx={{
              height: 'auto',
              borderRadius: '18px',
              minHeight: { xs: 44, md: 36 },
              maxWidth: '100%',
              '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 },
            }}
          />
        ))}
      </Box>
    </Box>
  )
}
