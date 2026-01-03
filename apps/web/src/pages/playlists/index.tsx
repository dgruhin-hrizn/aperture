import {
  Box,
  Typography,
  Grid,
  Button,
  Skeleton,
  Alert,
  Snackbar,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { usePlaylistsData } from './hooks'
import { PlaylistCard, PlaylistDialog, PlaylistViewDialog, EmptyState } from './components'

export function PlaylistsPage() {
  const {
    // Data
    channels,
    loading,
    error,
    availableGenres,
    loadingGenres,
    formData,
    setFormData,
    editingChannel,
    generatingChannelId,
    snackbar,
    setSnackbar,
    // Dialog state
    dialogOpen,
    playlistDialogOpen,
    viewingChannel,
    playlistItems,
    loadingPlaylist,
    removingItemId,
    addingMovieId,
    // Actions
    handleOpenDialog,
    handleCloseDialog,
    handleSubmit,
    handleDelete,
    handleGeneratePlaylist,
    addExampleMovie,
    removeExampleMovie,
    handleViewPlaylist,
    handleClosePlaylistDialog,
    handleRemoveFromPlaylist,
    handleAddToPlaylist,
  } = usePlaylistsData()

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={700} mb={4}>
          Playlists
        </Typography>
        <Grid container spacing={3}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight={700} mb={1}>
            Playlists
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create custom recommendation playlists with genres and example movies
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          New Playlist
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {channels.length === 0 ? (
        <EmptyState onCreateClick={() => handleOpenDialog()} />
      ) : (
        <Grid container spacing={3}>
          {channels.map((channel) => (
            <Grid item xs={12} sm={6} md={4} key={channel.id}>
              <PlaylistCard
                channel={channel}
                generatingChannelId={generatingChannelId}
                onEdit={handleOpenDialog}
                onDelete={handleDelete}
                onGenerate={handleGeneratePlaylist}
                onView={handleViewPlaylist}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create/Edit Dialog */}
      <PlaylistDialog
        open={dialogOpen}
        editingChannel={editingChannel}
        formData={formData}
        setFormData={setFormData}
        availableGenres={availableGenres}
        loadingGenres={loadingGenres}
        setSnackbar={setSnackbar}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        onAddExampleMovie={addExampleMovie}
        onRemoveExampleMovie={removeExampleMovie}
      />

      {/* Playlist View/Edit Dialog */}
      <PlaylistViewDialog
        open={playlistDialogOpen}
        channel={viewingChannel}
        playlistItems={playlistItems}
        loadingPlaylist={loadingPlaylist}
        removingItemId={removingItemId}
        addingMovieId={addingMovieId}
        onClose={handleClosePlaylistDialog}
        onRemoveItem={handleRemoveFromPlaylist}
        onAddMovie={handleAddToPlaylist}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

