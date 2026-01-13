import React from 'react'
import { Box } from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { DomainSection, InlineJobPanel } from '@/components/admin'
import { TopPicksSection } from '@/pages/settings/components'

export function TopPicksPage() {
  return (
    <Box>
      <DomainSection
        title="Top Picks"
        description="Configure global popularity-based libraries that showcase trending and popular content"
        icon={<TrendingUpIcon />}
        jobPanels={<InlineJobPanel jobName="refresh-top-picks" />}
      >
        <TopPicksSection />
      </DomainSection>
    </Box>
  )
}

