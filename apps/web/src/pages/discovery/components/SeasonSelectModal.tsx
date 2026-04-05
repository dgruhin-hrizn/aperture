import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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

/** Seerr status → row disabled for selection (must match `statusConfigByCode`). */
const STATUS_DISABLED: Record<number, boolean> = {
  1: false,
  2: true,
  3: true,
  4: false,
  5: true,
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
  const { t } = useTranslation()

  const statusConfigByCode = useMemo(
    () =>
      ({
        1: { label: t('seasonRequest.statusNotRequested'), color: 'default' as const, disabled: false },
        2: { label: t('seasonRequest.statusPending'), color: 'warning' as const, disabled: true },
        3: { label: t('seasonRequest.statusProcessing'), color: 'info' as const, disabled: true },
        4: { label: t('seasonRequest.statusPartial'), color: 'info' as const, disabled: false },
        5: { label: t('seasonRequest.statusAvailable'), color: 'success' as const, disabled: true },
      }) satisfies Record<
        number,
        { label: string; color: 'default' | 'warning' | 'info' | 'success'; disabled: boolean }
      >,
    [t]
  )

  // Track selected seasons (exclude specials by default, include all regular seasons)
  const [selectedSeasons, setSelectedSeasons] = useState<Set<number>>(() => {
    const initial = new Set<number>()
    for (const season of seasons) {
      // Select by default if: not specials (season 0), and not already available/pending
      const status = season.status ?? 1
      const isDisabled = STATUS_DISABLED[status] ?? false
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
      const isDisabled = STATUS_DISABLED[status] ?? false
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
      return !(STATUS_DISABLED[status] ?? false)
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
    const key = status ?? 1
    const cfg = statusConfigByCode[key as keyof typeof statusConfigByCode]
    return cfg ?? statusConfigByCode[1]
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
          {t('seasonRequest.dialogTitle')}
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
              {t('seasonRequest.loadingSeasons')}
            </Typography>
          </Box>
        ) : noSelectableSeasons ? (
          <Alert severity="info" icon={<InfoOutlinedIcon />}>
            {t('seasonRequest.allUnavailable')}
          </Alert>
        ) : (
          <>
            <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2 }}>
              {t('seasonRequest.selectHint')}
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
                    <TableCell>{t('seasonRequest.colSeason')}</TableCell>
                    <TableCell align="center">{t('seasonRequest.colEpisodes')}</TableCell>
                    <TableCell align="right">{t('seasonRequest.colStatus')}</TableCell>
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
                            {season.name ||
                              (season.seasonNumber === 0
                                ? t('seasonRequest.specials')
                                : t('seasonRequest.seasonFormat', { n: season.seasonNumber }))}
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
                  {t('seasonRequest.seasonsSelected', { count: selectedSeasons.size })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('seasonRequest.episodesTotal', { count: totalEpisodes })}
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
          {t('common.cancel')}
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
          {submitting
            ? t('seasonRequest.requesting')
            : selectedSeasons.size > 0
              ? t('seasonRequest.requestWithCount', { count: selectedSeasons.size })
              : t('seasonRequest.request')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
