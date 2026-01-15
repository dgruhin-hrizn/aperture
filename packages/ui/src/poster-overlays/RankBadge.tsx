import React from 'react'
import { Box, Typography } from '@mui/material'
import {
  getRankStyle,
  getRankTextColor,
  OVERLAY_POSITIONS,
  BADGE_SIZES,
  OVERLAY_COMMON_STYLES,
  type OverlayPosition,
  type BadgeSize,
} from './constants.js'

export interface RankBadgeProps {
  /** The rank number to display */
  rank: number
  /** Size variant */
  size?: BadgeSize
  /** Position on the poster (only applies when used as overlay) */
  position?: OverlayPosition
  /** Whether to use absolute positioning (default: true for overlay use) */
  absolute?: boolean
  /** Badge style variant */
  variant?: 'circle' | 'sharp'
  /** Additional sx props */
  sx?: object
}

/**
 * Unified rank badge component
 * 
 * Variants:
 * - sharp (default): Semi-transparent black square flush to corner with white number
 *   Matches the server-side sharp library overlay style
 * - circle: Circular badge with gradient styling for top 3 ranks
 */
export function RankBadge({
  rank,
  size = 'medium',
  position = 'topLeft',
  absolute = true,
  variant = 'sharp',
  sx = {},
}: RankBadgeProps) {
  const style = getRankStyle(rank)
  const textColor = getRankTextColor(rank)
  const sizeConfig = BADGE_SIZES[size]
  const positionConfig = OVERLAY_POSITIONS[position]

  // Sharp variant - semi-transparent black square flush to corner
  // Matches the sharp library overlay style from poster.ts exactly:
  // - Square size = 36% of poster width (badgeRadius * 2, where radius = 18% of min dimension)
  // - Font size = 55% of square size (badgeRadius * 1.1)
  // - Font: Oswald, weight 700
  // - Background: rgba(0,0,0,0.6)
  if (variant === 'sharp') {
    // Sizes calculated for typical poster widths:
    // small: ~100px poster → 36px square, 20px font
    // medium: ~150px poster → 54px square, 30px font
    // large: ~200px poster → 72px square, 40px font
    // xlarge: ~250px poster → 90px square, 50px font
    const sharpSizes = {
      small: { size: 36, fontSize: 20 },
      medium: { size: 54, fontSize: 30 },
      large: { size: 72, fontSize: 40 },
      xlarge: { size: 90, fontSize: 50 },
    }
    const sharpConfig = sharpSizes[size]

    return (
      <Box
        sx={{
          ...(absolute ? { position: 'absolute', zIndex: 3 } : {}),
          ...(absolute ? { top: 0, left: 0 } : {}),
          width: sharpConfig.size,
          height: sharpConfig.size,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...sx,
        }}
      >
        <Typography
          sx={{
            color: '#fff',
            fontFamily: '"Oswald", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontWeight: 700,
            fontSize: sharpConfig.fontSize,
            lineHeight: 1,
          }}
        >
          {rank}
        </Typography>
      </Box>
    )
  }

  // Circle variant - traditional circular badge with gradients
  return (
    <Box
      sx={{
        ...(absolute ? OVERLAY_COMMON_STYLES : {}),
        ...(absolute ? positionConfig : {}),
        width: sizeConfig.width,
        height: sizeConfig.height,
        borderRadius: '50%',
        background: style.bg,
        border: `2px solid ${style.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...sx,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: textColor,
          fontWeight: 800,
          fontSize: sizeConfig.fontSize,
          lineHeight: 1,
        }}
      >
        {rank}
      </Typography>
    </Box>
  )
}


