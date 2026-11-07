import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Stack,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTranslation } from 'react-i18next'

/** The same compatibility guidance wherever generated libraries are configured. */
export function OutputFormatGuide({ useSymlinks }: { useSymlinks: boolean }) {
  const { t } = useTranslation()
  const [testedMode, setTestedMode] = useState(useSymlinks)
  const [busy, setBusy] = useState(false)
  const [checks, setChecks] = useState<
    Array<{ id: string; name: string; description: string; status: string; suggestion?: string }>
  >([])
  const [error, setError] = useState('')
  const check = async () => {
    setTestedMode(useSymlinks)
    setBusy(true)
    setError('')
    setChecks([])
    try {
      const response = await fetch('/api/setup/validate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useSymlinks }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || t('settingsOutputGuide.checkFailed'))
      setChecks(result.checks)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settingsOutputGuide.checkFailed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Stack spacing={1.5} sx={{ my: 2 }}>
      <Alert severity="info">{t('settingsOutputGuide.choose')}</Alert>
      <Button variant="outlined" disabled={busy} onClick={check}>
        {t(busy ? 'settingsOutputGuide.checking' : 'settingsOutputGuide.check')}
      </Button>
      <Typography variant="caption">{t('settingsOutputGuide.savedPaths')}</Typography>
      {testedMode === useSymlinks && error && <Alert severity="error">{error}</Alert>}
      {testedMode === useSymlinks &&
        checks.map((result) => (
          <Alert
            key={result.id}
            severity={
              result.status === 'failed'
                ? 'error'
                : result.status === 'warning'
                  ? 'warning'
                  : 'success'
            }
          >
            <strong>{result.name}</strong>: {result.description} {result.suggestion}
          </Alert>
        ))}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>{t('settingsOutputGuide.title')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {[
              'strm',
              'symlinks',
              'windows',
              'containers',
              'filesystems',
              'network',
              'paths',
              'playback',
              'sidecars',
              'validation',
            ].map((key) => (
              <Typography key={key} variant="body2">
                {t(`settingsOutputGuide.${key}`)}
              </Typography>
            ))}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  )
}
