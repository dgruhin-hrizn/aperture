import React from 'react'
import { Box, Grid, Stack } from '@mui/material'
import ExtensionIcon from '@mui/icons-material/Extension'
import StorageIcon from '@mui/icons-material/Storage'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import { DomainSection, DomainSectionGroup, InlineJobPanel } from '@/components/admin'
import {
  MediaServerSection,
  OpenAIConfigSection,
  TraktConfigSection,
  TMDbConfigSection,
  OMDbConfigSection,
  MDBListConfigSection,
} from '@/pages/settings/components'
import { ApiErrorAlert } from '@/components/ApiErrorAlert'

export function IntegrationsPage() {
  return (
    <Box>
      {/* API Errors Alert */}
      <Box sx={{ mb: 3 }}>
        <ApiErrorAlert maxErrors={5} />
      </Box>

      {/* Media Server */}
      <DomainSection
        id="media-server"
        title="Media Server"
        description="Connect Aperture to your Emby or Jellyfin server"
        icon={<StorageIcon />}
      >
        <MediaServerSection />
      </DomainSection>

      {/* API Connections */}
      <DomainSectionGroup
        title="API Connections"
        description="Configure external service integrations"
      >
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <DomainSection
              id="openai"
              title="OpenAI"
              isSubSection
            >
              <OpenAIConfigSection />
            </DomainSection>
          </Grid>
          <Grid item xs={12} lg={6}>
            <DomainSection
              id="trakt"
              title="Trakt"
              isSubSection
              jobPanels={
                <InlineJobPanel jobName="sync-trakt-ratings" compact />
              }
              showJobDivider={false}
            >
              <TraktConfigSection />
            </DomainSection>
          </Grid>
          <Grid item xs={12} lg={6}>
            <DomainSection
              id="tmdb"
              title="TMDb"
              isSubSection
            >
              <TMDbConfigSection />
            </DomainSection>
          </Grid>
          <Grid item xs={12} lg={6}>
            <DomainSection
              id="omdb"
              title="OMDb"
              isSubSection
            >
              <OMDbConfigSection />
            </DomainSection>
          </Grid>
          <Grid item xs={12} lg={6}>
            <DomainSection
              id="mdblist"
              title="MDBList"
              isSubSection
            >
              <MDBListConfigSection />
            </DomainSection>
          </Grid>
        </Grid>
      </DomainSectionGroup>

      {/* Metadata Enrichment */}
      <DomainSection
        id="enrichment"
        title="Metadata Enrichment"
        description="Enrich your library with additional metadata from external sources including keywords, collections, RT/Metacritic scores, languages, countries, and streaming providers"
        icon={<AutoFixHighIcon />}
      >
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6} lg={4}>
              <InlineJobPanel
                jobName="enrich-metadata"
                title="Enrich Metadata"
                description="Fetch keywords, collections, scores, and more"
              />
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <InlineJobPanel
                jobName="enrich-studio-logos"
                title="Enrich Studio Logos"
                description="Download studio/network logos"
              />
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <InlineJobPanel
                jobName="enrich-mdblist"
                title="Enrich from MDBList"
                description="Sync MDBList ratings and data"
              />
            </Grid>
          </Grid>
        </Stack>
      </DomainSection>
    </Box>
  )
}

