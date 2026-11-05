import { Button, CircularProgress, IconButton, Tooltip } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useTranslation } from 'react-i18next'

interface DiscoveryRefreshProps {
  compact: boolean
  refreshing: boolean
  running: boolean
  onRefresh: () => void
}

export function DiscoveryRefresh({
  compact,
  refreshing,
  running,
  onRefresh,
}: DiscoveryRefreshProps) {
  const { t } = useTranslation()
  const busy = refreshing || running
  const label = running
    ? t(compact ? 'discovery.jobRunning' : 'discovery.jobRunningLabel')
    : refreshing
      ? t('discovery.refreshing')
      : t('discovery.refresh')
  const icon = busy ? (
    <CircularProgress size={18} />
  ) : (
    <RefreshIcon fontSize={compact ? 'small' : 'medium'} />
  )

  if (compact) {
    return (
      <Tooltip title={label}>
        <span>
          <IconButton
            aria-label={label}
            disabled={busy}
            onClick={onRefresh}
            sx={{ border: 1, borderColor: 'divider' }}
          >
            {icon}
          </IconButton>
        </span>
      </Tooltip>
    )
  }

  return (
    <Button variant="outlined" startIcon={icon} onClick={onRefresh} disabled={busy} size="small">
      {label}
    </Button>
  )
}
