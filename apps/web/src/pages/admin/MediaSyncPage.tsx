import React, { useState, useEffect } from 'react'
import { Box, Grid, Stack } from '@mui/material'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import FolderIcon from '@mui/icons-material/Folder'
import { DomainSection, InlineJobPanel } from '@/components/admin'
import { LibraryConfigSection, FileLocationsSection } from '@/pages/settings/components'
import type { LibraryConfig } from '@/pages/settings/types'

export function MediaSyncPage() {
  const [libraries, setLibraries] = useState<LibraryConfig[]>([])
  const [loadingLibraries, setLoadingLibraries] = useState(false)
  const [syncingLibraries, setSyncingLibraries] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [updatingLibrary, setUpdatingLibrary] = useState<string | null>(null)

  useEffect(() => {
    fetchLibraries()
  }, [])

  const fetchLibraries = async () => {
    setLoadingLibraries(true)
    setLibraryError(null)
    try {
      const response = await fetch('/api/settings/libraries', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setLibraries(data.libraries)
      } else {
        setLibraryError('Failed to load libraries')
      }
    } catch {
      setLibraryError('Could not connect to server')
    } finally {
      setLoadingLibraries(false)
    }
  }

  const syncLibrariesFromServer = async () => {
    setSyncingLibraries(true)
    setLibraryError(null)
    try {
      const response = await fetch('/api/settings/libraries/sync', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        await fetchLibraries()
      } else {
        const data = await response.json()
        setLibraryError(data.error || 'Sync failed')
      }
    } catch {
      setLibraryError('Could not connect to server')
    } finally {
      setSyncingLibraries(false)
    }
  }

  const toggleLibraryEnabled = async (libraryId: string, enabled: boolean) => {
    setUpdatingLibrary(libraryId)
    try {
      const response = await fetch(`/api/settings/libraries/${libraryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isEnabled: enabled }),
      })
      if (response.ok) {
        setLibraries((prev) =>
          prev.map((lib) =>
            lib.id === libraryId ? { ...lib, isEnabled: enabled } : lib
          )
        )
      }
    } catch {
      // Silently fail
    } finally {
      setUpdatingLibrary(null)
    }
  }

  return (
    <Box>
      {/* File Locations */}
      <DomainSection
        title="File Locations"
        description="Configure where Aperture outputs recommendation libraries"
        icon={<FolderIcon />}
      >
        <FileLocationsSection />
      </DomainSection>

      {/* Movies Section */}
      <DomainSection
        id="movies"
        title="Movies"
        description="Sync your movie library and generate embeddings for AI recommendations"
        icon={<MovieIcon />}
        jobPanels={
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6} lg={4}>
                <InlineJobPanel jobName="sync-movies" />
              </Grid>
              <Grid item xs={12} md={6} lg={4}>
                <InlineJobPanel jobName="sync-movie-watch-history" />
              </Grid>
              <Grid item xs={12} md={6} lg={4}>
                <InlineJobPanel jobName="full-sync-movie-watch-history" />
              </Grid>
              <Grid item xs={12} md={6} lg={4}>
                <InlineJobPanel jobName="generate-movie-embeddings" />
              </Grid>
            </Grid>
          </Stack>
        }
      >
        <LibraryConfigSection
          libraries={libraries.filter((l) => l.collectionType === 'movies')}
          loadingLibraries={loadingLibraries}
          syncingLibraries={syncingLibraries}
          libraryError={libraryError}
          updatingLibrary={updatingLibrary}
          onSync={syncLibrariesFromServer}
          onToggle={toggleLibraryEnabled}
        />
      </DomainSection>

      {/* Series Section */}
      <DomainSection
        id="series"
        title="TV Series"
        description="Sync your TV series library and generate embeddings for AI recommendations"
        icon={<TvIcon />}
        jobPanels={
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6} lg={4}>
                <InlineJobPanel jobName="sync-series" />
              </Grid>
              <Grid item xs={12} md={6} lg={4}>
                <InlineJobPanel jobName="sync-series-watch-history" />
              </Grid>
              <Grid item xs={12} md={6} lg={4}>
                <InlineJobPanel jobName="full-sync-series-watch-history" />
              </Grid>
              <Grid item xs={12} md={6} lg={4}>
                <InlineJobPanel jobName="generate-series-embeddings" />
              </Grid>
            </Grid>
          </Stack>
        }
      >
        <LibraryConfigSection
          libraries={libraries.filter((l) => l.collectionType === 'tvshows')}
          loadingLibraries={loadingLibraries}
          syncingLibraries={syncingLibraries}
          libraryError={libraryError}
          updatingLibrary={updatingLibrary}
          onSync={syncLibrariesFromServer}
          onToggle={toggleLibraryEnabled}
        />
      </DomainSection>
    </Box>
  )
}

