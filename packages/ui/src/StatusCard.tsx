import React from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Chip,
} from '@mui/material'
import CheckCircle from '@mui/icons-material/CheckCircle'
import Error from '@mui/icons-material/Error'

const CheckCircleIcon = CheckCircle as unknown as React.ComponentType<{ color?: string }>
const ErrorIcon = Error as unknown as React.ComponentType<{ color?: string }>

export interface StatusCardProps {
  title: string
  status: 'loading' | 'ok' | 'error'
  message?: string
  time?: string
  details?: Record<string, unknown>
}

export function StatusCard({ title, status, message, time, details }: StatusCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'ok':
        return 'success'
      case 'error':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'ok':
        return <CheckCircleIcon color="success" />
      case 'error':
        return <ErrorIcon color="error" />
      default:
        return <CircularProgress size={20} />
    }
  }

  return (
    <Card
      sx={{
        backgroundColor: 'background.paper',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6" component="h3">
            {title}
          </Typography>
          <Chip
            icon={getStatusIcon()}
            label={status === 'loading' ? 'Checking...' : status.toUpperCase()}
            color={getStatusColor() as 'success' | 'error' | 'default'}
            size="small"
            variant="outlined"
          />
        </Box>

        {message && (
          <Typography variant="body2" color="text.secondary" mb={1}>
            {message}
          </Typography>
        )}

        {time && (
          <Typography variant="caption" color="text.secondary" display="block">
            Last checked: {new Date(time).toLocaleString()}
          </Typography>
        )}

        {details && Object.keys(details).length > 0 && (
          <Box mt={2} pt={2} borderTop={1} borderColor="divider">
            {Object.entries(details).map(([key, value]) => (
              <Box key={key} display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">
                  {key}:
                </Typography>
                <Typography variant="caption">
                  {String(value)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

