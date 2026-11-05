import { Children, useId, useState, type ReactNode } from 'react'
import { Box, Button, Paper, Stack, Typography, styled } from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { useTranslation } from 'react-i18next'

export const ToolCard = styled(Paper)(({ theme }) => ({
  boxSizing: 'border-box',
  width: '100%',
  minWidth: 0,
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius * 2.5,
  overflowWrap: 'anywhere',
  [theme.breakpoints.up('sm')]: { padding: theme.spacing(2) },
}))

export function ToolCardHeading({
  icon,
  title,
  status,
}: {
  icon: ReactNode
  title: string
  status?: ReactNode
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Box sx={{ color: 'primary.main', flexShrink: 0, display: 'flex', pt: 0.125 }}>{icon}</Box>
      <Stack
        direction="row"
        flexWrap="wrap"
        alignItems="center"
        gap={0.75}
        sx={{ flex: 1, minWidth: 0 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={650}
          sx={{ flex: '1 1 140px', minWidth: 0, lineHeight: 1.35 }}
        >
          {title}
        </Typography>
        {status}
      </Stack>
    </Box>
  )
}

export function ToolPreview({
  children,
  limit = 4,
  chips = false,
}: {
  children: ReactNode
  limit?: number
  chips?: boolean
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const items = Children.toArray(children)
  return (
    <>
      <Box
        id={listId}
        sx={
          chips
            ? { display: 'flex', flexWrap: 'wrap', gap: 0.5 }
            : { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0.75 }
        }
      >
        {expanded ? items : items.slice(0, limit)}
      </Box>
      {items.length > limit && (
        <Button
          size="small"
          aria-controls={listId}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          endIcon={<ExpandMoreRoundedIcon sx={{ rotate: expanded ? '180deg' : '0deg' }} />}
          sx={{ minHeight: 44, textAlign: 'start', mt: 0.25, maxWidth: '100%' }}
        >
          {expanded
            ? t('encore.showFewerReleases')
            : t('encore.showAllReleases', { count: items.length })}
        </Button>
      )}
    </>
  )
}
