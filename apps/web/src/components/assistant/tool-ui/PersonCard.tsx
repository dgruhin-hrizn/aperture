import { Avatar, Box, Button, Stack, Typography } from '@mui/material'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import PersonIcon from '@mui/icons-material/Person'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getProxiedImageUrl } from '@aperture/ui'
import { ToolCard, ToolPreview } from '../ToolCard'
import { ToolResultError } from '../ToolResultError'
import type { Person, PersonResultData } from './types'

function PersonCardSingle({ person }: { person: Person }) {
  const { t } = useTranslation()

  const roleLabel = {
    actor: t('assistantToolUi.roleActor'),
    director: t('assistantToolUi.roleDirector'),
    writer: t('assistantToolUi.roleWriter'),
  }[person.role]

  return (
    <ToolCard variant="outlined">
      <Stack direction="row" gap={1.25} alignItems="center">
        <Avatar
          src={getProxiedImageUrl(person.thumb)}
          sx={{ width: { xs: 44, sm: 56 }, height: { xs: 44, sm: 56 } }}
        >
          <PersonIcon />
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={650} sx={{ lineHeight: 1.3 }}>
            {person.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {roleLabel}
          </Typography>
        </Box>
      </Stack>
      {(['movie', 'series'] as const).map((type) => {
        const films = person.filmography.filter((film) => film.type === type)
        if (!films.length) return null
        return (
          <Box key={type} sx={{ mt: 1 }}>
            <Typography variant="caption" fontWeight={650} color="text.secondary">
              {t(
                type === 'movie'
                  ? 'assistantToolUi.moviesHeading'
                  : 'assistantToolUi.tvSeriesHeading',
                { count: films.length }
              )}
            </Typography>
            <ToolPreview limit={3}>
              {films.map((film) => {
                const props = film.sourceUrl
                  ? { href: film.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }
                  : { component: Link, to: `/${type === 'movie' ? 'movies' : 'series'}/${film.id}` }
                return (
                  <Button
                    key={film.id}
                    {...props}
                    size="small"
                    endIcon={
                      <ChevronRightRoundedIcon
                        sx={{
                          transform: (theme) =>
                            theme.direction === 'rtl' ? 'scaleX(-1)' : undefined,
                        }}
                      />
                    }
                    sx={{
                      justifyContent: 'space-between',
                      minHeight: 44,
                      textAlign: 'start',
                      bgcolor: 'action.hover',
                      color: 'text.primary',
                      maxWidth: '100%',
                    }}
                  >
                    {film.year ? `${film.title} (${film.year})` : film.title}
                  </Button>
                )
              })}
            </ToolPreview>
          </Box>
        )
      })}
    </ToolCard>
  )
}

export function PersonResult({ data }: { data: PersonResultData }) {
  if (data.error) return <ToolResultError message={data.error} />

  return (
    <ToolPreview limit={2}>
      {data.people.map((person, index) => (
        <PersonCardSingle key={`${person.name}-${index}`} person={person} />
      ))}
    </ToolPreview>
  )
}
