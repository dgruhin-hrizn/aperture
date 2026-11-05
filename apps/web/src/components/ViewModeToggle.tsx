import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import { useTranslation } from 'react-i18next'
import type { ViewMode } from '@/hooks/view-mode-context'

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}) {
  const { t } = useTranslation()

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={(_, next) => next && onChange(next)}
      size="small"
    >
      <ToggleButton value="grid" aria-label={t('browse.gridView')}>
        <GridViewIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton value="list" aria-label={t('browse.listView')}>
        <ViewListIcon fontSize="small" />
      </ToggleButton>
    </ToggleButtonGroup>
  )
}
