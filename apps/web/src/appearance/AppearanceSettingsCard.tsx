import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import { useTranslation } from 'react-i18next'
import { useAppearance } from './context'
import type { ColorMode } from './preferences'

export function AppearanceSettingsCard() {
  const { t } = useTranslation()
  const { preferences, loading, saving, loadError, reload, updateAppearance } = useAppearance()
  const [draft, setDraft] = useState(preferences)
  const [error, setError] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    setDraft(preferences)
  }, [preferences])
  const changed = draft.theme !== preferences.theme || draft.mode !== preferences.mode
  async function save() {
    setError(false)
    setSaved(false)
    try {
      await updateAppearance(draft)
      setSaved(true)
    } catch {
      setError(true)
    }
  }

  return (
    <Card id="appearance" variant="outlined" sx={{ scrollMarginTop: 88 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
          <PaletteOutlinedIcon color="primary" />
          <Typography variant="h6">{t('appearance.title')}</Typography>
        </Stack>
        <Typography color="text.secondary" variant="body2" mb={3}>
          {t('appearance.description')}
        </Typography>
        {loadError && (
          <Alert
            severity="error"
            action={<Button onClick={reload}>{t('appearance.retry')}</Button>}
            sx={{ mb: 2 }}
          >
            {t('appearance.loadError')}
          </Alert>
        )}
        {error && (
          <Alert severity="error" onClose={() => setError(false)} sx={{ mb: 2 }}>
            {t('appearance.saveError')}
          </Alert>
        )}
        {saved && !changed && (
          <Alert severity="success" onClose={() => setSaved(false)} sx={{ mb: 2 }}>
            {t('appearance.saved')}
          </Alert>
        )}
        {loading ? (
          <CircularProgress size={24} aria-label={t('common.loading')} />
        ) : (
          <>
            <Box
              role="group"
              aria-label={t('appearance.theme')}
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}
            >
              {(['classic', 'studio'] as const).map((name) => (
                <Button
                  key={name}
                  variant="outlined"
                  disabled={saving || loadError}
                  aria-pressed={draft.theme === name}
                  onClick={() => {
                    setDraft({ ...draft, theme: name })
                    setSaved(false)
                  }}
                  sx={{
                    display: 'block',
                    p: 2,
                    textAlign: 'start',
                    color: 'text.primary',
                    borderColor: draft.theme === name ? 'primary.main' : 'divider',
                    bgcolor: draft.theme === name ? 'action.selected' : undefined,
                  }}
                >
                  {/* The two previews intentionally retain their own palette. */}
                  <Box
                    aria-hidden="true"
                    sx={{
                      display: 'flex',
                      height: 80,
                      mb: 1.5,
                      bgcolor: name === 'classic' ? '#0f0f0f' : '#f1f4fa',
                      borderRadius: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        width: 28,
                        bgcolor: name === 'classic' ? '#1a1a1a' : '#14213b',
                        p: 0.75,
                      }}
                    >
                      {[0, 1, 2, 3].map((i) => (
                        <Box
                          key={i}
                          sx={{
                            height: 3,
                            mt: 1,
                            bgcolor:
                              i === 1 ? (name === 'classic' ? '#818cf8' : '#87a5ff') : '#53647f',
                          }}
                        />
                      ))}
                    </Box>
                    <Box sx={{ flex: 1, p: 1.25 }}>
                      <Box
                        sx={{
                          width: '55%',
                          height: 5,
                          bgcolor: name === 'classic' ? '#f5f5f5' : '#14213b',
                          mb: 1,
                        }}
                      />
                      <Box sx={{ display: 'flex', gap: 0.75 }}>
                        {[0, 1, 2].map((i) => (
                          <Box
                            key={i}
                            sx={{
                              height: 40,
                              flex: 1,
                              borderRadius: 0.5,
                              bgcolor:
                                name === 'classic' ? '#2a2a2a' : i === 0 ? '#294fe5' : '#d6dfed',
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  </Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight={700}>{t(`appearance.${name}`)}</Typography>
                    {draft.theme === name && <CheckIcon fontSize="small" color="primary" />}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                    {t(`appearance.${name}Description`)}
                  </Typography>
                </Button>
              ))}
            </Box>
            <FormControl
              size="small"
              sx={{ mt: 3, width: { xs: '100%', sm: 240 } }}
              disabled={draft.theme === 'classic' || saving || loadError}
            >
              <InputLabel id="appearance-mode-label">{t('appearance.mode')}</InputLabel>
              <Select
                labelId="appearance-mode-label"
                label={t('appearance.mode')}
                value={draft.mode}
                onChange={(e) => {
                  setDraft({ ...draft, mode: e.target.value as ColorMode })
                  setSaved(false)
                }}
              >
                {(['light', 'dark', 'system'] as const).map((mode) => (
                  <MenuItem key={mode} value={mode}>
                    {t(`appearance.${mode}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              {t(
                draft.theme === 'classic' ? 'appearance.classicModeHint' : 'appearance.systemHint'
              )}
            </Typography>
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              disabled={!changed || saving || loadError}
              onClick={() => void save()}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {t(saving ? 'common.saving' : 'appearance.save')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
