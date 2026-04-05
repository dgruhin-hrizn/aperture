import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Menu,
  MenuItem,
  TextField,
  Typography,
  Divider,
  alpha,
  useTheme,
  Tooltip,
  Chip,
} from '@mui/material'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import type { MovieFilters, SeriesFilters, WatchStatusFilter } from './FilterPopper'

export interface FilterPreset {
  id: string
  name: string
  type: 'movies' | 'series'
  filters: {
    yearRange?: [number, number]
    runtimeRange?: [number, number]
    seasonsRange?: [number, number]
    communityRating?: [number, number]
    rtScore?: [number, number]
    metacritic?: [number, number]
    contentRatings?: string[]
    resolutions?: string[]
    status?: string[]
    countries?: string[]
    watchStatus?: WatchStatusFilter
    minWatchers?: number | null
    maxWatchers?: number | null
    genre?: string
    collection?: string
    network?: string
  }
  createdAt: string
}

interface FilterPresetManagerProps {
  type: 'movies' | 'series'
  currentFilters: MovieFilters | SeriesFilters
  currentGenre: string
  currentCollection?: string
  currentNetwork?: string
  presets: FilterPreset[]
  onLoadPreset: (preset: FilterPreset) => void
  onSavePreset: (name: string) => Promise<void>
  onDeletePreset: (id: string) => Promise<void>
  onRenamePreset: (id: string, newName: string) => Promise<void>
}

export function FilterPresetManager({
  type,
  currentFilters,
  currentGenre,
  currentCollection,
  currentNetwork,
  presets,
  onLoadPreset,
  onSavePreset,
  onDeletePreset,
  onRenamePreset,
}: FilterPresetManagerProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [manageDialogOpen, setManageDialogOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [editingPreset, setEditingPreset] = useState<FilterPreset | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; preset: FilterPreset } | null>(null)
  const [saving, setSaving] = useState(false)

  const filteredPresets = presets.filter((p) => p.type === type)
  const open = Boolean(anchorEl)

  const hasActiveFilters = () => {
    if (currentGenre || currentCollection || currentNetwork) return true
    if (type === 'movies') {
      const f = currentFilters as MovieFilters
      return (
        f.communityRating[0] > 0 ||
        f.rtScore[0] > 0 ||
        f.metacritic[0] > 0 ||
        f.contentRatings.length > 0 ||
        f.resolutions.length > 0 ||
        f.countries.length > 0 ||
        f.watchStatus !== 'any' ||
        f.minWatchers !== null ||
        f.maxWatchers !== null
      )
    } else {
      const f = currentFilters as SeriesFilters
      return (
        f.communityRating[0] > 0 ||
        f.rtScore[0] > 0 ||
        f.metacritic[0] > 0 ||
        f.contentRatings.length > 0 ||
        f.status.length > 0 ||
        f.countries.length > 0 ||
        f.watchStatus !== 'any' ||
        f.minWatchers !== null ||
        f.maxWatchers !== null
      )
    }
  }

  const handleSave = async () => {
    if (!presetName.trim()) return
    setSaving(true)
    try {
      await onSavePreset(presetName.trim())
      setPresetName('')
      setSaveDialogOpen(false)
      setAnchorEl(null)
    } finally {
      setSaving(false)
    }
  }

  const handleRename = async () => {
    if (!editingPreset || !presetName.trim()) return
    setSaving(true)
    try {
      await onRenamePreset(editingPreset.id, presetName.trim())
      setEditingPreset(null)
      setPresetName('')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await onDeletePreset(id)
    setMenuAnchor(null)
  }

  return (
    <>
      <Tooltip title={t('filterPresets.tooltip')}>
        <Button
          variant="outlined"
          startIcon={filteredPresets.length > 0 ? <BookmarkIcon /> : <BookmarkBorderIcon />}
          onClick={(e) => setAnchorEl(anchorEl ? null : e.currentTarget)}
          size="small"
          sx={{
            height: 40,
            px: 1.75,
            borderColor: open ? 'primary.main' : alpha(theme.palette.text.primary, 0.23),
            color: open ? 'primary.main' : 'text.primary',
            backgroundColor: open ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
            textTransform: 'none',
            fontWeight: 400,
            minWidth: 'auto',
            '&:hover': {
              borderColor: open ? 'primary.main' : 'text.primary',
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
            },
          }}
        >
          {t('filterPresets.presets')}
          {filteredPresets.length > 0 && (
            <Chip
              label={filteredPresets.length}
              size="small"
              sx={{
                ml: 1,
                height: 20,
                fontSize: '0.7rem',
                backgroundColor: alpha(theme.palette.primary.main, 0.15),
                color: 'primary.main',
              }}
            />
          )}
        </Button>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { width: 280, mt: 1, borderRadius: 2 },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {t('filterPresets.menuTitle')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('filterPresets.menuSubtitle')}
          </Typography>
        </Box>
        <Divider />

        {filteredPresets.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t('filterPresets.noPresetsYet')}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 240, overflow: 'auto' }}>
            {filteredPresets.map((preset) => (
              <MenuItem
                key={preset.id}
                onClick={() => {
                  onLoadPreset(preset)
                  setAnchorEl(null)
                }}
                sx={{ py: 1.5 }}
              >
                <ListItemText
                  primary={preset.name}
                  secondary={new Date(preset.createdAt).toLocaleDateString()}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuAnchor({ el: e.currentTarget, preset })
                  }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </MenuItem>
            ))}
          </Box>
        )}

        <Divider />
        <Box sx={{ p: 1 }}>
          <Button
            fullWidth
            startIcon={<AddIcon />}
            onClick={() => {
              setSaveDialogOpen(true)
              setAnchorEl(null)
            }}
            disabled={!hasActiveFilters()}
            size="small"
            sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
          >
            {t('filterPresets.saveCurrent')}
          </Button>
          {filteredPresets.length > 0 && (
            <Button
              fullWidth
              startIcon={<EditIcon />}
              onClick={() => {
                setManageDialogOpen(true)
                setAnchorEl(null)
              }}
              size="small"
              sx={{ justifyContent: 'flex-start', textTransform: 'none', mt: 0.5 }}
            >
              {t('filterPresets.manage')}
            </Button>
          )}
        </Box>
      </Menu>

      {/* Preset item menu */}
      <Menu
        anchorEl={menuAnchor?.el}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              setEditingPreset(menuAnchor.preset)
              setPresetName(menuAnchor.preset.name)
              setMenuAnchor(null)
            }
          }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          {t('filterPresets.rename')}
        </MenuItem>
        <MenuItem
          onClick={() => menuAnchor && handleDelete(menuAnchor.preset.id)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          {t('filterPresets.delete')}
        </MenuItem>
      </Menu>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('filterPresets.saveDialogTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t('filterPresets.presetNameLabel')}
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder={t('filterPresets.presetNamePlaceholder')}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>{t('filterPresets.cancel')}</Button>
          <Button onClick={handleSave} variant="contained" disabled={!presetName.trim() || saving}>
            {t('filterPresets.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={Boolean(editingPreset)} onClose={() => setEditingPreset(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('filterPresets.renameDialogTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t('filterPresets.newNameLabel')}
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingPreset(null)}>{t('filterPresets.cancel')}</Button>
          <Button onClick={handleRename} variant="contained" disabled={!presetName.trim() || saving}>
            {t('filterPresets.rename')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Dialog */}
      <Dialog open={manageDialogOpen} onClose={() => setManageDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('filterPresets.manageDialogTitle')}</DialogTitle>
        <DialogContent dividers>
          {filteredPresets.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              {t('filterPresets.noPresetsManage')}
            </Typography>
          ) : (
            <List disablePadding>
              {filteredPresets.map((preset, i) => (
                <Box key={preset.id}>
                  {i > 0 && <Divider />}
                  <ListItem sx={{ py: 2 }}>
                    <ListItemText
                      primary={preset.name}
                      secondary={t('filterPresets.createdLine', {
                        date: new Date(preset.createdAt).toLocaleDateString(),
                      })}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setEditingPreset(preset)
                          setPresetName(preset.name)
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(preset.id)}
                        sx={{ color: 'error.main', ml: 1 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </Box>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManageDialogOpen(false)}>{t('filterPresets.close')}</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
