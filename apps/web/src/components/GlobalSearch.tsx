import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Dialog,
  DialogContent,
  TextField,
  InputAdornment,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  CircularProgress,
  IconButton,
  alpha,
  useTheme,
  Tooltip,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import CloseIcon from '@mui/icons-material/Close'
import { getProxiedImageUrl } from '@aperture/ui'

interface SearchResult {
  id: string
  type: 'movie' | 'series'
  title: string
  year: number | null
  genres: string[]
  poster_url: string | null
  community_rating: number | null
  rt_critic_score: number | null
  collection_name: string | null
  network: string | null
  combined_score: number
}

interface SearchSuggestion {
  title: string
  type: 'movie' | 'series'
  year: number | null
  label: string
}

export function GlobalSearch() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Handle keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape' && open) {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleClose = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
    setSuggestions([])
    setSelectedIndex(0)
  }, [])

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([])
      setSuggestions([])
      return
    }

    setLoading(true)

    try {
      // Fetch suggestions for autocomplete
      const suggestionsRes = await fetch(
        `/api/search/suggestions?q=${encodeURIComponent(searchQuery)}&limit=5`,
        { credentials: 'include' }
      )
      if (suggestionsRes.ok) {
        const data = await suggestionsRes.json()
        setSuggestions(data.suggestions)
      }

      // Fetch full results
      const resultsRes = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&limit=10`,
        { credentials: 'include' }
      )
      if (resultsRes.ok) {
        const data = await resultsRes.json()
        setResults(data.results)
        setSelectedIndex(0)
      }
    } catch {
      // Ignore search errors
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      handleSearch(query)
    }, 200)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, handleSearch])

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      navigate(`/${result.type === 'movie' ? 'movies' : 'series'}/${result.id}`)
      handleClose()
    },
    [navigate, handleClose]
  )

  const handleKeyboardNav = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault()
        handleResultClick(results[selectedIndex])
      }
    },
    [results, selectedIndex, handleResultClick]
  )

  const handleViewAllResults = () => {
    navigate(`/search?q=${encodeURIComponent(query)}`)
    handleClose()
  }

  return (
    <>
      {/* Search trigger button in header */}
      <Tooltip title="Search (⌘K)">
        <Box
          onClick={() => setOpen(true)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            mr: 2,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.common.white, 0.1),
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            '&:hover': {
              bgcolor: alpha(theme.palette.common.white, 0.15),
            },
          }}
        >
          <SearchIcon sx={{ fontSize: 20, opacity: 0.7 }} />
          <Typography
            variant="body2"
            sx={{ opacity: 0.7, display: { xs: 'none', sm: 'block' } }}
          >
            Search...
          </Typography>
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 0.5,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.common.white, 0.15),
            }}
          >
            <KeyboardIcon sx={{ fontSize: 14, opacity: 0.6 }} />
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              K
            </Typography>
          </Box>
        </Box>
      </Tooltip>

      {/* Search Dialog */}
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '80vh',
          },
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          {/* Search Input */}
          <Box
            sx={{
              p: 2,
              borderBottom: 1,
              borderColor: 'divider',
              position: 'sticky',
              top: 0,
              bgcolor: 'background.paper',
              zIndex: 1,
            }}
          >
            <TextField
              inputRef={inputRef}
              fullWidth
              placeholder="Search movies, series, actors, directors..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyboardNav}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {loading ? (
                      <CircularProgress size={20} />
                    ) : (
                      <SearchIcon />
                    )}
                  </InputAdornment>
                ),
                endAdornment: query && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setQuery('')}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />
          </Box>

          {/* Results */}
          <Box sx={{ maxHeight: 'calc(80vh - 120px)', overflowY: 'auto' }}>
            {!query && (
              <Box p={4} textAlign="center">
                <Typography color="text.secondary">
                  Start typing to search your library
                </Typography>
                <Typography variant="caption" color="text.disabled" display="block" mt={1}>
                  Search by title, actor, director, genre, or keyword
                </Typography>
              </Box>
            )}

            {query && results.length === 0 && !loading && (
              <Box p={4} textAlign="center">
                <Typography color="text.secondary">
                  No results found for "{query}"
                </Typography>
              </Box>
            )}

            {results.length > 0 && (
              <>
                <List sx={{ py: 0 }}>
                  {results.map((result, index) => (
                    <ListItem
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: index === selectedIndex ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                        },
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar
                          variant="rounded"
                          src={getProxiedImageUrl(result.poster_url)}
                          sx={{ width: 48, height: 72, borderRadius: 1 }}
                        >
                          {result.type === 'movie' ? <MovieIcon /> : <TvIcon />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        sx={{ ml: 1 }}
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle1" fontWeight={500}>
                              {result.title}
                            </Typography>
                            {result.year && (
                              <Typography variant="body2" color="text.secondary">
                                ({result.year})
                              </Typography>
                            )}
                            <Chip
                              size="small"
                              label={result.type === 'movie' ? 'Movie' : 'Series'}
                              sx={{ fontSize: '0.65rem', height: 20 }}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            {result.genres && result.genres.length > 0 && (
                              <Typography variant="caption" color="text.secondary">
                                {result.genres.slice(0, 3).join(' • ')}
                              </Typography>
                            )}
                            <Box display="flex" gap={1} mt={0.5}>
                              {result.rt_critic_score && (
                                <Chip
                                  size="small"
                                  label={`🍅 ${result.rt_critic_score}%`}
                                  sx={{ 
                                    fontSize: '0.65rem', 
                                    height: 18,
                                    bgcolor: Number(result.rt_critic_score) >= 60 ? 'success.dark' : 'warning.dark',
                                  }}
                                />
                              )}
                              {result.community_rating != null && (
                                <Chip
                                  size="small"
                                  label={`⭐ ${Number(result.community_rating).toFixed(1)}`}
                                  sx={{ fontSize: '0.65rem', height: 18 }}
                                />
                              )}
                              {result.collection_name && (
                                <Chip
                                  size="small"
                                  label={result.collection_name}
                                  variant="outlined"
                                  sx={{ fontSize: '0.65rem', height: 18 }}
                                />
                              )}
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>

                {/* View all results link */}
                <Box
                  sx={{
                    p: 2,
                    borderTop: 1,
                    borderColor: 'divider',
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                  onClick={handleViewAllResults}
                >
                  <Typography variant="body2" color="primary">
                    View all results for "{query}" →
                  </Typography>
                </Box>
              </>
            )}
          </Box>

          {/* Keyboard shortcuts hint */}
          <Box
            sx={{
              p: 1.5,
              borderTop: 1,
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'center',
              gap: 3,
            }}
          >
            <Box display="flex" alignItems="center" gap={0.5}>
              <Chip size="small" label="↑↓" sx={{ fontSize: '0.65rem', height: 20 }} />
              <Typography variant="caption" color="text.secondary">
                Navigate
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Chip size="small" label="↵" sx={{ fontSize: '0.65rem', height: 20 }} />
              <Typography variant="caption" color="text.secondary">
                Select
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Chip size="small" label="Esc" sx={{ fontSize: '0.65rem', height: 20 }} />
              <Typography variant="caption" color="text.secondary">
                Close
              </Typography>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  )
}

