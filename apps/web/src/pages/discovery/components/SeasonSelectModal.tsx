import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  alpha,
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

export interface SeasonInfo {
  id: number
  seasonNumber: number
  episodeCount: number
  airDate?: string
  name: string
  overview?: string
  posterPath?: string
  // Status: 1=unknown, 2=pending, 3=processing, 4=partial, 5=available
  status?: number
}

interface SeasonSelectModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (seasons: number[]) => Promise<void>
  title: string
  posterPath?: string | null
  seasons: SeasonInfo[]
  loading?: boolean
}

// Map Jellyseerr status codes to labels and colors
const STATUS_CONFIG: Record<number, { label: string; color: 'default' | 'warning' | 'info' | 'success'; disabled: boolean }> = {
  1: { label: 'Not Requested', color: 'default', disabled: false },
  2: { label: 'Pending', color: 'warning', disabled: true },
  3: { label: 'Processing', color: 'info', disabled: true },
  4: { label: 'Partial', color: 'info', disabled: false },
  5: { label: 'Available', color: 'success', disabled: true },
}

export function SeasonSelectModal({
  open,
  onClose,
  onSubmit,
  title,
  posterPath,
  seasons,
  loading = false,
}: SeasonSelectModalProps) {
  // Track selected seasons (exclude specials by default, include all regular seasons)
  const [selectedSeasons, setSelectedSeasons] = useState<Set<number>>(() => {
    const initial = new Set<number>()
    for (const season of seasons) {
      // Select by default if: not specials (season 0), and not already available/pending
      const status = season.status ?? 1
      const isDisabled = STATUS_CONFIG[status]?.disabled ?? false
      if (season.seasonNumber > 0 && !isDisabled) {
        initial.add(season.seasonNumber)
      }
    }
    return initial
  })
  const [submitting, setSubmitting] = useState(false)

  // Reset selection when seasons change
  React.useEffect(() => {
    const initial = new Set<number>()
    for (const season of seasons) {
      const status = season.status ?? 1
      const isDisabled = STATUS_CONFIG[status]?.disabled ?? false
      if (season.seasonNumber > 0 && !isDisabled) {
        initial.add(season.seasonNumber)
      }
    }
    setSelectedSeasons(initial)
  }, [seasons])

  // Get selectable seasons (not disabled)
  const selectableSeasons = useMemo(() => {
    return seasons.filter(s => {
      const status = s.status ?? 1
      return !STATUS_CONFIG[status]?.disabled
    })
  }, [seasons])

  // Check if all selectable seasons are selected
  const allSelected = selectableSeasons.length > 0 && 
    selectableSeasons.every(s => selectedSeasons.has(s.seasonNumber))

  // Check if no selectable seasons exist
  const noSelectableSeasons = selectableSeasons.length === 0

  // Calculate totals
  const totalEpisodes = useMemo(() => {
    return seasons
      .filter(s => selectedSeasons.has(s.seasonNumber))
      .reduce((sum, s) => sum + s.episodeCount, 0)
  }, [seasons, selectedSeasons])

  const handleToggle = (seasonNumber: number) => {
    setSelectedSeasons(prev => {
      const next = new Set(prev)
      if (next.has(seasonNumber)) {
        next.delete(seasonNumber)
      } else {
        next.add(seasonNumber)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedSeasons(new Set())
    } else {
      setSelectedSeasons(new Set(selectableSeasons.map(s => s.seasonNumber)))
    }
  }

  const handleSubmit = async () => {
    if (selectedSeasons.size === 0) return
    setSubmitting(true)
    try {
      await onSubmit(Array.from(selectedSeasons).sort((a, b) => a - b))
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusConfig = (status?: number) => {
    return STATUS_CONFIG[status ?? 1] ?? STATUS_CONFIG[1]
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      onClick={(e) => e.stopPropagation()}
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          backgroundImage: 'none',
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="overline" color="primary" display="block" sx={{ mb: -0.5 }}>
          Request Series
        </Typography>
        <Typography variant="h6" fontWeight={600}>
          {title}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
              Loading seasons...
            </Typography>
          </Box>
        ) : noSelectableSeasons ? (
          <Alert severity="info" icon={<InfoOutlinedIcon />}>
            All seasons are already available or have been requested.
          </Alert>
        ) : (
          <>
            <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2 }}>
              Select the seasons you want to request.
            </Alert>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={allSelected}
                        indeterminate={selectedSeasons.size > 0 && !allSelected}
                        onChange={handleSelectAll}
                        disabled={selectableSeasons.length === 0}
                      />
                    </TableCell>
                    <TableCell>Season</TableCell>
                    <TableCell align="center"># of Episodes</TableCell>
                    <TableCell align="right">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {seasons.map((season) => {
                    const statusConfig = getStatusConfig(season.status)
                    const isDisabled = statusConfig.disabled
                    const isSelected = selectedSeasons.has(season.seasonNumber)

                    return (
                      <TableRow 
                        key={season.id}
                        hover={!isDisabled}
                        onClick={() => !isDisabled && handleToggle(season.seasonNumber)}
                        sx={{ 
                          cursor: isDisabled ? 'default' : 'pointer',
                          opacity: isDisabled ? 0.6 : 1,
                          bgcolor: isSelected && !isDisabled 
                            ? (theme) => alpha(theme.palette.primary.main, 0.08)
                            : 'transparent',
                        }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isSelected}
                            disabled={isDisabled}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => handleToggle(season.seasonNumber)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {season.name || (season.seasonNumber === 0 ? 'Specials' : `Season ${season.seasonNumber}`)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" color="text.secondary">
                            {season.episodeCount}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={statusConfig.label}
                            color={statusConfig.color}
                            size="small"
                            variant={isDisabled ? 'filled' : 'outlined'}
                            sx={{ minWidth: 100 }}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {selectedSeasons.size > 0 && (
              <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {selectedSeasons.size} season{selectedSeasons.size !== 1 ? 's' : ''} selected
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {totalEpisodes} episode{totalEpisodes !== 1 ? 's' : ''} total
                </Typography>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button 
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }} 
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={(e) => {
            e.stopPropagation()
            handleSubmit()
          }}
          disabled={selectedSeasons.size === 0 || submitting || loading || noSelectableSeasons}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {submitting ? 'Requesting...' : `Request ${selectedSeasons.size > 0 ? `(${selectedSeasons.size})` : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
