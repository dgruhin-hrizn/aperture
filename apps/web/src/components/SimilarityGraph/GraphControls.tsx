import { Box, Typography, FormControlLabel, Checkbox, Switch, Divider } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { CONNECTION_COLORS, type ConnectionType } from './types'
import { connectionTypeLabel } from '../../i18n/connectionTypeLabel'

interface GraphControlsProps {
  enabledTypes: Set<ConnectionType>
  onToggleType: (type: ConnectionType) => void
  crossMediaEnabled: boolean
  onToggleCrossMedia: (enabled: boolean) => void
  compact?: boolean
}

export function GraphControls({
  enabledTypes,
  onToggleType,
  crossMediaEnabled,
  onToggleCrossMedia,
  compact = false,
}: GraphControlsProps) {
  const { t } = useTranslation()
  const connectionTypes: ConnectionType[] = [
    'director',
    'actor',
    'collection',
    'genre',
    'keyword',
    'studio',
    'network',
  ]

  return (
    <Box
      sx={{
        p: compact ? 1.5 : 2,
        bgcolor: 'background.paper',
        borderRadius: 2,
        minWidth: compact ? 160 : 200,
      }}
    >
      {/* Legend */}
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
        {t('graphControls.connectionTypes')}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {connectionTypes.map((type) => (
          <Box
            key={type}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              opacity: enabledTypes.has(type) ? 1 : 0.4,
              transition: 'opacity 0.2s',
              '&:hover': { opacity: 1 },
            }}
            onClick={() => onToggleType(type)}
          >
            <Box
              sx={{
                width: 16,
                height: 3,
                bgcolor: CONNECTION_COLORS[type],
                borderRadius: 1,
              }}
            />
            <Typography variant="caption" sx={{ fontSize: compact ? '10px' : '11px' }}>
              {connectionTypeLabel(type, t)}
            </Typography>
          </Box>
        ))}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Cross-media toggle */}
      <Box>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          {t('graphControls.crossMedia')}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={crossMediaEnabled}
              onChange={(e) => onToggleCrossMedia(e.target.checked)}
            />
          }
          label={
            <Typography variant="caption" sx={{ fontSize: compact ? '10px' : '11px' }}>
              {t('graphControls.moviesSeriesToggle')}
            </Typography>
          }
        />
      </Box>
    </Box>
  )
}

// Standalone legend component for simpler use cases
export function GraphLegend({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const connectionTypes: ConnectionType[] = [
    'director',
    'actor',
    'collection',
    'genre',
    'keyword',
    'studio',
    'network',
    'similarity',
  ]

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: compact ? 1 : 1.5,
        p: 1,
      }}
    >
      {connectionTypes.map((type) => (
        <Box
          key={type}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <Box
            sx={{
              width: 12,
              height: 3,
              bgcolor: CONNECTION_COLORS[type],
              borderRadius: 1,
            }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: compact ? '9px' : '10px' }}
          >
            {connectionTypeLabel(type, t)}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

