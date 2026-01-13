import React from 'react'
import { Box } from '@mui/material'
import AddToQueueIcon from '@mui/icons-material/AddToQueue'
import { DomainSection, InlineJobPanel } from '@/components/admin'
import { WatchingSection } from '@/pages/settings/components'

export function WatchingPage() {
  return (
    <Box>
      <DomainSection
        title="Shows You Watch"
        description="Allow users to create personal libraries of series they're currently watching"
        icon={<AddToQueueIcon />}
        jobPanels={<InlineJobPanel jobName="sync-watching-libraries" />}
      >
        <WatchingSection />
      </DomainSection>
    </Box>
  )
}

