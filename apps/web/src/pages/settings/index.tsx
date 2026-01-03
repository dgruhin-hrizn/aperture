import { Box, Typography, Grid } from '@mui/material'
import { useAuth } from '@/hooks/useAuth'
import { useSettingsData } from './hooks'
import {
  LibraryConfigSection,
  RecommendationConfigSection,
  EmbeddingsSection,
  DatabaseSection,
  PersonalPreferencesSection,
  ProfileSection,
  MediaServerSection,
  StrmSection,
} from './components'

export function SettingsPage() {
  const { user } = useAuth()
  const settings = useSettingsData(user?.isAdmin ?? false)

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        Settings
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Configure Aperture
      </Typography>

      <Grid container spacing={3}>
        {/* Library Configuration - Full Width for prominence */}
        {user?.isAdmin && (
          <Grid item xs={12}>
            <LibraryConfigSection
              libraries={settings.libraries}
              loadingLibraries={settings.loadingLibraries}
              syncingLibraries={settings.syncingLibraries}
              libraryError={settings.libraryError}
              updatingLibrary={settings.updatingLibrary}
              onSync={settings.syncLibrariesFromServer}
              onToggle={settings.toggleLibraryEnabled}
            />
          </Grid>
        )}

        {/* Recommendation Algorithm Configuration */}
        {user?.isAdmin && (
          <Grid item xs={12}>
            <RecommendationConfigSection
              recConfig={settings.recConfig}
              loadingRecConfig={settings.loadingRecConfig}
              savingRecConfig={settings.savingRecConfig}
              recConfigError={settings.recConfigError}
              setRecConfigError={settings.setRecConfigError}
              recConfigSuccess={settings.recConfigSuccess}
              setRecConfigSuccess={settings.setRecConfigSuccess}
              recConfigDirty={settings.recConfigDirty}
              onSave={settings.saveRecConfig}
              onReset={settings.resetRecConfig}
              onUpdateField={settings.updateRecConfigField}
            />
          </Grid>
        )}

        {/* Media Server Configuration */}
        <Grid item xs={12} lg={6}>
          <MediaServerSection />
        </Grid>

        {/* AI Embeddings Status */}
        {user?.isAdmin && (
          <Grid item xs={12} lg={6}>
            <EmbeddingsSection
              embeddingConfig={settings.embeddingConfig}
              loadingEmbeddingModel={settings.loadingEmbeddingModel}
            />
          </Grid>
        )}

        {/* STRM Configuration */}
        <Grid item xs={12} lg={6}>
          <StrmSection />
        </Grid>

        {/* Database Management - Admin Only */}
        {user?.isAdmin && (
          <Grid item xs={12} lg={6}>
            <DatabaseSection
              purgeStats={settings.purgeStats}
              loadingPurgeStats={settings.loadingPurgeStats}
              purging={settings.purging}
              purgeError={settings.purgeError}
              setPurgeError={settings.setPurgeError}
              purgeSuccess={settings.purgeSuccess}
              setPurgeSuccess={settings.setPurgeSuccess}
              showPurgeConfirm={settings.showPurgeConfirm}
              setShowPurgeConfirm={settings.setShowPurgeConfirm}
              onPurge={settings.executePurge}
            />
          </Grid>
        )}

        {/* Personal Preferences - Library Name */}
        <Grid item xs={12} lg={6}>
          <PersonalPreferencesSection
            user={user}
            defaultLibraryPrefix={settings.defaultLibraryPrefix}
            loadingUserSettings={settings.loadingUserSettings}
            savingUserSettings={settings.savingUserSettings}
            userSettingsError={settings.userSettingsError}
            setUserSettingsError={settings.setUserSettingsError}
            userSettingsSuccess={settings.userSettingsSuccess}
            setUserSettingsSuccess={settings.setUserSettingsSuccess}
            libraryNameInput={settings.libraryNameInput}
            setLibraryNameInput={settings.setLibraryNameInput}
            onSave={settings.saveUserSettings}
          />
        </Grid>

        {/* Profile */}
        <Grid item xs={12} lg={6}>
          <ProfileSection user={user} />
        </Grid>
      </Grid>
    </Box>
  )
}

