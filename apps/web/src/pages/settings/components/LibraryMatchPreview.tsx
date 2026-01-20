import React from 'react'
import {
  Box,
  Typography,
  CircularProgress,
  LinearProgress,
  Chip,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  alpha,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

interface LibraryMatchResult {
  total: number
  matched: number
  missing: Array<{ title: string; year: number | null }>
}

interface LibraryMatchPreviewProps {
  loading: boolean
  data: LibraryMatchResult | null
  expanded: boolean
  onExpandToggle: () => void
  onOpenPreview: () => void
}

export function LibraryMatchPreview({
  loading,
  data,
  expanded,
  onExpandToggle,
  onOpenPreview,
}: LibraryMatchPreviewProps) {
  if (loading) {
    return (
      <Box 
        sx={{ 
          p: 2, 
          bgcolor: alpha('#8B5CF6', 0.08),
          borderRadius: 2,
          border: '1px solid',
          borderColor: alpha('#8B5CF6', 0.2),
        }}
      >
        <Box display="flex" alignItems="center" gap={1.5}>
          <CircularProgress size={18} sx={{ color: '#8B5CF6' }} />
          <Typography variant="body2" color="text.secondary">
            Analyzing library coverage...
          </Typography>
        </Box>
      </Box>
    )
  }

  if (!data) {
    return null
  }

  const matchPercentage = data.total > 0 ? Math.round((data.matched / data.total) * 100) : 0
  const missingCount = data.missing.length

  return (
    <Box 
      sx={{ 
        bgcolor: alpha('#8B5CF6', 0.06),
        borderRadius: 2,
        border: '1px solid',
        borderColor: alpha('#8B5CF6', 0.15),
        overflow: 'hidden',
      }}
    >
      {/* Header with stats */}
      <Box sx={{ p: 2 }}>
        {/* Progress bar */}
        <Box sx={{ mb: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              Library Coverage
            </Typography>
            <Typography variant="caption" fontWeight={600} color="primary.main">
              {matchPercentage}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={matchPercentage} 
            sx={{ 
              height: 6, 
              borderRadius: 3,
              bgcolor: alpha('#fff', 0.1),
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                background: matchPercentage === 100 
                  ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)'
                  : 'linear-gradient(90deg, #8B5CF6 0%, #6366f1 100%)',
              }
            }}
          />
        </Box>

        {/* Stats chips */}
        <Box display="flex" gap={1} flexWrap="wrap">
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
            label={`${data.matched} in library`}
            size="small"
            sx={{
              bgcolor: alpha('#22c55e', 0.15),
              color: '#22c55e',
              fontWeight: 600,
              '& .MuiChip-icon': { color: '#22c55e' },
              cursor: 'pointer',
              '&:hover': { bgcolor: alpha('#22c55e', 0.25) },
            }}
            onClick={onOpenPreview}
          />
          {missingCount > 0 && (
            <Chip
              icon={<CloudDownloadIcon sx={{ fontSize: 16 }} />}
              label={`${missingCount} missing`}
              size="small"
              sx={{
                bgcolor: alpha('#f59e0b', 0.15),
                color: '#f59e0b',
                fontWeight: 600,
                '& .MuiChip-icon': { color: '#f59e0b' },
                cursor: 'pointer',
                '&:hover': { bgcolor: alpha('#f59e0b', 0.25) },
              }}
              onClick={onExpandToggle}
            />
          )}
          <Chip
            label={`${data.total} total`}
            size="small"
            variant="outlined"
            sx={{
              borderColor: alpha('#fff', 0.2),
              color: 'text.secondary',
              fontWeight: 500,
            }}
          />
        </Box>
      </Box>

      {/* Expandable missing items */}
      {missingCount > 0 && (
        <>
          <Box 
            onClick={onExpandToggle}
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              px: 2,
              py: 1,
              cursor: 'pointer',
              bgcolor: alpha('#f59e0b', 0.08),
              borderTop: '1px solid',
              borderColor: alpha('#f59e0b', 0.15),
              '&:hover': { bgcolor: alpha('#f59e0b', 0.12) },
            }}
          >
            <Typography variant="caption" fontWeight={600} color="warning.main">
              {expanded ? 'Hide' : 'Show'} missing titles
            </Typography>
            <ExpandMoreIcon 
              fontSize="small" 
              sx={{ 
                color: 'warning.main',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s'
              }} 
            />
          </Box>
          <Collapse in={expanded}>
            <List 
              dense 
              sx={{ 
                maxHeight: 200, 
                overflow: 'auto', 
                py: 0,
                bgcolor: alpha('#000', 0.2),
              }}
            >
              {data.missing.map((item, idx) => (
                <ListItem 
                  key={idx} 
                  sx={{ 
                    py: 0.5,
                    borderBottom: idx < data.missing.length - 1 ? '1px solid' : 'none',
                    borderColor: alpha('#fff', 0.05),
                  }}
                >
                  <ListItemText 
                    primary={item.title}
                    secondary={item.year || 'Unknown year'}
                    primaryTypographyProps={{ 
                      variant: 'body2',
                      fontWeight: 500,
                      sx: { color: 'text.primary' }
                    }}
                    secondaryTypographyProps={{ 
                      variant: 'caption',
                      sx: { color: 'text.secondary' }
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </>
      )}

      {/* View full preview button */}
      <Box 
        onClick={onOpenPreview}
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: 0.5,
          py: 1.5,
          cursor: 'pointer',
          bgcolor: alpha('#8B5CF6', 0.1),
          borderTop: '1px solid',
          borderColor: alpha('#8B5CF6', 0.15),
          '&:hover': { bgcolor: alpha('#8B5CF6', 0.18) },
          transition: 'background-color 0.2s',
        }}
      >
        <Typography variant="caption" fontWeight={600} color="primary.main">
          View Full Preview
        </Typography>
        <OpenInNewIcon sx={{ fontSize: 14, color: 'primary.main' }} />
      </Box>
    </Box>
  )
}
