import React from 'react'
import { Box, List, ListItem, ListItemText, Stack, Typography } from '@mui/material'
import ErrorIcon from '@mui/icons-material/Error'
import WarningIcon from '@mui/icons-material/Warning'
import InfoIcon from '@mui/icons-material/Info'
import type { LogEntry } from '../types'

interface JobLogsProps {
  logs: LogEntry[]
  containerRef: (el: HTMLDivElement | null) => void
}

function getLogIcon(level: string) {
  switch (level) {
    case 'error':
      return <ErrorIcon fontSize="small" sx={{ color: 'error.main' }} />
    case 'warn':
      return <WarningIcon fontSize="small" sx={{ color: 'warning.main' }} />
    default:
      return <InfoIcon fontSize="small" sx={{ color: 'info.main' }} />
  }
}

export function JobLogs({ logs, containerRef }: JobLogsProps) {
  return (
    <Box
      ref={containerRef}
      sx={{
        mt: 1.5,
        maxHeight: 240,
        overflow: 'auto',
        bgcolor: 'background.default',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <List dense disablePadding>
        {logs.slice(-100).map((log, i) => (
          <ListItem
            key={i}
            sx={{
              py: 0.5,
              px: 1.5,
              bgcolor:
                log.level === 'error'
                  ? 'rgba(239, 68, 68, 0.1)'
                  : log.level === 'warn'
                  ? 'rgba(245, 158, 11, 0.1)'
                  : 'transparent',
            }}
          >
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} alignItems="center">
                  {getLogIcon(log.level)}
                  <Typography
                    variant="caption"
                    fontFamily="monospace"
                    color="text.disabled"
                    sx={{ minWidth: 70 }}
                  >
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </Typography>
                  <Typography
                    variant="body2"
                    fontFamily="monospace"
                    fontSize="0.75rem"
                    sx={{ wordBreak: 'break-word' }}
                  >
                    {log.message}
                  </Typography>
                </Stack>
              }
            />
          </ListItem>
        ))}
      </List>
    </Box>
  )
}


