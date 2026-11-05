import { FormControl, FormHelperText, InputLabel, MenuItem, Select } from '@mui/material'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReasoningPreset } from '@aperture/core'

export function ReasoningPresetField({
  presets, preset, onChange, disabled, styleOnly,
}: {
  presets: ReasoningPreset[]
  preset: ReasoningPreset
  onChange: (value: ReasoningPreset) => void
  disabled: boolean
  styleOnly: boolean
}) {
  const { t } = useTranslation()
  const id = useId()
  if (presets.length < 2) return null
  return (
    <FormControl fullWidth size="small" disabled={disabled} sx={{ mb: 2 }}>
      <InputLabel id={id}>{t('reasoningPresets.defaultLabel')}</InputLabel>
      <Select<ReasoningPreset>
        labelId={id}
        label={t('reasoningPresets.defaultLabel')}
        aria-describedby={`${id}-help`}
        value={preset}
        onChange={(event) => onChange(event.target.value as ReasoningPreset)}
      >
        {presets.map((option) => (
          <MenuItem key={option} value={option}>{t(`reasoningPresets.${option}.label`)}</MenuItem>
        ))}
      </Select>
      <FormHelperText id={`${id}-help`}>{t(`reasoningPresets.${preset}.description`)} {styleOnly && t('reasoningPresets.styleOnly')}</FormHelperText>
    </FormControl>
  )
}
