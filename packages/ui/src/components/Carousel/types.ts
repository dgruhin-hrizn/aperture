import type { ReactNode } from 'react'

export interface CarouselProps {
  /** Carousel title */
  title: string
  /** Optional subtitle/description */
  subtitle?: string
  /** Loading state - shows skeletons */
  loading?: boolean
  /** Message to show when empty (if not provided, carousel hides when empty) */
  emptyMessage?: string
  /** Number of skeleton items to show while loading */
  skeletonCount?: number
  /** Custom skeleton renderer */
  renderSkeleton?: () => ReactNode
  /** Children are the carousel items */
  children: ReactNode
  /** Whether the carousel has items (used for empty state) */
  hasItems?: boolean
}

export interface CarouselItemProps {
  /** Unique key for the item */
  id: string
  /** Item content */
  children: ReactNode
}

