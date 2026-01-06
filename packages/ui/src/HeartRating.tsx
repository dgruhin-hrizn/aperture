import React, { useState, useRef } from 'react'
import { Box, Typography, Tooltip, IconButton, Popper, Paper, ClickAwayListener, Fade } from '@mui/material'
import Favorite from '@mui/icons-material/Favorite'
import FavoriteBorder from '@mui/icons-material/FavoriteBorder'

const FilledHeart = Favorite as unknown as React.ComponentType<{ 
  fontSize?: 'small' | 'medium' | 'large' | 'inherit'
  sx?: object 
}>
const EmptyHeart = FavoriteBorder as unknown as React.ComponentType<{ 
  fontSize?: 'small' | 'medium' | 'large' | 'inherit'
  sx?: object 
}>

export interface HeartRatingProps {
  /** Current rating value (1-10), null if not rated */
  value: number | null
  /** Callback when rating changes */
  onChange?: (rating: number | null) => void
  /** Size variant */
  size?: 'small' | 'medium' | 'large'
  /** Compact mode - shows only filled hearts count, not interactive */
  compact?: boolean
  /** Whether the component is read-only */
  readOnly?: boolean
  /** Whether the component is disabled */
  disabled?: boolean
  /** Whether a rating operation is in progress */
  loading?: boolean
  /** Show the rating number next to hearts */
  showValue?: boolean
  /** Max hearts to show in popper (default 10) */
  maxHearts?: number
  /** Additional sx props */
  sx?: object
}

const sizeConfig = {
  small: { 
    iconSize: 'small' as const, 
    heartSize: 20,
    popperHeartSize: 16,
    spacing: 0.25, 
    fontSize: '0.75rem',
    popperPadding: 1,
  },
  medium: { 
    iconSize: 'medium' as const, 
    heartSize: 28,
    popperHeartSize: 20,
    spacing: 0.5, 
    fontSize: '0.875rem',
    popperPadding: 1.5,
  },
  large: { 
    iconSize: 'large' as const, 
    heartSize: 36,
    popperHeartSize: 24,
    spacing: 0.75, 
    fontSize: '1rem',
    popperPadding: 2,
  },
}

const ratingLabels: Record<number, string> = {
  1: 'Terrible',
  2: 'Awful',
  3: 'Bad',
  4: 'Poor',
  5: 'Meh',
  6: 'Fair',
  7: 'Good',
  8: 'Great',
  9: 'Amazing',
  10: 'Perfect',
}

/**
 * Single heart icon that fills up based on the rating percentage
 */
function FillableHeart({ 
  fillPercent, 
  size, 
  onClick,
  disabled,
  interactive,
}: { 
  fillPercent: number
  size: number
  onClick?: () => void
  disabled?: boolean
  interactive?: boolean
}) {
  return (
    <Box
      onClick={interactive ? onClick : undefined}
      sx={{
        position: 'relative',
        width: size,
        height: size,
        cursor: interactive && !disabled ? 'pointer' : 'default',
        transition: 'transform 0.15s ease',
        '&:hover': interactive && !disabled ? {
          transform: 'scale(1.15)',
        } : {},
      }}
    >
      {/* Background empty heart */}
      <EmptyHeart
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: size,
          fontSize: size,
          color: 'rgba(244, 63, 94, 0.25)',
        }}
      />
      {/* Filled heart with clip-path for partial fill */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: size,
          clipPath: `inset(${100 - fillPercent}% 0 0 0)`,
          transition: 'clip-path 0.3s ease',
        }}
      >
        <FilledHeart
          sx={{
            width: size,
            height: size,
            fontSize: size,
            color: '#f43f5e',
          }}
        />
      </Box>
    </Box>
  )
}

export function HeartRating({
  value,
  onChange,
  size = 'medium',
  compact = false,
  readOnly = false,
  disabled = false,
  loading = false,
  showValue = false,
  maxHearts = 10,
  sx = {},
}: HeartRatingProps) {
  const [popperOpen, setPopperOpen] = useState(false)
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const config = sizeConfig[size]
  
  const isInteractive = !readOnly && !disabled && !loading && !!onChange
  const fillPercent = value ? (value / maxHearts) * 100 : 0

  // Compact mode - just show a badge with filled hearts
  if (compact) {
    if (value === null) return null
    
    return (
      <Tooltip title={`Your rating: ${value}/10 - ${ratingLabels[value]}`} arrow>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            backgroundColor: 'rgba(244, 63, 94, 0.9)',
            borderRadius: 1,
            px: 0.75,
            py: 0.25,
            ...sx,
          }}
        >
          <FilledHeart 
            fontSize="small" 
            sx={{ 
              color: 'white',
              fontSize: size === 'small' ? 12 : 14,
            }} 
          />
          <Typography
            sx={{
              color: 'white',
              fontWeight: 700,
              fontSize: size === 'small' ? '0.65rem' : '0.75rem',
              lineHeight: 1,
            }}
          >
            {value}
          </Typography>
        </Box>
      </Tooltip>
    )
  }

  const handleHeartClick = () => {
    if (isInteractive) {
      setPopperOpen(true)
    }
  }

  const handleSelectRating = (rating: number) => {
    if (!onChange) return
    // If clicking the same rating, clear it
    if (rating === value) {
      onChange(null)
    } else {
      onChange(rating)
    }
    setPopperOpen(false)
    setHoverValue(null)
  }

  const handleClickAway = () => {
    setPopperOpen(false)
    setHoverValue(null)
  }

  const handleMouseEnter = (rating: number) => {
    setHoverValue(rating)
  }

  const handleMouseLeave = () => {
    setHoverValue(null)
  }

  const displayValue = hoverValue ?? value
  const displayFillPercent = displayValue ? (displayValue / maxHearts) * 100 : fillPercent

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box
        ref={anchorRef}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: config.spacing,
          opacity: disabled || loading ? 0.5 : 1,
          ...sx,
        }}
      >
        {/* Single fillable heart */}
        <Box>
          <FillableHeart
            fillPercent={popperOpen ? displayFillPercent : fillPercent}
            size={config.heartSize}
            onClick={handleHeartClick}
            disabled={disabled || loading}
            interactive={isInteractive}
          />
        </Box>

        {/* Value label */}
        {showValue && (
          <Typography
            sx={{
              fontSize: config.fontSize,
              fontWeight: 600,
              color: value ? '#f43f5e' : 'text.secondary',
              minWidth: '2em',
            }}
          >
            {value ? `${value}` : '—'}
          </Typography>
        )}

        {/* Rating picker popper */}
        <Popper
          open={popperOpen}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          transition
          sx={{ zIndex: 1300 }}
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={200}>
              <Paper
                elevation={8}
                sx={{
                  p: config.popperPadding,
                  mt: 1,
                  borderRadius: 2,
                  backgroundColor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
                onMouseLeave={handleMouseLeave}
              >
                {/* Hearts row */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  {Array.from({ length: maxHearts }, (_, i) => {
                    const heartValue = i + 1
                    const isFilled = displayValue !== null && heartValue <= displayValue
                    const isHovered = hoverValue !== null && heartValue <= hoverValue
                    
                    const HeartIcon = isFilled ? FilledHeart : EmptyHeart
                    
                    const heartColor = isFilled 
                      ? isHovered 
                        ? '#fb7185' // rose-400
                        : '#f43f5e' // rose-500
                      : isHovered
                        ? '#fda4af' // rose-300
                        : 'rgba(244, 63, 94, 0.3)' // faded rose

                    return (
                      <IconButton
                        key={heartValue}
                        size="small"
                        onClick={() => handleSelectRating(heartValue)}
                        onMouseEnter={() => handleMouseEnter(heartValue)}
                        sx={{
                          p: 0.5,
                          transition: 'transform 0.1s ease',
                          '&:hover': {
                            transform: 'scale(1.2)',
                            backgroundColor: 'transparent',
                          },
                        }}
                      >
                        <HeartIcon
                          sx={{
                            fontSize: config.popperHeartSize,
                            color: heartColor,
                            transition: 'color 0.15s ease',
                          }}
                        />
                      </IconButton>
                    )
                  })}
                </Box>

                {/* Rating label */}
                <Box sx={{ 
                  mt: 1, 
                  pt: 1, 
                  borderTop: '1px solid', 
                  borderColor: 'divider',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <Typography
                    sx={{
                      fontSize: config.fontSize,
                      color: 'text.secondary',
                    }}
                  >
                    {displayValue ? `${displayValue}/10` : 'Select rating'}
                  </Typography>
                  {displayValue && (
                    <Typography
                      sx={{
                        fontSize: config.fontSize,
                        fontWeight: 600,
                        color: '#f43f5e',
                      }}
                    >
                      {ratingLabels[displayValue]}
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Fade>
          )}
        </Popper>
      </Box>
    </ClickAwayListener>
  )
}
