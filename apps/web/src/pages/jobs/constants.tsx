import React from 'react'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import PsychologyIcon from '@mui/icons-material/Psychology'
import HistoryIcon from '@mui/icons-material/History'
import RecommendIcon from '@mui/icons-material/Recommend'
import FolderIcon from '@mui/icons-material/Folder'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import type { JobCategory } from './types'

// Movie job categories
export const MOVIE_JOB_CATEGORIES: JobCategory[] = [
  {
    title: 'Sync',
    description: 'Keep your movie library in sync',
    color: '#3b82f6',
    jobs: ['sync-movies', 'sync-watch-history', 'full-sync-watch-history'],
  },
  {
    title: 'AI Processing',
    description: 'Machine learning tasks for movies',
    color: '#8b5cf6',
    jobs: ['generate-embeddings', 'generate-recommendations', 'rebuild-recommendations'],
  },
  {
    title: 'System',
    description: 'Movie library file management',
    color: '#6366f1',
    jobs: ['sync-strm'],
  },
]

// TV Series job categories
export const SERIES_JOB_CATEGORIES: JobCategory[] = [
  {
    title: 'Sync',
    description: 'Keep your TV series library in sync',
    color: '#0891b2',
    jobs: ['sync-series', 'sync-series-watch-history', 'full-sync-series-watch-history'],
  },
  {
    title: 'AI Processing',
    description: 'Machine learning tasks for TV series',
    color: '#7c3aed',
    jobs: ['generate-series-embeddings', 'generate-series-recommendations'],
  },
  {
    title: 'System',
    description: 'TV series library file management',
    color: '#4f46e5',
    jobs: ['sync-series-strm'],
  },
]

// Global job categories (not specific to movies or series)
export const GLOBAL_JOB_CATEGORIES: JobCategory[] = [
  {
    title: 'Top Picks',
    description: 'Global popularity-based libraries',
    color: '#f59e0b',
    jobs: ['refresh-top-picks'],
  },
]

// Combined for backwards compatibility
export const JOB_CATEGORIES: JobCategory[] = [
  ...MOVIE_JOB_CATEGORIES,
  ...SERIES_JOB_CATEGORIES,
  ...GLOBAL_JOB_CATEGORIES,
]

export const JOB_ICONS: Record<string, React.ReactNode> = {
  // Movie jobs
  'sync-movies': <MovieIcon />,
  'generate-embeddings': <PsychologyIcon />,
  'sync-watch-history': <HistoryIcon />,
  'full-sync-watch-history': <AutorenewIcon />,
  'generate-recommendations': <RecommendIcon />,
  'rebuild-recommendations': <AutorenewIcon />,
  'sync-strm': <FolderIcon />,
  // TV Series jobs
  'sync-series': <TvIcon />,
  'generate-series-embeddings': <PsychologyIcon />,
  'sync-series-watch-history': <HistoryIcon />,
  'full-sync-series-watch-history': <AutorenewIcon />,
  'generate-series-recommendations': <RecommendIcon />,
  'sync-series-strm': <FolderIcon />,
  // Global jobs
  'refresh-top-picks': <TrendingUpIcon />,
}

export const JOB_COLORS: Record<string, string> = {
  // Movie jobs
  'sync-movies': '#3b82f6',
  'generate-embeddings': '#a855f7',
  'sync-watch-history': '#f59e0b',
  'full-sync-watch-history': '#dc2626',
  'generate-recommendations': '#22c55e',
  'rebuild-recommendations': '#8b5cf6',
  'sync-strm': '#6366f1',
  // TV Series jobs
  'sync-series': '#0891b2',
  'generate-series-embeddings': '#c026d3',
  'sync-series-watch-history': '#ea580c',
  'full-sync-series-watch-history': '#dc2626',
  'generate-series-recommendations': '#16a34a',
  'sync-series-strm': '#4f46e5',
  // Global jobs
  'refresh-top-picks': '#f59e0b',
}

export function formatJobName(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function formatCron(cron: string | null): string {
  if (!cron) return 'Manual only'
  const parts = cron.split(' ')
  if (parts.length >= 5) {
    const hour = parseInt(parts[1])
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `Daily at ${displayHour}:00 ${ampm}`
  }
  return cron
}

export function getElapsedTime(startedAt: string): string {
  const start = new Date(startedAt).getTime()
  const now = Date.now()
  const elapsed = Math.floor((now - start) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

