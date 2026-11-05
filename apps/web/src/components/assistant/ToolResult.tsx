import { ToolCard } from './ToolCard'
import { ProgressResults } from './ProgressResults'
import { WorkbenchResult } from './WorkbenchResult'
import { Alert, Box, Chip, LinearProgress, Typography } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { useTranslation } from 'react-i18next'
import {
  ContentCarousel,
  ContentDetail,
  PersonResult,
  StatsDisplay,
  StudiosDisplay,
  type ContentCarouselData,
  type ContentDetailData,
  type PersonResultData,
  type StatsData,
  type StudiosData,
} from './tool-ui'
import {
  ReleaseResults,
  TasteResults,
  LibraryGroupsResult,
  InformationResult,
} from './ConsultantResults'
import { ProviderAvailability } from './ProviderAvailability'
import { ToolResultError } from './ToolResultError'

export function ToolResult({
  toolName,
  result,
  isError,
  status,
}: {
  toolName: string
  result: unknown
  isError?: boolean
  status?: { type: string; reason?: string }
}) {
  const { t } = useTranslation()
  if (toolName === 'suggestNextReplies') return null
  if (isError)
    return (
      <ToolResultError message={typeof result === 'string' ? result : t('encore.toolFailed')} />
    )
  if (result === undefined && status?.type === 'incomplete')
    return (
      <Alert severity="warning" variant="outlined" sx={{ py: 0, borderRadius: 2 }}>
        {t(status.reason === 'cancelled' ? 'encore.toolCancelled' : 'encore.toolIncomplete')}
      </Alert>
    )
  if (result === undefined)
    return (
      <ToolCard variant="outlined" role="status">
        <Typography variant="body2" color="text.secondary">
          {t(toolName === 'web_search' ? 'encore.webSearchWorking' : 'encore.toolWorking')}
        </Typography>
        <LinearProgress sx={{ mt: 1.5, borderRadius: 3 }} />
      </ToolCard>
    )
  if (toolName === 'web_search' || !result || typeof result !== 'object') return null
  const data = result as Record<string, unknown>
  if (
    [
      'memory',
      'memories',
      'memoryForgotten',
      'watchPlan',
      'plans',
      'planDeleted',
      'actionProposal',
      'actionReceipt',
      'actions',
      'actionCancelled',
      'curation',
      'curations',
      'curationDeleted',
    ].includes(String(data.kind))
  )
    return <WorkbenchResult data={data} />
  if (data.kind === 'episodes' || ('franchiseName' in data && Array.isArray(data.movies)))
    return <ProgressResults data={data} />
  if (data.kind === 'releases') return <ReleaseResults data={data} />
  if (data.kind === 'taste') return <TasteResults data={data} />
  if ('movieGenres' in data || 'seriesGenres' in data || Array.isArray(data.franchises))
    return <LibraryGroupsResult data={data} />
  if (typeof data.error === 'string') return <ToolResultError message={data.error} />
  let content
  if (Array.isArray(data.items))
    content = <ContentCarousel data={data as unknown as ContentCarouselData} />
  else if ('contentId' in data && 'actions' in data)
    content = (
      <>
        <ContentDetail data={data as unknown as ContentDetailData} />
        {data.kind === 'externalDetails' && <ProviderAvailability data={data} />}
      </>
    )
  else if (Array.isArray(data.people))
    content = <PersonResult data={data as unknown as PersonResultData} />
  else if ('movieCount' in data) content = <StatsDisplay data={data as unknown as StatsData} />
  else if (Array.isArray(data.studios) || Array.isArray(data.networks))
    content = <StudiosDisplay data={data as unknown as StudiosData} />
  else content = <InformationResult data={data} />
  return (
    <Box
      sx={{
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 0.75, sm: 1.5 },
        '&& > *': { my: 0 },
      }}
    >
      <Chip
        size="small"
        icon={<CheckCircleOutlineIcon />}
        label={t(`encore.tools.${toolName}`, { defaultValue: t('encore.toolComplete') })}
        variant="outlined"
        sx={{
          alignSelf: 'flex-start',
          maxWidth: '100%',
          height: 'auto',
          minHeight: 24,
          '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere' },
        }}
      />
      {content}
    </Box>
  )
}
