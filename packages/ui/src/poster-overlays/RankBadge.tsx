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
  /** Additional sx props */
  sx?: object
}

/**
 * Unified rank badge component with gradient styling for top 3 ranks
 * - Gold gradient for #1
 * - Silver gradient for #2
 * - Bronze gradient for #3
 * - Dark background for #4+
 */
export function RankBadge({
  rank,
  size = 'medium',
  position = 'topLeft',
  absolute = true,
  sx = {},
}: RankBadgeProps) {
  const style = getRankStyle(rank)
  const textColor = getRankTextColor(rank)
  const sizeConfig = BADGE_SIZES[size]
  const positionConfig = OVERLAY_POSITIONS[position]

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


