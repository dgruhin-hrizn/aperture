import { Box, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

export function ToolResultError({ message }: { message: string }) {
  const { t } = useTranslation()
  return (
    <Box sx={{ p: 2, bgcolor: 'rgba(26, 26, 26, 0.7)', borderRadius: 2, my: 1 }}>
      <Typography variant="subtitle2" color="error" sx={{ mb: 0.5 }}>
        {t('assistant.toolErrorTitle')}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        component="pre"
        sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', m: 0 }}
      >
        {t('assistant.toolErrorBody', { message })}
      </Typography>
    </Box>
  )
}
