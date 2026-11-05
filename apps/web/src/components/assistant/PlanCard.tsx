import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import { useTranslation } from 'react-i18next'
import type { EncorePlan } from '@aperture/core/encore'
export function PlanCard({
  plan,
  busy,
  command,
}: {
  plan: EncorePlan
  busy: boolean
  command: (name: string, input: unknown) => Promise<unknown>
}) {
  const { t } = useTranslation(),
    [edit, setEdit] = useState(false),
    [input, setInput] = useState(plan.input)
  const format = (date: string) =>
    new Date(date).toLocaleString(undefined, {
      timeZone: plan.schedule.timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  async function update(operation: 'save' | 'refresh', replacement?: EncorePlan['input']) {
    try {
      await command('updateWatchPlan', {
        id: plan.id,
        revision: plan.revision,
        operation,
        input: replacement,
      })
      setEdit(false)
    } catch {
      /* Parent displays failure. */
    }
  }
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, my: 1 }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <EventAvailableOutlinedIcon color="primary" />
        <Typography variant="h6" sx={{ flex: 1 }}>
          {plan.name}
        </Typography>
        <Chip size="small" label={t(`encore.planStatus.${plan.status}`)} />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {plan.schedule.timezone} ·{' '}
        {t('encore.checkedAt', { date: new Date(plan.schedule.checkedAt).toLocaleString() })}
      </Typography>
      <Stack spacing={1.5} sx={{ my: 2 }}>
        {plan.schedule.slots.map((slot) => (
          <Box
            key={slot.id}
            sx={{
              borderInlineStart: '3px solid',
              borderColor: 'primary.main',
              paddingInlineStart: 2,
            }}
          >
            <Typography fontWeight={600}>{slot.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {format(slot.start)} –{' '}
              {new Date(slot.end).toLocaleTimeString(undefined, {
                timeZone: plan.schedule.timezone,
                timeStyle: 'short',
              })}{' '}
              · {t('encore.minutes', { count: slot.minutes ?? 0 })}
            </Typography>
          </Box>
        ))}
      </Stack>
      {plan.schedule.unplaced.map((item) => (
        <Typography key={item.id} variant="body2" color="text.secondary" sx={{ my: 1 }}>
          {item.title} · {t(`encore.unplaced.${item.reason}`, { defaultValue: item.reason })}
        </Typography>
      ))}
      <Stack direction="row" flexWrap="wrap" gap={1}>
        <Button disabled={busy} onClick={() => void update('save')}>
          {t('encore.savePlan')}
        </Button>
        <Button disabled={busy} onClick={() => void update('refresh')}>
          {t('encore.recheck')}
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            setInput(plan.input)
            setEdit(true)
          }}
        >
          {t('encore.editWindows')}
        </Button>
        {plan.status === 'saved' && (
          <Button component="a" href={`/api/assistant/plans/${plan.id}/calendar.ics`}>
            {t('encore.exportCalendar')}
          </Button>
        )}
        <Button
          color="error"
          disabled={busy}
          onClick={() => void command('deleteWatchPlan', { id: plan.id }).catch(() => {})}
        >
          {t('common.delete')}
        </Button>
      </Stack>
      <Dialog open={edit} onClose={() => setEdit(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('encore.editWindows')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={t('encore.planName')}
              value={input.name}
              onChange={(e) => setInput({ ...input, name: e.target.value })}
            />
            <TextField
              label={t('encore.timezone')}
              value={input.timezone}
              onChange={(e) => setInput({ ...input, timezone: e.target.value })}
            />
            {input.windows.map((window, index) => (
              <Stack key={index} direction={{ xs: 'column', sm: 'row' }} gap={1}>
                <TextField
                  fullWidth
                  type="datetime-local"
                  label={t('encore.windowStart')}
                  InputLabelProps={{ shrink: true }}
                  value={window.start}
                  onChange={(e) =>
                    setInput({
                      ...input,
                      windows: input.windows.map((w, i) =>
                        i === index ? { ...w, start: e.target.value } : w
                      ),
                    })
                  }
                />
                <TextField
                  type="number"
                  label={t('encore.windowMinutes')}
                  value={window.minutes}
                  inputProps={{ min: 10, max: 720 }}
                  onChange={(e) =>
                    setInput({
                      ...input,
                      windows: input.windows.map((w, i) =>
                        i === index ? { ...w, minutes: Number(e.target.value) } : w
                      ),
                    })
                  }
                />
                <Button
                  disabled={input.windows.length === 1}
                  onClick={() =>
                    setInput({ ...input, windows: input.windows.filter((_w, i) => i !== index) })
                  }
                >
                  {t('common.remove')}
                </Button>
              </Stack>
            ))}
            <Button
              disabled={input.windows.length >= 28}
              onClick={() =>
                setInput({
                  ...input,
                  windows: [...input.windows, { start: input.windows.at(-1)!.start, minutes: 90 }],
                })
              }
            >
              {t('encore.addWindow')}
            </Button>
            <TextField
              type="number"
              label={t('encore.breakMinutes')}
              value={input.breakMinutes}
              inputProps={{ min: 0, max: 60 }}
              onChange={(e) => setInput({ ...input, breakMinutes: Number(e.target.value) })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEdit(false)}>{t('common.cancel')}</Button>
          <Button disabled={busy} onClick={() => void update('refresh', input)}>
            {t('encore.recheck')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
