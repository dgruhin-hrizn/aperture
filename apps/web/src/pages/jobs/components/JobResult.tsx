import React from 'react'
import { Box, Stack, Typography } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import CancelIcon from '@mui/icons-material/Cancel'
import type { JobProgress } from '../types'

interface JobResultProps {
  progress: JobProgress
}

export function JobResult({ progress }: JobResultProps) {
  return (
    <Box
      sx={{
        px: 2.5,
        py: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor:
          progress.status === 'completed'
            ? 'rgba(34, 197, 94, 0.08)'
            : progress.status === 'cancelled'
            ? 'rgba(245, 158, 11, 0.08)'
            : 'rgba(239, 68, 68, 0.08)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        {progress.status === 'completed' && (
          <>
            <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
            <Typography variant="body2" color="success.main" fontWeight={500}>
              Completed successfully
            </Typography>
          </>
        )}
        {progress.status === 'cancelled' && (
          <>
            <CancelIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            <Typography variant="body2" color="warning.main" fontWeight={500}>
              Cancelled by user
            </Typography>
          </>
        )}
        {progress.status === 'failed' && (
          <>
            <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
            <Typography variant="body2" color="error.main" fontWeight={500}>
              {progress.error || 'Job failed'}
            </Typography>
          </>
        )}
      </Stack>

      {/* Result Summary */}
      {progress.status === 'completed' && progress.result && (
        <Stack direction="row" spacing={3} mt={1.5} flexWrap="wrap">
          {Object.entries(progress.result).map(([key, value]) => {
            // Skip complex objects/arrays or format them specially
            if (Array.isArray(value)) {
              // For arrays like 'users', show count and names
              const names = value
                .map((item) => (typeof item === 'object' && item?.displayName) || null)
                .filter(Boolean)
              return (
                <Box key={key}>
                  <Typography variant="caption" color="text.disabled">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {names.length > 0 ? names.join(', ') : `${value.length} item(s)`}
                  </Typography>
                </Box>
              )
            }
            if (typeof value === 'object' && value !== null) {
              // Skip other complex objects
              return null
            }
            return (
              <Box key={key}>
                <Typography variant="caption" color="text.disabled">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {typeof value === 'number' ? value.toLocaleString() : String(value)}
                </Typography>
              </Box>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}



