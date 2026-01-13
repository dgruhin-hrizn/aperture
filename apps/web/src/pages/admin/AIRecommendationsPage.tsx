import React from 'react'
import { Box, Grid, Stack } from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import OutputIcon from '@mui/icons-material/Output'
import TuneIcon from '@mui/icons-material/Tune'
import PsychologyIcon from '@mui/icons-material/Psychology'
import { DomainSection, DomainSectionGroup, InlineJobPanel } from '@/components/admin'
import {
  OutputFormatSection,
  LibraryTitlesSection,
  AiExplanationSection,
  TextGenerationModelSection,
  RecommendationConfigSection,
} from '@/pages/settings/components'
import { useRecommendationConfig } from './hooks'

export function AIRecommendationsPage() {
  const recConfigProps = useRecommendationConfig()

  return (
    <Box>
      {/* Output Configuration */}
      <DomainSectionGroup
        title="Output"
        description="Configure how recommendations are delivered to users"
      >
        <DomainSection
          id="output-format"
          title="Output Format"
          description="Choose how recommendation libraries are created (STRM files or symlinks)"
          icon={<OutputIcon />}
          jobPanels={
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <InlineJobPanel jobName="sync-movie-libraries" />
              </Grid>
              <Grid item xs={12} md={6}>
                <InlineJobPanel jobName="sync-series-libraries" />
              </Grid>
            </Grid>
          }
        >
          <OutputFormatSection />
        </DomainSection>

        <DomainSection
          title="Library Images"
          description="Customize the appearance of recommendation libraries in your media server"
        >
          <LibraryTitlesSection />
        </DomainSection>
      </DomainSectionGroup>

      {/* Algorithm Configuration */}
      <DomainSectionGroup
        title="Algorithm"
        description="Fine-tune how recommendations are generated"
      >
        <DomainSection
          id="algorithm"
          title="Recommendation Settings"
          description="Configure the recommendation algorithm parameters for movies and series"
          icon={<TuneIcon />}
          jobPanels={
            <Grid container spacing={2}>
              <Grid item xs={12} md={6} lg={4}>
                <InlineJobPanel jobName="generate-movie-recommendations" />
              </Grid>
              <Grid item xs={12} md={6} lg={4}>
                <InlineJobPanel jobName="generate-series-recommendations" />
              </Grid>
              <Grid item xs={12} md={6} lg={4}>
                <InlineJobPanel jobName="rebuild-movie-recommendations" />
              </Grid>
            </Grid>
          }
        >
          <RecommendationConfigSection {...recConfigProps} />
        </DomainSection>
      </DomainSectionGroup>

      {/* AI Features */}
      <DomainSectionGroup
        title="AI Features"
        description="Configure AI-powered explanation and text generation"
      >
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <DomainSection
              id="ai-explanations"
              title="AI Explanations"
              description="Let AI explain why content is recommended"
              icon={<AutoAwesomeIcon />}
              isSubSection
            >
              <AiExplanationSection />
            </DomainSection>
          </Grid>
          <Grid item xs={12} lg={6}>
            <DomainSection
              id="text-generation"
              title="Text Generation Model"
              description="Choose the model for generating explanations"
              icon={<PsychologyIcon />}
              isSubSection
            >
              <TextGenerationModelSection />
            </DomainSection>
          </Grid>
        </Grid>
      </DomainSectionGroup>
    </Box>
  )
}

