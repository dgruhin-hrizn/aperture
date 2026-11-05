import { useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import type {
  EncoreCuration,
  EncoreCollection,
  CurationRecipe,
  CurationSchedule,
} from '@aperture/core/encore'
export function CurationEditor({
  curation,
  collections,
  busy,
  error,
  onClose,
  onSave,
}: {
  curation?: EncoreCuration
  collections: EncoreCollection[]
  busy: boolean
  error: string
  onClose: () => void
  onSave: (input: {
    name: string
    collectionId: string
    recipe: CurationRecipe
    schedule: CurationSchedule
  }) => Promise<void>
}) {
  const { t } = useTranslation(),
    [name, setName] = useState(curation?.name ?? ''),
    [collectionId, setCollectionId] = useState(curation?.collection_id ?? collections[0]?.id ?? '')
  const [recipe, setRecipe] = useState<CurationRecipe>(
    curation?.recipe ?? { mediaType: 'movies', excludeWatched: true, limit: 10 }
  )
  const [schedule, setSchedule] = useState<CurationSchedule>(
    curation?.schedule ?? {
      cadence: 'weekly',
      day: 5,
      time: '17:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
  )
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t(curation ? 'encore.editCuration' : 'encore.createCuration')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label={t('encore.curationName')}
            value={name}
            inputProps={{ maxLength: 100 }}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            select
            label={t('encore.curationCollection')}
            value={collectionId}
            disabled={Boolean(curation)}
            onChange={(e) => setCollectionId(e.target.value)}
          >
            {collections.map((collection) => (
              <MenuItem key={collection.id} value={collection.id}>
                {collection.name}
              </MenuItem>
            ))}
          </TextField>
          {recipe.mediaType === 'movies' ? (
            <>
              <TextField
                label={t('encore.curationConcept')}
                value={recipe.concept ?? ''}
                multiline
                minRows={2}
                inputProps={{ maxLength: 500 }}
                helperText={t('encore.curationConceptHelp')}
                onChange={(e) => setRecipe({ ...recipe, concept: e.target.value || undefined })}
              />
              <TextField
                label={t('encore.curationGenre')}
                value={recipe.genre ?? ''}
                onChange={(e) => setRecipe({ ...recipe, genre: e.target.value || undefined })}
              />
            </>
          ) : (
            <Typography>{recipe.seriesName ?? t('encore.curationEpisodes')}</Typography>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              type="number"
              label={t('encore.curationMaxRuntime')}
              value={recipe.maxRuntime ?? ''}
              inputProps={{ min: 10, max: 480 }}
              onChange={(e) =>
                setRecipe({
                  ...recipe,
                  maxRuntime: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
            <TextField
              type="number"
              label={t('encore.curationMinRating')}
              value={recipe.minRating ?? ''}
              inputProps={{ min: 0, max: 10, step: 0.1 }}
              onChange={(e) =>
                setRecipe({
                  ...recipe,
                  minRating: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
            <TextField
              type="number"
              label={t('encore.curationItemLimit')}
              value={recipe.limit}
              inputProps={{ min: 1, max: 30 }}
              onChange={(e) => setRecipe({ ...recipe, limit: Number(e.target.value) })}
            />
          </Stack>
          <FormControlLabel
            control={
              <Checkbox
                checked={recipe.excludeWatched}
                onChange={(_e, checked) => setRecipe({ ...recipe, excludeWatched: checked })}
              />
            }
            label={t('encore.curationUnwatched')}
          />
          <TextField
            select
            label={t('encore.curationCadence')}
            value={schedule.cadence}
            onChange={(e) =>
              setSchedule({ ...schedule, cadence: e.target.value as CurationSchedule['cadence'] })
            }
          >
            {['daily', 'weekly'].map((value) => (
              <MenuItem key={value} value={value}>
                {t(`encore.cadences.${value}`)}
              </MenuItem>
            ))}
          </TextField>
          {schedule.cadence === 'weekly' && (
            <TextField
              select
              label={t('encore.curationDay')}
              value={schedule.day}
              onChange={(e) => setSchedule({ ...schedule, day: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <MenuItem key={day} value={day}>
                  {new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: 'UTC' }).format(
                    new Date(Date.UTC(2024, 0, day))
                  )}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            type="time"
            label={t('encore.curationTime')}
            InputLabelProps={{ shrink: true }}
            value={schedule.time}
            onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
          />
          <TextField
            label={t('encore.timezone')}
            value={schedule.timezone}
            onChange={(e) => setSchedule({ ...schedule, timezone: e.target.value })}
          />
          <Alert severity="info">{t('encore.curationDraftHelp')}</Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          disabled={busy || !name.trim() || !collectionId}
          onClick={() => void onSave({ name, collectionId, recipe, schedule }).catch(() => {})}
        >
          {t('encore.savePausedRule')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
