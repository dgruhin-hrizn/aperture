import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Pagination,
  CircularProgress,
  Alert,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import MovieIcon from '@mui/icons-material/Movie'
import TvIcon from '@mui/icons-material/Tv'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import { MoviePoster } from '@aperture/ui'
import { useUserRatings } from '../hooks/useUserRatings'

interface ContentItem {
  id: string
  type: 'movie' | 'series'
  title: string
  year: number | null
  genres: string[]
  overview: string | null
  poster_url: string | null
  community_rating: number | null
  rt_critic_score: number | null
  awards_summary: string | null
}

type AwardFilter = 'all' | 'oscar' | 'emmy' | 'golden_globe' | 'bafta'

export function AwardsPage() {
  const navigate = useNavigate()
  const { getRating, setRating } = useUserRatings()
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'all' | 'movie' | 'series'>('all')
  const [awardFilter, setAwardFilter] = useState<AwardFilter>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 24

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        hasAwards: 'true',
      })
      if (search) params.set('search', search)
      if (awardFilter !== 'all') params.set('awardType', awardFilter)

      const results: ContentItem[] = []
      let totalCount = 0

      // Fetch movies if needed
      if (type === 'all' || type === 'movie') {
        const movieRes = await fetch(`/api/movies?${params}`, { credentials: 'include' })
        if (movieRes.ok) {
          const data = await movieRes.json()
          // Filter to only items with awards
          const moviesWithAwards = data.movies
            .filter((m: { awards_summary?: string }) => m.awards_summary)
            .map((m: ContentItem) => ({ ...m, type: 'movie' as const }))
          results.push(...moviesWithAwards)
          totalCount += moviesWithAwards.length
        }
      }

      // Fetch series if needed
      if (type === 'all' || type === 'series') {
        const seriesRes = await fetch(`/api/series?${params}`, { credentials: 'include' })
        if (seriesRes.ok) {
          const data = await seriesRes.json()
          // Filter to only items with awards
          const seriesWithAwards = data.series
            .filter((s: { awards_summary?: string }) => s.awards_summary)
            .map((s: ContentItem) => ({ ...s, type: 'series' as const }))
          results.push(...seriesWithAwards)
          totalCount += seriesWithAwards.length
        }
      }

      // Filter by award type if specified
      let filteredResults = results
      if (awardFilter !== 'all') {
        const filterMap: Record<AwardFilter, RegExp> = {
          all: /.*/,
          oscar: /oscar|academy award/i,
          emmy: /emmy/i,
          golden_globe: /golden globe/i,
          bafta: /bafta/i,
        }
        filteredResults = results.filter(
          (item) => item.awards_summary && filterMap[awardFilter].test(item.awards_summary)
        )
      }

      // Sort by awards and rating
      filteredResults.sort((a, b) => {
        // Prioritize items with Oscar/Emmy wins
        const aHasWin = a.awards_summary?.toLowerCase().includes('won') ? 1 : 0
        const bHasWin = b.awards_summary?.toLowerCase().includes('won') ? 1 : 0
        if (aHasWin !== bHasWin) return bHasWin - aHasWin

        // Then by RT score
        const aScore = a.rt_critic_score || 0
        const bScore = b.rt_critic_score || 0
        return bScore - aScore
      })

      // Paginate
      const startIdx = 0
      const endIdx = pageSize
      const pageItems = filteredResults.slice(startIdx, endIdx)

      setItems(pageItems)
      setTotalPages(Math.ceil(filteredResults.length / pageSize))
      setError(null)
    } catch {
      setError('Could not load award-winning content')
    } finally {
      setLoading(false)
    }
  }, [type, awardFilter, search, page])

  useEffect(() => {
    const debounce = setTimeout(fetchItems, search ? 300 : 0)
    return () => clearTimeout(debounce)
  }, [fetchItems])

  const handleRate = useCallback(
    async (itemId: string, itemType: 'movie' | 'series', rating: number | null) => {
      try {
        await setRating(itemType, itemId, rating)
      } catch (err) {
        console.error('Failed to rate:', err)
      }
    },
    [setRating]
  )

  const parseAwardHighlights = (summary: string | null): string[] => {
    if (!summary) return []
    const highlights: string[] = []

    // Extract notable awards
    if (/won \d+ oscar/i.test(summary)) {
      const match = summary.match(/won (\d+) oscar/i)
      if (match) highlights.push(`🏆 ${match[1]} Oscar${parseInt(match[1]) > 1 ? 's' : ''}`)
    }
    if (/won \d+ emmy/i.test(summary)) {
      const match = summary.match(/won (\d+) emmy/i)
      if (match) highlights.push(`📺 ${match[1]} Emmy${parseInt(match[1]) > 1 ? 's' : ''}`)
    }
    if (/won \d+ golden globe/i.test(summary)) {
      const match = summary.match(/won (\d+) golden globe/i)
      if (match) highlights.push(`🌟 ${match[1]} Golden Globe${parseInt(match[1]) > 1 ? 's' : ''}`)
    }
    if (/nominated/i.test(summary) && highlights.length === 0) {
      highlights.push('🎭 Nominated')
    }

    return highlights.slice(0, 3)
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={1}>
        <EmojiEventsIcon sx={{ fontSize: 32, color: 'warning.main' }} />
        <Typography variant="h4" fontWeight={700}>
          Award Winners
        </Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Discover Oscar, Emmy, and Golden Globe winning content in your library
      </Typography>

      {/* Filters */}
      <Box display="flex" gap={2} mb={4} flexWrap="wrap" alignItems="center">
        <TextField
          placeholder="Search..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          size="small"
          sx={{ minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <ToggleButtonGroup
          value={type}
          exclusive
          onChange={(_, value) => value && setType(value)}
          size="small"
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="movie">
            <MovieIcon sx={{ mr: 0.5, fontSize: 18 }} /> Movies
          </ToggleButton>
          <ToggleButton value="series">
            <TvIcon sx={{ mr: 0.5, fontSize: 18 }} /> Series
          </ToggleButton>
        </ToggleButtonGroup>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Award Type</InputLabel>
          <Select
            value={awardFilter}
            label="Award Type"
            onChange={(e) => {
              setAwardFilter(e.target.value as AwardFilter)
              setPage(1)
            }}
          >
            <MenuItem value="all">All Awards</MenuItem>
            <MenuItem value="oscar">🏆 Oscars</MenuItem>
            <MenuItem value="emmy">📺 Emmys</MenuItem>
            <MenuItem value="golden_globe">🌟 Golden Globes</MenuItem>
            <MenuItem value="bafta">🎬 BAFTAs</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <Box textAlign="center" py={8}>
          <EmojiEventsIcon sx={{ fontSize: 64, opacity: 0.2, mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No award-winning content found
          </Typography>
          <Typography variant="body2" color="text.disabled" mt={1}>
            {search
              ? 'Try adjusting your search'
              : 'Run the metadata enrichment job to discover awards data'}
          </Typography>
        </Box>
      ) : (
        <>
          <Grid container spacing={2}>
            {items.map((item) => (
              <Grid item key={`${item.type}-${item.id}`}>
                <Box position="relative">
                  <MoviePoster
                    title={item.title}
                    year={item.year}
                    posterUrl={item.poster_url}
                    rating={item.community_rating}
                    genres={item.genres}
                    overview={item.overview}
                    userRating={getRating(item.type, item.id)}
                    onRate={(rating) => handleRate(item.id, item.type, rating)}
                    size="medium"
                    onClick={() => navigate(`/${item.type === 'movie' ? 'movies' : 'series'}/${item.id}`)}
                  />
                  {/* Award highlights */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 8,
                      left: 8,
                      right: 8,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 0.5,
                    }}
                  >
                    {parseAwardHighlights(item.awards_summary).map((highlight, idx) => (
                      <Chip
                        key={idx}
                        label={highlight}
                        size="small"
                        sx={{
                          fontSize: '0.65rem',
                          height: 20,
                          bgcolor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>

          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  )
}

