import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined'
import { useTranslation } from 'react-i18next'
import { useWorkbench } from './hooks/useWorkbench'
import type { EncoreMemory } from '@aperture/core/encore'
export function MemoryPanel() {
  const { t } = useTranslation(),
    state = useWorkbench()
  const [editing, setEditing] = useState<Partial<EncoreMemory> | null>(null),
    [fact, setFact] = useState(''),
    [key, setKey] = useState(''),
    [kind, setKind] = useState('preference'),
    [days, setDays] = useState('')
  function edit(memory: Partial<EncoreMemory>) {
    setEditing(memory)
    setFact(memory.fact ?? '')
    setKey(memory.fact_key ?? '')
    setKind(memory.kind ?? 'preference')
    setDays(
      memory.expires_at
        ? String(
            Math.max(1, Math.ceil((new Date(memory.expires_at).getTime() - Date.now()) / 86400000))
          )
        : ''
    )
  }
  async function save() {
    try {
      await state.command('rememberPreference', {
        key,
        fact,
        kind,
        days: days ? Number(days) : undefined,
      })
      setEditing(null)
    } catch {
      /* Visible error supplied by state. */
    }
  }
  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 4 } }}>
      <Stack spacing={2} sx={{ maxWidth: 760, mx: 'auto' }}>
        <Box>
          <PsychologyOutlinedIcon color="primary" />
          <Typography variant="h5">{t('encore.memoryTitle')}</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {t('encore.memoryIntro')}
          </Typography>
        </Box>
        {state.error && <Alert severity="error">{state.error}</Alert>}
        <Box>
          <Button variant="outlined" onClick={() => edit({})}>
            {t('encore.addMemory')}
          </Button>
        </Box>
        {state.loading ? (
          <CircularProgress size={24} />
        ) : !state.data.memories.length ? (
          <Alert severity="info">{t('encore.memoryEmpty')}</Alert>
        ) : (
          state.data.memories.map((memory) => (
            <Paper key={memory.id} variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
              <Stack direction="row" gap={1}>
                <Chip size="small" label={t(`encore.memoryKinds.${memory.kind}`)} />
                <Typography variant="caption" color="text.secondary">
                  {t(`encore.memorySources.${memory.source}`, { defaultValue: memory.source })}
                  {memory.source_label && ` · ${memory.source_label}`}
                </Typography>
              </Stack>
              <Typography sx={{ my: 1.5 }}>{memory.fact}</Typography>
              <Typography variant="caption" color="text.secondary">
                {memory.expires_at
                  ? t('encore.expiresOn', {
                      date: new Date(memory.expires_at).toLocaleDateString(),
                    })
                  : t('encore.untilForgotten')}
              </Typography>
              <Stack direction="row" gap={1} sx={{ mt: 1 }}>
                <Button disabled={state.busy} onClick={() => edit(memory)}>
                  {t('common.edit')}
                </Button>
                <Button
                  color="error"
                  disabled={state.busy}
                  onClick={() =>
                    void state.command('forgetMemory', { id: memory.id }).catch(() => {})
                  }
                >
                  {t('encore.forgetMemory')}
                </Button>
              </Stack>
            </Paper>
          ))
        )}
        <Alert severity="info">{t('encore.memoryCanonical')}</Alert>
        <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
          <DialogTitle>{t('encore.editMemory')}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label={t('encore.memoryKey')}
                value={key}
                disabled={Boolean(editing?.id)}
                onChange={(e) => setKey(e.target.value)}
                inputProps={{ maxLength: 80 }}
                helperText={t('encore.memoryKeyHelp')}
              />
              <TextField
                label={t('encore.memoryFact')}
                value={fact}
                onChange={(e) => setFact(e.target.value)}
                multiline
                minRows={3}
                inputProps={{ maxLength: 1200 }}
              />
              <TextField
                select
                label={t('encore.memoryKind')}
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {['preference', 'constraint', 'context', 'spoiler'].map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(`encore.memoryKinds.${value}`)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t('encore.memoryDays')}
                type="number"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                inputProps={{ min: 1, max: 365 }}
                helperText={t('encore.memoryDaysHelp')}
              />
              {state.error && <Alert severity="error">{state.error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
            <Button
              disabled={
                state.busy ||
                !key.trim() ||
                !fact.trim() ||
                (Boolean(days) && (Number(days) < 1 || Number(days) > 365))
              }
              onClick={() => void save()}
            >
              {t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Box>
  )
}
