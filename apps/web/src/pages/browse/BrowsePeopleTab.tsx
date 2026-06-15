import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import type { ViewMode } from '../../hooks/view-mode-context'
import { BrowsePersonCard, BrowsePersonRow } from './components'
import { useBrowsePeople } from './hooks'

type BrowsePeopleHook = ReturnType<typeof useBrowsePeople>

interface BrowsePeopleTabProps {
  viewMode: ViewMode
  people: BrowsePeopleHook
}

function renderPeopleSkeleton(viewMode: ViewMode) {
  return viewMode === 'grid' ? (
    <Grid container spacing={2}>
      {Array.from({ length: 12 }).map((_, index) => (
        <Grid item xs={6} sm={4} md={3} lg={2} key={index}>
          <Skeleton
            variant="rectangular"
            sx={{ width: '100%', aspectRatio: '2/3', borderRadius: 2 }}
          />
          <Skeleton variant="text" width="80%" sx={{ mt: 1 }} />
          <Skeleton variant="text" width="50%" />
        </Grid>
      ))}
    </Grid>
  ) : (
    <Box display="flex" flexDirection="column" gap={2}>
      {Array.from({ length: 8 }).map((_, index) => (
        <Box key={index} display="flex" gap={2} bgcolor="background.paper" borderRadius={2} p={2}>
          <Skeleton variant="circular" width={56} height={56} />
          <Box flexGrow={1}>
            <Skeleton variant="text" width="50%" height={28} />
            <Skeleton variant="text" width="35%" height={20} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export function BrowsePeopleTab({ viewMode, people }: BrowsePeopleTabProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <>
      <Box
        sx={{
          position: 'sticky',
          top: { xs: 56, sm: 64 },
          zIndex: 10,
          backgroundColor: 'background.default',
          py: 2,
          mx: -3,
          px: 3,
          mb: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box display="flex" gap={1.5} flexWrap="wrap" alignItems="center">
          <TextField
            placeholder={t('browse.searchPeoplePlaceholder')}
            value={people.peopleSearch}
            onChange={(event) => people.setPeopleSearch(event.target.value)}
            size="small"
            sx={{ width: { xs: '100%', sm: 220 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ width: { xs: '100%', sm: 160 } }}>
            <InputLabel>{t('browse.labels.sort')}</InputLabel>
            <Select
              value={people.peopleSortBy}
              label={t('browse.labels.sort')}
              onChange={(event) =>
                people.setPeopleSortBy(event.target.value as 'name' | 'credits')
              }
            >
              <MenuItem value="name">{t('browse.sort.name')}</MenuItem>
              <MenuItem value="credits">{t('browse.sort.credits')}</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {people.peopleError && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {people.peopleError}
        </Alert>
      )}

      {people.peopleLoading ? (
        renderPeopleSkeleton(viewMode)
      ) : people.people.length === 0 ? (
        <Typography color="text.secondary">
          {people.peopleSearch
            ? t('browse.empty.peopleFiltered')
            : t('browse.empty.peopleNoSync')}
        </Typography>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <Grid container spacing={2}>
              {people.people.map((person) => (
                <Grid item xs={6} sm={4} md={3} lg={2} key={person.name}>
                  <BrowsePersonCard
                    person={person}
                    onNavigate={() => navigate(`/person/${encodeURIComponent(person.name)}`)}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box display="flex" flexDirection="column" gap={1.5}>
              {people.people.map((person) => (
                <BrowsePersonRow
                  key={person.name}
                  person={person}
                  onNavigate={() => navigate(`/person/${encodeURIComponent(person.name)}`)}
                />
              ))}
            </Box>
          )}

          <Box
            ref={people.peopleLoadMoreRef}
            display="flex"
            justifyContent="center"
            alignItems="center"
            py={4}
          >
            {people.peopleLoadingMore && <CircularProgress size={32} />}
            {!people.peopleHasMore && people.people.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('browse.loadMore.allPeople', {
                  count: people.peopleTotal.toLocaleString(),
                })}
              </Typography>
            )}
          </Box>
        </>
      )}
    </>
  )
}
