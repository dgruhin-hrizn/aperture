import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  CircularProgress,
  Chip,
  Divider,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import type { LibraryConfig } from '../types'

interface LibraryConfigSectionProps {
  libraries: LibraryConfig[]
  loadingLibraries: boolean
  syncingLibraries: boolean
  libraryError: string | null
  updatingLibrary: string | null
  onSync: () => void
  onToggle: (providerLibraryId: string, isEnabled: boolean) => void
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box pt={2}>{children}</Box>}
    </div>
  )
}

export function LibraryConfigSection({
  libraries,
  loadingLibraries,
  syncingLibraries,
  libraryError,
  updatingLibrary,
  onSync,
  onToggle,
}: LibraryConfigSectionProps) {
  const { t } = useTranslation()
  const [tabValue, setTabValue] = React.useState(0)

  const movieLibraries = libraries.filter((l) => l.collectionType === 'movies')
  const tvLibraries = libraries.filter((l) => l.collectionType === 'tvshows')

  const enabledMovieCount = movieLibraries.filter((l) => l.isEnabled).length
  const enabledTvCount = tvLibraries.filter((l) => l.isEnabled).length

  const renderLibraryList = (libs: LibraryConfig[], type: 'movies' | 'tvshows') => {
    const Icon = type === 'movies' ? MovieIcon : TvIcon
    const enabledCount = type === 'movies' ? enabledMovieCount : enabledTvCount
    const typeLabel =
      type === 'movies' ? t('settingsLibraryConfig.typeMovie') : t('settingsLibraryConfig.typeTvShow')

    if (libs.length === 0) {
      return (
        <Alert severity="info">
          {type === 'movies'
            ? t('settingsLibraryConfig.noLibrariesMovie')
            : t('settingsLibraryConfig.noLibrariesTv')}
        </Alert>
      )
    }

    return (
      <>
        <Box mb={2}>
          <Chip
            label={t('settingsLibraryConfig.enabledChip', { enabled: enabledCount, total: libs.length })}
            color={enabledCount > 0 ? 'primary' : 'default'}
            size="small"
          />
          {enabledCount === 0 && libs.length > 0 && (
            <Typography variant="caption" color="warning.main" sx={{ ml: 2 }}>
              {t('settingsLibraryConfig.warningNoneEnabled', { type: typeLabel })}
            </Typography>
          )}
        </Box>

        <List sx={{ bgcolor: 'background.default', borderRadius: 1 }}>
          {libs.map((lib, index) => (
            <React.Fragment key={lib.id}>
              {index > 0 && <Divider />}
              <ListItem>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mr: 2,
                    color: lib.isEnabled ? 'primary.main' : 'text.secondary',
                  }}
                >
                  <Icon />
                </Box>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography fontWeight={500}>{lib.name}</Typography>
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {t('settingsLibraryConfig.idLabel', { id: lib.providerLibraryId })}
                    </Typography>
                  }
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={lib.isEnabled}
                    onChange={(e) =>
                      onToggle(lib.providerLibraryId, e.target.checked)
                    }
                    disabled={updatingLibrary === lib.providerLibraryId}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </React.Fragment>
          ))}
        </List>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          {t('settingsLibraryConfig.footerNextSync', { type: typeLabel })}
        </Typography>
      </>
    )
  }

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6">
              {t('settingsLibraryConfig.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('settingsLibraryConfig.subtitle')}
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Tooltip title={t('settingsLibraryConfig.syncTooltip')}>
              <Button
                variant="outlined"
                startIcon={syncingLibraries ? <CircularProgress size={16} /> : <RefreshIcon />}
                onClick={onSync}
                disabled={syncingLibraries}
                size="small"
              >
                {syncingLibraries ? t('settingsLibraryConfig.syncing') : t('settingsLibraryConfig.syncButton')}
              </Button>
            </Tooltip>
          </Box>
        </Box>

        {libraryError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {libraryError}
          </Alert>
        )}

        {loadingLibraries ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : libraries.length === 0 ? (
          <Alert severity="info">
            {t('settingsLibraryConfig.emptyState')}
          </Alert>
        ) : (
          <>
            <Tabs
              value={tabValue}
              onChange={(_, newValue) => setTabValue(newValue)}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab
                icon={<MovieIcon />}
                iconPosition="start"
                label={t('settingsLibraryConfig.tabMovies', { count: movieLibraries.length })}
              />
              <Tab
                icon={<TvIcon />}
                iconPosition="start"
                label={t('settingsLibraryConfig.tabTvShows', { count: tvLibraries.length })}
              />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              {renderLibraryList(movieLibraries, 'movies')}
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {renderLibraryList(tvLibraries, 'tvshows')}
            </TabPanel>
          </>
        )}
      </CardContent>
    </Card>
  )
}
