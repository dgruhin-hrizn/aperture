import { Box, Chip, LinearProgress, Paper, Typography } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { useTranslation } from 'react-i18next'
import { ContentCarousel, ContentDetail, PersonResult, StatsDisplay, StudiosDisplay, type ContentCarouselData, type ContentDetailData, type PersonResultData, type StatsData, type StudiosData } from './tool-ui'
import { ToolResultError } from './ToolResultError'

export function ToolResult({ toolName, result }: { toolName: string; result: unknown }) {
  const { t } = useTranslation()
  if (result === undefined) return <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, my: 1 }} aria-live="polite"><Typography variant="body2" color="text.secondary">{t('encore.toolWorking')}</Typography><LinearProgress sx={{ mt: 1.5, borderRadius: 3 }} /></Paper>
  if (!result || typeof result !== 'object') return null
  const data = result as Record<string, unknown>
  if (typeof data.error === 'string') return <ToolResultError message={data.error} />
  let content
  if (Array.isArray(data.items)) content = <ContentCarousel data={data as unknown as ContentCarouselData} />
  else if ('contentId' in data && 'actions' in data) content = <ContentDetail data={data as unknown as ContentDetailData} />
  else if (Array.isArray(data.people)) content = <PersonResult data={data as unknown as PersonResultData} />
  else if ('movieCount' in data) content = <StatsDisplay data={data as unknown as StatsData} />
  else if (Array.isArray(data.studios) || Array.isArray(data.networks)) content = <StudiosDisplay data={data as unknown as StudiosData} />
  else content = <Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12, maxHeight: 300, overflowY: 'auto' }}>{JSON.stringify(result, null, 2)}</Box>
  return <Box sx={{ my: 1.5, minWidth: 0 }}>
    <Chip size="small" icon={<CheckCircleOutlineIcon />} label={t(`encore.tools.${toolName}`, { defaultValue: t('encore.toolComplete') })} variant="outlined" sx={{ mb: 1 }} />
    {content}
  </Box>
}
