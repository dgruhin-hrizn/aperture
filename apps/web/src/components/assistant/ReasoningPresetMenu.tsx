import { useState } from 'react'
import { Button, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { ReasoningPreset } from '@aperture/core'

export interface ReasoningPresetControl {
  presets: ReasoningPreset[]
  selected?: ReasoningPreset
  defaultPreset: ReasoningPreset
  running: boolean
  onSelect: (preset?: ReasoningPreset) => void
}

export function ReasoningPresetMenu({ presets, selected, defaultPreset, running, onSelect }: ReasoningPresetControl) {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  if (presets.length < 2) return null
  const name = t(`reasoningPresets.${selected ?? defaultPreset}.label`)
  const label = t('reasoningPresets.forNextReply', { preset: name })
  return (
    <>
      <Tooltip title={label}>
        <span>
          <Button
            size="small"
            variant={selected ? 'outlined' : 'text'}
            aria-label={label}
            aria-haspopup="menu"
            aria-expanded={Boolean(anchor)}
            color={selected ? 'primary' : 'inherit'}
            disabled={running}
            onClick={(event) => setAnchor(event.currentTarget)}
            sx={{ minHeight: 44, px: 0.75, whiteSpace: 'nowrap' }}
          >
            {name}
          </Button>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ list: { 'aria-label': t('reasoningPresets.replyLabel') }, paper: { sx: { maxWidth: 'min(360px, calc(100vw - 24px))' } } }}
      >
        <MenuItem selected={selected === undefined} onClick={() => { onSelect(); setAnchor(null) }}>
          {t('reasoningPresets.useDefault', { preset: t(`reasoningPresets.${defaultPreset}.label`) })}
        </MenuItem>
        {presets.map((preset) => (
          <MenuItem key={preset} sx={{ whiteSpace: 'normal' }} selected={selected === preset} onClick={() => { onSelect(preset); setAnchor(null) }}>
            <ListItemText primary={t(`reasoningPresets.${preset}.label`)} secondary={t(`reasoningPresets.${preset}.description`)} />
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
