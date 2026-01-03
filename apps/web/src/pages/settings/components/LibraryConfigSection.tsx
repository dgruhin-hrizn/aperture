import React from 'react'
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
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import MovieIcon from '@mui/icons-material/Movie'
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

export function LibraryConfigSection({
  libraries,
  loadingLibraries,
  syncingLibraries,
  libraryError,
  updatingLibrary,
  onSync,
  onToggle,
}: LibraryConfigSectionProps) {
  const enabledCount = libraries.filter((l) => l.isEnabled).length

  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6">
              Library Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select which movie libraries to include when syncing movies
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Tooltip title="Refresh library list from media server">
              <Button
                variant="outlined"
                startIcon={syncingLibraries ? <CircularProgress size={16} /> : <RefreshIcon />}
                onClick={onSync}
                disabled={syncingLibraries}
                size="small"
              >
                {syncingLibraries ? 'Syncing...' : 'Sync from Media Server'}
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
            No libraries configured yet. Click "Sync from Media Server" to fetch your movie libraries.
          </Alert>
        ) : (
          <>
            <Box mb={2}>
              <Chip
                label={`${enabledCount} of ${libraries.length} libraries enabled`}
                color={enabledCount > 0 ? 'primary' : 'default'}
                size="small"
              />
              {enabledCount === 0 && libraries.length > 0 && (
                <Typography variant="caption" color="warning.main" sx={{ ml: 2 }}>
                  ⚠️ No libraries enabled - movie sync will be skipped
                </Typography>
              )}
            </Box>

            <List sx={{ bgcolor: 'background.default', borderRadius: 1 }}>
              {libraries.map((lib, index) => (
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
                      <MovieIcon />
                    </Box>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography fontWeight={500}>{lib.name}</Typography>
                          <Chip
                            label={lib.collectionType}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 20 }}
                          />
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          ID: {lib.providerLibraryId}
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
              Changes take effect on the next movie sync. Run the "Sync Movies" job after making changes.
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  )
}

