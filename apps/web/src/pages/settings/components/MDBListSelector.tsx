import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  TextField,
  Autocomplete,
  CircularProgress,
  Chip,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  InputAdornment,
  IconButton,
  Tooltip,
  Alert,
  Divider,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import PersonIcon from '@mui/icons-material/Person'
import LinkIcon from '@mui/icons-material/Link'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import PeopleIcon from '@mui/icons-material/People'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

interface MDBListOption {
  id: number
  name: string
  itemCount?: number
  likes?: number
  user_name?: string
}

interface MDBListSelectorProps {
  value: { id: number; name: string } | null
  onChange: (value: { id: number; name: string } | null) => void
  mediatype: 'movie' | 'show'
  label: string
  disabled?: boolean
  helperText?: string
}

export function MDBListSelector({
  value,
  onChange,
  mediatype,
  label,
  disabled = false,
  helperText,
}: MDBListSelectorProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [popularLists, setPopularLists] = useState<MDBListOption[]>([])
  const [myLists, setMyLists] = useState<MDBListOption[]>([])
  const [searchResults, setSearchResults] = useState<MDBListOption[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [manualId, setManualId] = useState('')
  const [loadingPopular, setLoadingPopular] = useState(false)
  const [loadingMine, setLoadingMine] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [loadingManual, setLoadingManual] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  // Fetch popular lists
  const fetchPopularLists = useCallback(async () => {
    setLoadingPopular(true)
    try {
      const response = await fetch(`/api/mdblist/lists/top?mediatype=${mediatype}&limit=50`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setPopularLists(
          data.lists?.map((l: { id: number; name: string; items?: number; likes?: number; user_name?: string }) => ({
            id: l.id,
            name: l.name,
            itemCount: l.items,
            likes: l.likes,
            user_name: l.user_name,
          })) || []
        )
      }
    } catch (err) {
      console.error('Failed to fetch popular lists', err)
    } finally {
      setLoadingPopular(false)
    }
  }, [mediatype])

  // Fetch user's own lists
  const fetchMyLists = useCallback(async () => {
    setLoadingMine(true)
    try {
      const response = await fetch(`/api/mdblist/lists/mine?mediatype=${mediatype}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setMyLists(
          data.lists?.map((l: { id: number; name: string; items?: number; likes?: number }) => ({
            id: l.id,
            name: l.name,
            itemCount: l.items,
            likes: l.likes,
          })) || []
        )
      }
    } catch (err) {
      console.error('Failed to fetch my lists', err)
    } finally {
      setLoadingMine(false)
    }
  }, [mediatype])

  // Search lists
  const searchLists = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }
    setLoadingSearch(true)
    try {
      const response = await fetch(
        `/api/mdblist/lists/search?q=${encodeURIComponent(query)}&mediatype=${mediatype}`,
        { credentials: 'include' }
      )
      if (response.ok) {
        const data = await response.json()
        setSearchResults(
          data.lists?.map((l: { id: number; name: string; items?: number; likes?: number; user_name?: string }) => ({
            id: l.id,
            name: l.name,
            itemCount: l.items,
            likes: l.likes,
            user_name: l.user_name,
          })) || []
        )
      }
    } catch (err) {
      console.error('Failed to search lists', err)
    } finally {
      setLoadingSearch(false)
    }
  }, [mediatype])

  // Lookup list by ID
  const lookupListById = useCallback(async (idStr: string) => {
    // Extract ID from URL if pasted
    let listId: number
    const urlMatch = idStr.match(/mdblist\.com\/lists\/(\d+)/)
    if (urlMatch) {
      listId = parseInt(urlMatch[1], 10)
    } else {
      listId = parseInt(idStr.replace(/\D/g, ''), 10)
    }

    if (isNaN(listId) || listId <= 0) {
      setManualError('Please enter a valid list ID or MDBList URL')
      return
    }

    setLoadingManual(true)
    setManualError(null)
    try {
      const response = await fetch(`/api/mdblist/lists/${listId}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        if (data.list) {
          onChange({ id: data.list.id, name: data.list.name })
          setManualId('')
          setIsOpen(false)
        } else {
          setManualError('List not found')
        }
      } else {
        setManualError('List not found')
      }
    } catch (err) {
      setManualError('Failed to lookup list')
    } finally {
      setLoadingManual(false)
    }
  }, [onChange])

  // Load data when opened
  useEffect(() => {
    if (isOpen) {
      fetchPopularLists()
      fetchMyLists()
    }
  }, [isOpen, fetchPopularLists, fetchMyLists])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchLists(searchQuery)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchLists])

  const handleSelect = (list: MDBListOption) => {
    onChange({ id: list.id, name: list.name })
    setIsOpen(false)
  }

  const renderListItem = (list: MDBListOption, isSelected: boolean) => (
    <ListItem key={list.id} disablePadding>
      <ListItemButton
        selected={isSelected}
        onClick={() => handleSelect(list)}
        sx={{ borderRadius: 1 }}
      >
        <ListItemText
          primary={
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
                {list.name}
              </Typography>
              {isSelected && <CheckCircleIcon fontSize="small" color="success" />}
            </Box>
          }
          secondary={
            <Box display="flex" alignItems="center" gap={2} mt={0.5}>
              {list.user_name && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <PersonIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.secondary">
                    {list.user_name}
                  </Typography>
                </Box>
              )}
              {list.itemCount !== undefined && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <FormatListNumberedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.secondary">
                    {list.itemCount} items
                  </Typography>
                </Box>
              )}
              {list.likes !== undefined && list.likes > 0 && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <PeopleIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.secondary">
                    {list.likes} likes
                  </Typography>
                </Box>
              )}
            </Box>
          }
        />
        <ListItemSecondaryAction>
          <Tooltip title="View on MDBList">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                window.open(`https://mdblist.com/lists/${list.id}`, '_blank')
              }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </ListItemSecondaryAction>
      </ListItemButton>
    </ListItem>
  )

  const currentLists = activeTab === 0 ? popularLists : activeTab === 1 ? myLists : searchResults
  const isLoading = activeTab === 0 ? loadingPopular : activeTab === 1 ? loadingMine : loadingSearch

  return (
    <Box>
      {/* Selected value display */}
      <TextField
        fullWidth
        label={label}
        value={value?.name || ''}
        onClick={() => !disabled && setIsOpen(true)}
        placeholder="Click to select a list..."
        size="small"
        disabled={disabled}
        helperText={helperText}
        InputProps={{
          readOnly: true,
          endAdornment: value && (
            <InputAdornment position="end">
              <Chip
                label={`ID: ${value.id}`}
                size="small"
                onDelete={() => onChange(null)}
                disabled={disabled}
              />
            </InputAdornment>
          ),
        }}
        sx={{ cursor: disabled ? 'default' : 'pointer' }}
      />

      {/* Selection dialog/dropdown */}
      {isOpen && (
        <Paper
          elevation={8}
          sx={{
            position: 'absolute',
            zIndex: 1300,
            width: '100%',
            maxWidth: 600,
            maxHeight: 500,
            overflow: 'hidden',
            mt: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Tabs */}
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
          >
            <Tab
              icon={<TrendingUpIcon fontSize="small" />}
              iconPosition="start"
              label="Popular"
              sx={{ minHeight: 48 }}
            />
            <Tab
              icon={<PersonIcon fontSize="small" />}
              iconPosition="start"
              label="My Lists"
              sx={{ minHeight: 48 }}
            />
            <Tab
              icon={<SearchIcon fontSize="small" />}
              iconPosition="start"
              label="Search"
              sx={{ minHeight: 48 }}
            />
            <Tab
              icon={<LinkIcon fontSize="small" />}
              iconPosition="start"
              label="By ID"
              sx={{ minHeight: 48 }}
            />
          </Tabs>

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {/* Search Tab */}
            {activeTab === 2 && (
              <TextField
                fullWidth
                placeholder="Search MDBList..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                autoFocus
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
            )}

            {/* Manual ID Tab */}
            {activeTab === 3 && (
              <Box>
                <TextField
                  fullWidth
                  placeholder="Enter list ID or paste MDBList URL..."
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  size="small"
                  autoFocus
                  error={!!manualError}
                  helperText={manualError || 'e.g., 12345 or https://mdblist.com/lists/12345'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualId) {
                      lookupListById(manualId)
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LinkIcon fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: loadingManual ? (
                      <CircularProgress size={20} />
                    ) : (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => lookupListById(manualId)}
                          disabled={!manualId}
                        >
                          <CheckCircleIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ mb: 2 }}
                />
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="caption">
                    Find any list on{' '}
                    <a href="https://mdblist.com/toplists/" target="_blank" rel="noopener noreferrer">
                      mdblist.com/toplists
                    </a>{' '}
                    and paste the URL or ID here.
                  </Typography>
                </Alert>
              </Box>
            )}

            {/* Lists for tabs 0, 1, 2 */}
            {activeTab !== 3 && (
              <>
                {isLoading ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress size={24} />
                  </Box>
                ) : currentLists.length === 0 ? (
                  <Box textAlign="center" py={4}>
                    <Typography variant="body2" color="text.secondary">
                      {activeTab === 1
                        ? "You don't have any lists on MDBList"
                        : activeTab === 2 && searchQuery.length < 2
                        ? 'Type at least 2 characters to search'
                        : 'No lists found'}
                    </Typography>
                  </Box>
                ) : (
                  <List dense sx={{ py: 0 }}>
                    {currentLists.map((list) =>
                      renderListItem(list, value?.id === list.id)
                    )}
                  </List>
                )}
              </>
            )}
          </Box>

          {/* Footer */}
          <Box
            sx={{
              borderTop: 1,
              borderColor: 'divider',
              p: 1,
              display: 'flex',
              justifyContent: 'flex-end',
              flexShrink: 0,
            }}
          >
            <Chip
              label="Close"
              onClick={() => setIsOpen(false)}
              size="small"
              variant="outlined"
            />
          </Box>
        </Paper>
      )}
    </Box>
  )
}

