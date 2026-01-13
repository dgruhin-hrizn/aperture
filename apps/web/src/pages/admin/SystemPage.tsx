import React, { useState, useEffect } from 'react'
import { Box } from '@mui/material'
import BackupIcon from '@mui/icons-material/Backup'
import BuildIcon from '@mui/icons-material/Build'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import { DomainSection } from '@/components/admin'
import {
  CostEstimatorSection,
  BackupSection,
  DatabaseSection,
  PosterRepairSection,
} from '@/pages/settings/components'
import type { PurgeStats, EmbeddingModelConfig } from '@/pages/settings/types'

export function SystemPage() {
  const [purgeStats, setPurgeStats] = useState<PurgeStats | null>(null)
  const [loadingPurgeStats, setLoadingPurgeStats] = useState(false)
  const [purging, setPurging] = useState(false)
  const [purgeError, setPurgeError] = useState<string | null>(null)
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null)
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)
  const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingModelConfig | null>(null)

  useEffect(() => {
    fetchPurgeStats()
    fetchEmbeddingModel()
  }, [])

  const fetchPurgeStats = async () => {
    setLoadingPurgeStats(true)
    try {
      const response = await fetch('/api/admin/purge/stats', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setPurgeStats(data.stats)
      }
    } catch {
      // Silently fail - stats are optional
    } finally {
      setLoadingPurgeStats(false)
    }
  }

  const fetchEmbeddingModel = async () => {
    try {
      const response = await fetch('/api/settings/embedding-model', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setEmbeddingConfig(data)
      }
    } catch {
      // Silently fail
    }
  }

  const executePurge = async () => {
    setPurging(true)
    setPurgeError(null)
    setPurgeSuccess(null)
    try {
      const response = await fetch('/api/admin/purge', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        setPurgeSuccess('All data has been purged successfully')
        setShowPurgeConfirm(false)
        await fetchPurgeStats()
      } else {
        const data = await response.json()
        setPurgeError(data.error || 'Purge failed')
      }
    } catch {
      setPurgeError('Could not connect to server')
    } finally {
      setPurging(false)
    }
  }

  return (
    <Box>
      {/* Cost Estimator */}
      <DomainSection
        id="costs"
        title="Cost Estimator"
        description="Estimate OpenAI API costs based on your library size"
        icon={<AttachMoneyIcon />}
      >
        <CostEstimatorSection
          movieCount={embeddingConfig?.movieCount ?? purgeStats?.movies ?? 0}
          seriesCount={purgeStats?.series ?? 0}
          episodeCount={purgeStats?.episodes ?? 0}
          enabledUserCount={1}
          embeddingModel={embeddingConfig?.currentModel ?? 'text-embedding-3-large'}
        />
      </DomainSection>

      {/* Backup & Restore */}
      <DomainSection
        id="backup"
        title="Backup & Restore"
        description="Create and restore database backups"
        icon={<BackupIcon />}
      >
        <BackupSection />
      </DomainSection>

      {/* Maintenance */}
      <DomainSection
        id="maintenance"
        title="Maintenance"
        description="Tools for maintaining your library"
        icon={<BuildIcon />}
      >
        <PosterRepairSection />
      </DomainSection>

      {/* Database Management */}
      <DomainSection
        id="database"
        title="Database Management"
        description="Manage database content - use with caution"
        icon={<DeleteForeverIcon />}
      >
        <DatabaseSection
          purgeStats={purgeStats}
          loadingPurgeStats={loadingPurgeStats}
          purging={purging}
          purgeError={purgeError}
          setPurgeError={setPurgeError}
          purgeSuccess={purgeSuccess}
          setPurgeSuccess={setPurgeSuccess}
          showPurgeConfirm={showPurgeConfirm}
          setShowPurgeConfirm={setShowPurgeConfirm}
          onPurge={executePurge}
        />
      </DomainSection>
    </Box>
  )
}

