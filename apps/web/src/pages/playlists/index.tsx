import {
  Box,
  Typography,
  Grid,
  Button,
  Skeleton,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import AddIcon from '@mui/icons-material/Add'
import { usePlaylistsData } from './hooks'
import { PlaylistCard, GraphPlaylistCard, PlaylistDialog, PlaylistViewDialog, GraphPlaylistViewDialog, EmptyState } from './components'

export function PlaylistsPage() {
  const { t } = useTranslation()
  const {
    // Data
    channels,
    graphPlaylists,
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
    // Graph playlist dialog state
    graphPlaylistDialogOpen,
    viewingGraphPlaylist,
    graphPlaylistItems,
    loadingGraphPlaylist,
    // Delete confirmation dialog state
    deleteDialogOpen,
    deletingPlaylist,
    deleteLoading,
    // Actions
    handleOpenDialog,
    handleCloseDialog,
    handleSubmit,
    handleDelete,
    handleDeleteGraphPlaylist,
    handleDeleteCancel,
    handleDeleteConfirm,
    handleGeneratePlaylist,
    addExampleMovie,
    removeExampleMovie,
    handleViewPlaylist,
    handleClosePlaylistDialog,
    handleRemoveFromPlaylist,
    handleAddToPlaylist,
    handleViewGraphPlaylist,
    handleCloseGraphPlaylistDialog,
  } = usePlaylistsData()

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={700} mb={4}>
          {t('playlists.pageTitle')}
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
      <Box 
        display="flex" 
        flexDirection={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between" 
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={{ xs: 2, sm: 0 }}
        mb={4}
      >
        <Box>
          <Typography variant="h4" fontWeight={700} mb={1}>
            {t('playlists.pageTitle')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('playlists.pageSubtitle')}
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => handleOpenDialog()}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
        >
          {t('playlists.newPlaylist')}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {channels.length === 0 && graphPlaylists.length === 0 ? (
        <EmptyState onCreateClick={() => handleOpenDialog()} />
      ) : (
        <Grid container spacing={3}>
          {/* Channel-based playlists */}
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
          {/* Graph-based playlists */}
          {graphPlaylists.map((playlist) => (
            <Grid item xs={12} sm={6} md={4} key={`graph-${playlist.id}`}>
              <GraphPlaylistCard
                playlist={playlist}
                onDelete={handleDeleteGraphPlaylist}
                onView={handleViewGraphPlaylist}
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

      {/* Graph Playlist View Dialog */}
      <GraphPlaylistViewDialog
        open={graphPlaylistDialogOpen}
        playlist={viewingGraphPlaylist}
        items={graphPlaylistItems}
        loading={loadingGraphPlaylist}
        onClose={handleCloseGraphPlaylistDialog}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('playlists.deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('playlists.deleteConfirm', { name: deletingPlaylist?.name ?? '' })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {deleteLoading ? t('playlists.deleting') : t('playlists.delete')}
          </Button>
        </DialogActions>
      </Dialog>

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



