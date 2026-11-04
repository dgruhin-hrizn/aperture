import { useState } from 'react'
import { Alert, IconButton, Snackbar, Tooltip, useTheme } from '@mui/material'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import { useTranslation } from 'react-i18next'
import { useAppearance } from './context'

export function ColorModeToggle() {
  const { t } = useTranslation()
  const theme = useTheme()
  const { preferences, loading, saving, loadError, updateAppearance } = useAppearance()
  const [error, setError] = useState(false)
  if (preferences.theme !== 'studio') return null
  const next = theme.palette.mode === 'dark' ? 'light' : 'dark'
  async function toggle() {
    try {
      await updateAppearance({ ...preferences, mode: next })
    } catch {
      setError(true)
    }
  }
  return (
    <>
      <Tooltip title={t(next === 'light' ? 'appearance.switchLight' : 'appearance.switchDark')}>
        <span>
          <IconButton
            aria-label={t(next === 'light' ? 'appearance.switchLight' : 'appearance.switchDark')}
            disabled={loading || saving || loadError}
            onClick={() => void toggle()}
          >
            {next === 'light' ? (
              <LightModeOutlinedIcon fontSize="small" />
            ) : (
              <DarkModeOutlinedIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>
      <Snackbar open={error} autoHideDuration={6000} onClose={() => setError(false)}>
        <Alert severity="error" onClose={() => setError(false)}>
          {t('appearance.saveError')}
        </Alert>
      </Snackbar>
    </>
  )
}
