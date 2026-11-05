import { Box, Drawer, IconButton, Paper, Typography, useMediaQuery, useTheme } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export function GraphControlsPanel({
  children,
  open,
  onClose,
}: {
  children: ReactNode
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'))

  if (phone) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        slotProps={{ paper: { role: 'dialog', 'aria-labelledby': 'graph-filters-title' } }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" px={1.5} gap={1}>
          <Typography id="graph-filters-title" variant="subtitle1">
            {t('discovery.filters.button')}
          </Typography>
          <IconButton aria-label={t('common.close')} onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ minHeight: 0, overflowY: 'auto', pb: 'env(safe-area-inset-bottom, 0px)' }}>
          {children}
        </Box>
      </Drawer>
    )
  }

  return (
    <Paper
      square
      sx={{ width: 280, flexShrink: 0, borderInlineStart: 1, borderColor: 'divider', overflowY: 'auto' }}
    >
      {children}
    </Paper>
  )
}
