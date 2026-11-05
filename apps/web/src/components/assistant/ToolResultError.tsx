import { Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'

export function ToolResultError({ message }: { message: string }) {
  const { t } = useTranslation()
  return (
    <Alert
      severity="error"
      variant="outlined"
      sx={{ borderRadius: 2, py: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
    >
      <strong>{t('assistant.toolErrorTitle')}</strong>
      <br />
      {t('assistant.toolErrorBody', { message })}
    </Alert>
  )
}
