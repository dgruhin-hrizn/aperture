import React, { useState } from 'react'
import { Box, Typography, Tooltip, IconButton } from '@mui/material'
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
  /** Max hearts to show (default 10) */
  maxHearts?: number
}

const sizeConfig = {
  small: { iconSize: 'small' as const, spacing: 0.25, fontSize: '0.75rem' },
  medium: { iconSize: 'medium' as const, spacing: 0.5, fontSize: '0.875rem' },
  large: { iconSize: 'large' as const, spacing: 0.75, fontSize: '1rem' },
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
}: HeartRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const config = sizeConfig[size]
  
  const displayValue = hoverValue ?? value
  const isInteractive = !readOnly && !disabled && !loading && onChange

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

  const handleClick = (rating: number) => {
    if (!isInteractive) return
    // If clicking the same rating, clear it
    if (rating === value) {
      onChange(null)
    } else {
      onChange(rating)
    }
  }

  const handleMouseEnter = (rating: number) => {
    if (isInteractive) {
      setHoverValue(rating)
    }
  }

  const handleMouseLeave = () => {
    setHoverValue(null)
  }

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: config.spacing,
        opacity: disabled || loading ? 0.5 : 1,
      }}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hearts */}
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
          
          if (isInteractive) {
            return (
              <Tooltip 
                key={heartValue} 
                title={`${heartValue}/10 - ${ratingLabels[heartValue]}`}
                arrow
                placement="top"
              >
                <IconButton
                  size="small"
                  onClick={() => handleClick(heartValue)}
                  onMouseEnter={() => handleMouseEnter(heartValue)}
                  disabled={disabled || loading}
                  sx={{
                    p: size === 'small' ? 0.25 : 0.5,
                    transition: 'transform 0.1s ease',
                    '&:hover': {
                      transform: 'scale(1.2)',
                      backgroundColor: 'transparent',
                    },
                  }}
                >
                  <HeartIcon
                    fontSize={config.iconSize}
                    sx={{
                      color: heartColor,
                      transition: 'color 0.15s ease',
                    }}
                  />
                </IconButton>
              </Tooltip>
            )
          }
          
          return (
            <Box
              key={heartValue}
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: size === 'small' ? 0.125 : 0.25,
              }}
            >
              <HeartIcon
                fontSize={config.iconSize}
                sx={{
                  color: heartColor,
                }}
              />
            </Box>
          )
        })}
      </Box>

      {/* Value label */}
      {showValue && (
        <Typography
          sx={{
            fontSize: config.fontSize,
            fontWeight: 600,
            color: displayValue ? 'rose.500' : 'text.secondary',
            minWidth: '2.5em',
          }}
        >
          {displayValue ? `${displayValue}/10` : '—'}
        </Typography>
      )}

      {/* Rating label on hover */}
      {isInteractive && hoverValue && (
        <Typography
          sx={{
            fontSize: config.fontSize,
            color: 'text.secondary',
            fontStyle: 'italic',
            ml: 0.5,
          }}
        >
          {ratingLabels[hoverValue]}
        </Typography>
      )}
    </Box>
  )
}

