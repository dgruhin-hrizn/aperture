import React from 'react'
import MovieIcon from '@mui/icons-material/Movie'
import PsychologyIcon from '@mui/icons-material/Psychology'
import HistoryIcon from '@mui/icons-material/History'
import RecommendIcon from '@mui/icons-material/Recommend'
import FolderIcon from '@mui/icons-material/Folder'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import type { JobCategory } from './types'

export const JOB_CATEGORIES: JobCategory[] = [
  {
    title: 'Sync',
    description: 'Keep your library in sync',
    color: '#3b82f6',
    jobs: ['sync-movies', 'sync-watch-history'],
  },
  {
    title: 'AI Processing',
    description: 'Machine learning tasks',
    color: '#8b5cf6',
    jobs: ['generate-embeddings', 'generate-recommendations', 'rebuild-recommendations'],
  },
  {
    title: 'System',
    description: 'Maintenance tasks',
    color: '#6366f1',
    jobs: ['sync-strm'],
  },
]

export const JOB_ICONS: Record<string, React.ReactNode> = {
  'sync-movies': <MovieIcon />,
  'generate-embeddings': <PsychologyIcon />,
  'sync-watch-history': <HistoryIcon />,
  'generate-recommendations': <RecommendIcon />,
  'rebuild-recommendations': <AutorenewIcon />,
  'sync-strm': <FolderIcon />,
}

export const JOB_COLORS: Record<string, string> = {
  'sync-movies': '#3b82f6',
  'generate-embeddings': '#a855f7',
  'sync-watch-history': '#f59e0b',
  'generate-recommendations': '#22c55e',
  'rebuild-recommendations': '#8b5cf6',
  'sync-strm': '#6366f1',
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

