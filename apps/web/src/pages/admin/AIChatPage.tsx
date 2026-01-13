import React from 'react'
import { Box } from '@mui/material'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import { DomainSection } from '@/components/admin'
import { ChatAssistantModelSection } from '@/pages/settings/components'

export function AIChatPage() {
  return (
    <Box>
      <DomainSection
        title="Chat Assistant"
        description="Configure the AI model used for the chat assistant that helps users find content and get recommendations"
        icon={<SmartToyIcon />}
      >
        <ChatAssistantModelSection />
      </DomainSection>
    </Box>
  )
}

