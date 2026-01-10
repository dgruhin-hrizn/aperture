/**
 * Shared constants for poster overlay styling
 */

// Rank badge color styles (gradient for top 3, solid for others)
export const RANK_STYLES: Record<number | 'default', { bg: string; border: string }> = {
  1: { bg: 'linear-gradient(135deg, #ffd700 0%, #ffec8b 100%)', border: '#daa520' }, // Gold
  2: { bg: 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)', border: '#a8a8a8' }, // Silver
  3: { bg: 'linear-gradient(135deg, #cd7f32 0%, #daa06d 100%)', border: '#8b4513' }, // Bronze
  default: { bg: 'rgba(0, 0, 0, 0.7)', border: 'transparent' },
}

// Get rank style - helper function
export function getRankStyle(rank: number): { bg: string; border: string } {
  return RANK_STYLES[rank] || RANK_STYLES.default
}

// Text color based on rank (dark for metallic badges, white for others)
export function getRankTextColor(rank: number): string {
  return rank <= 3 ? '#000' : '#fff'
}

// Overlay positions
export const OVERLAY_POSITIONS = {
  topLeft: { top: 8, left: 8 },
  topRight: { top: 8, right: 8 },
  bottomLeft: { bottom: 8, left: 8 },
  bottomRight: { bottom: 8, right: 8 },
} as const

export type OverlayPosition = keyof typeof OVERLAY_POSITIONS

// Badge sizes
export const BADGE_SIZES = {
  small: { width: 24, height: 24, fontSize: '0.7rem' },
  medium: { width: 28, height: 28, fontSize: '0.75rem' },
  large: { width: 32, height: 32, fontSize: '0.875rem' },
  xlarge: { width: 48, height: 48, fontSize: '1.25rem' },
} as const

export type BadgeSize = keyof typeof BADGE_SIZES

// Common overlay styles
export const OVERLAY_COMMON_STYLES = {
  position: 'absolute' as const,
  zIndex: 3,
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
}

// Rating badge styles (community rating with star)
export const RATING_BADGE_STYLES = {
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  height: 24,
  fontSize: '0.7rem',
  fontWeight: 600,
}

// Heart rating container styles
export const HEART_RATING_CONTAINER_STYLES = {
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  borderRadius: '50%',
  padding: 0.5,
  backdropFilter: 'blur(4px)',
  transition: 'background-color 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
}

// Match score badge styles
export const MATCH_SCORE_BADGE_STYLES = {
  fontWeight: 700,
  fontSize: '0.7rem',
  height: 24,
  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(139, 92, 246, 0.9) 100%)',
  color: 'white',
}


