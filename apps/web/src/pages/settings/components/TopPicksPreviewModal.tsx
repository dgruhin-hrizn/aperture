import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Tabs,
    Tab,
    Grid,
    Chip,
    IconButton,
    Card,
    CardContent,
    Skeleton,
    Alert,
    CircularProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    OutlinedInput,
    Checkbox,
    ListItemText,
    FormControlLabel,
    Collapse,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import FilterListIcon from '@mui/icons-material/FilterList'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { MediaPosterCard, type JellyseerrStatus } from '../../../components/MediaPosterCard'
import { SeasonSelectModal, type SeasonInfo } from '../../discovery/components/SeasonSelectModal'

// ISO 639-1 language code to display name mapping
const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
    ru: 'Russian',
    ar: 'Arabic',
    hi: 'Hindi',
    nl: 'Dutch',
    sv: 'Swedish',
    da: 'Danish',
    no: 'Norwegian',
    fi: 'Finnish',
    pl: 'Polish',
    tr: 'Turkish',
    th: 'Thai',
    id: 'Indonesian',
    vi: 'Vietnamese',
    cs: 'Czech',
    el: 'Greek',
    he: 'Hebrew',
    hu: 'Hungarian',
    ro: 'Romanian',
    uk: 'Ukrainian',
    bn: 'Bengali',
    ta: 'Tamil',
    te: 'Telugu',
    ml: 'Malayalam',
    mr: 'Marathi',
    gu: 'Gujarati',
    kn: 'Kannada',
    pa: 'Punjabi',
    tl: 'Tagalog',
    ms: 'Malay',
    fa: 'Persian',
    ur: 'Urdu',
    cn: 'Cantonese',
    // Add more as needed
}

function getLanguageName(code: string | null): string {
    if (!code) return 'Unknown'
    return LANGUAGE_NAMES[code] || code.toUpperCase()
}

interface PreviewItem {
    id: string | null
    tmdbId: number
    title: string
    year: number | null
    posterUrl: string | null
    rank: number
    inLibrary: boolean
    // Extended metadata
    overview: string | null
    voteAverage: number | null
    genreIds: number[]
    originalLanguage: string | null
}

interface JellyseerrMediaStatus {
    exists: boolean
    requested: boolean
    requestStatus?: 'pending' | 'approved' | 'declined' | 'unknown'
}

interface TopPicksPreviewModalProps {
    open: boolean
    onClose: () => void
    mediaType: 'movies' | 'series'
    source: string
    hybridExternalSource?: string
    mdblistListId?: number
    mdblistSort?: string
    sourceName: string
    savedLanguages?: string[]
    savedIncludeUnknownLanguage?: boolean
}

interface TabPanelProps {
    children?: React.ReactNode
    index: number
    value: number
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`preview-tabpanel-${index}`}
            aria-labelledby={`preview-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
        </div>
    )
}

export function TopPicksPreviewModal({
    open,
    onClose,
    mediaType,
    source,
    hybridExternalSource,
    mdblistListId,
    mdblistSort,
    sourceName,
    savedLanguages = [],
    savedIncludeUnknownLanguage = true,
}: TopPicksPreviewModalProps) {
    const [tabValue, setTabValue] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [matchedItems, setMatchedItems] = useState<PreviewItem[]>([])
    const [missingItems, setMissingItems] = useState<PreviewItem[]>([])
    const [requestingItems, setRequestingItems] = useState<Set<number>>(new Set())
    const [jellyseerrConfigured, setJellyseerrConfigured] = useState(false)
    const [statusCache, setStatusCache] = useState<Map<number, JellyseerrMediaStatus>>(new Map())
    const [loadingStatuses, setLoadingStatuses] = useState(false)
    const [bulkRequesting, setBulkRequesting] = useState(false)
    const [bulkRequestProgress, setBulkRequestProgress] = useState({ current: 0, total: 0 })

    // Season selection modal state (for series)
    const [seasonModalOpen, setSeasonModalOpen] = useState(false)
    const [seasonModalLoading, setSeasonModalLoading] = useState(false)
    const [seasonData, setSeasonData] = useState<{ seasons: SeasonInfo[]; title: string; posterPath?: string; tmdbId: number } | null>(null)

    // Language filtering - initialize with saved values
    const [selectedLanguages, setSelectedLanguages] = useState<string[]>(savedLanguages)
    const [includeUnknownLanguage, setIncludeUnknownLanguage] = useState(savedIncludeUnknownLanguage)
    const [showFilters, setShowFilters] = useState(savedLanguages.length > 0)

    // Extract unique languages from all items
    const availableLanguages = useMemo(() => {
        const allItems = [...matchedItems, ...missingItems]
        const languageSet = new Set<string>()
        allItems.forEach(item => {
            if (item.originalLanguage) {
                languageSet.add(item.originalLanguage)
            }
        })
        return Array.from(languageSet).sort((a, b) =>
            getLanguageName(a).localeCompare(getLanguageName(b))
        )
    }, [matchedItems, missingItems])

    // Filter items by selected languages
    const filteredMatchedItems = useMemo(() => {
        if (selectedLanguages.length === 0) return matchedItems
        return matchedItems.filter(item => {
            if (!item.originalLanguage) return includeUnknownLanguage
            return selectedLanguages.includes(item.originalLanguage)
        })
    }, [matchedItems, selectedLanguages, includeUnknownLanguage])

    const filteredMissingItems = useMemo(() => {
        if (selectedLanguages.length === 0) return missingItems
        return missingItems.filter(item => {
            if (!item.originalLanguage) return includeUnknownLanguage
            return selectedLanguages.includes(item.originalLanguage)
        })
    }, [missingItems, selectedLanguages, includeUnknownLanguage])

    const fetchPreview = useCallback(async () => {
        if (!source) return

        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/top-picks/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    mediaType,
                    source,
                    hybridExternalSource,
                    mdblistListId,
                    mdblistSort,
                    limit: 100,
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to fetch preview')
            }

            const data = await response.json()
            setMatchedItems(data.matched || [])
            setMissingItems(data.missing || [])
            return data.missing || []
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load preview')
            return []
        } finally {
            setLoading(false)
        }
    }, [mediaType, source, hybridExternalSource, mdblistListId, mdblistSort])

    // Check if Jellyseerr is configured
    const checkJellyseerr = useCallback(async () => {
        try {
            const response = await fetch('/api/jellyseerr/config', { credentials: 'include' })
            if (response.ok) {
                const data = await response.json()
                setJellyseerrConfigured(data.configured === true)
                return data.configured === true
            }
            return false
        } catch {
            setJellyseerrConfigured(false)
            return false
        }
    }, [])

    // Fetch TV details for season selection modal
    const fetchTVDetails = useCallback(async (tmdbId: number, title: string): Promise<{
        seasons: SeasonInfo[]
        title: string
        posterPath?: string
    } | null> => {
        try {
            const response = await fetch(`/api/jellyseerr/tv/${tmdbId}`, {
                credentials: 'include',
            })

            if (!response.ok) {
                console.error('Failed to fetch TV details')
                return null
            }

            const data = await response.json()

            // Transform seasons to SeasonInfo format
            const seasons: SeasonInfo[] = (data.seasons || []).map((s: {
                id: number
                seasonNumber: number
                episodeCount: number
                airDate?: string
                name: string
                overview?: string
                posterPath?: string
                status?: number
            }) => ({
                id: s.id,
                seasonNumber: s.seasonNumber,
                episodeCount: s.episodeCount,
                airDate: s.airDate,
                name: s.name || (s.seasonNumber === 0 ? 'Specials' : `Season ${s.seasonNumber}`),
                overview: s.overview,
                posterPath: s.posterPath,
                status: s.status ?? 1,
            }))

            // Sort seasons by number
            seasons.sort((a, b) => a.seasonNumber - b.seasonNumber)

            return {
                seasons,
                title: data.name || title,
                posterPath: data.posterPath,
            }
        } catch (err) {
            console.error('Error fetching TV details:', err)
            return null
        }
    }, [])

    // Fetch Jellyseerr status for all missing items
    const fetchJellyseerrStatuses = useCallback(async (items: PreviewItem[]) => {
        if (items.length === 0) return

        setLoadingStatuses(true)
        const jellyseerrType = mediaType === 'movies' ? 'movie' : 'tv'
        const newCache = new Map<number, JellyseerrMediaStatus>()

        // Fetch statuses in parallel (batch of 10 at a time to avoid overwhelming the server)
        const batchSize = 10
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize)
            await Promise.all(
                batch.map(async (item) => {
                    try {
                        const response = await fetch(`/api/jellyseerr/status/${jellyseerrType}/${item.tmdbId}`, {
                            credentials: 'include',
                        })
                        if (response.ok) {
                            const data = await response.json()
                            if (data.jellyseerrStatus) {
                                newCache.set(item.tmdbId, data.jellyseerrStatus)
                            }
                        }
                    } catch {
                        // Silently fail for individual items
                    }
                })
            )
        }

        setStatusCache(newCache)
        setLoadingStatuses(false)
    }, [mediaType])

    useEffect(() => {
        if (open) {
            // Reset state when opening
            setRequestingItems(new Set())
            setStatusCache(new Map())

            // Fetch preview and then Jellyseerr statuses
            const init = async () => {
                const [missing, isConfigured] = await Promise.all([
                    fetchPreview(),
                    checkJellyseerr(),
                ])

                // Only fetch Jellyseerr statuses if configured and there are missing items
                if (isConfigured && missing.length > 0) {
                    await fetchJellyseerrStatuses(missing)
                }
            }
            init()
        }
    }, [open, fetchPreview, checkJellyseerr, fetchJellyseerrStatuses])

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue)
    }

    const handleRequestItem = async (item: PreviewItem, seasons?: number[]) => {
        const status = statusCache.get(item.tmdbId)
        // Don't request if already requested or exists
        if (!item.tmdbId || requestingItems.has(item.tmdbId) || status?.requested || status?.exists) return

        // For series, open the season selection modal if no seasons provided
        if (mediaType === 'series' && !seasons) {
            setSeasonModalLoading(true)
            setSeasonModalOpen(true)
            const details = await fetchTVDetails(item.tmdbId, item.title)
            setSeasonData(details ? { ...details, tmdbId: item.tmdbId } : null)
            setSeasonModalLoading(false)
            return
        }

        setRequestingItems(prev => new Set(prev).add(item.tmdbId))

        try {
            const response = await fetch('/api/jellyseerr/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    mediaType: mediaType === 'movies' ? 'movie' : 'series',
                    tmdbId: item.tmdbId,
                    title: item.title,
                    seasons, // Include seasons for series requests
                }),
            })

            if (response.ok) {
                // Update the status cache to show as requested
                setStatusCache(prev => {
                    const newCache = new Map(prev)
                    newCache.set(item.tmdbId, {
                        exists: false,
                        requested: true,
                        requestStatus: 'pending',
                    })
                    return newCache
                })
            }
        } catch {
            // Silently fail
        } finally {
            setRequestingItems(prev => {
                const next = new Set(prev)
                next.delete(item.tmdbId)
                return next
            })
        }
    }

    // Handle season selection submit
    const handleSeasonSubmit = async (seasons: number[]) => {
        if (!seasonData) return

        const item = missingItems.find(i => i.tmdbId === seasonData.tmdbId)
        if (item) {
            await handleRequestItem(item, seasons)
        }
    }

    // Get items that can be requested (not already requested or in library, respecting filters)
    const getRequestableItems = useCallback(() => {
        return filteredMissingItems.filter(item => {
            const status = statusCache.get(item.tmdbId)
            return !status?.requested && !status?.exists
        })
    }, [filteredMissingItems, statusCache])

    const handleRequestAll = async () => {
        const requestableItems = getRequestableItems()
        if (requestableItems.length === 0) return

        setBulkRequesting(true)
        setBulkRequestProgress({ current: 0, total: requestableItems.length })

        for (let i = 0; i < requestableItems.length; i++) {
            const item = requestableItems[i]
            setBulkRequestProgress({ current: i + 1, total: requestableItems.length })

            try {
                const response = await fetch('/api/jellyseerr/request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        mediaType: mediaType === 'movies' ? 'movie' : 'series',
                        tmdbId: item.tmdbId,
                        title: item.title,
                    }),
                })

                if (response.ok) {
                    setStatusCache(prev => {
                        const newCache = new Map(prev)
                        newCache.set(item.tmdbId, {
                            exists: false,
                            requested: true,
                            requestStatus: 'pending',
                        })
                        return newCache
                    })
                }
            } catch {
                // Continue with next item
            }

            // Small delay between requests to avoid overwhelming Jellyseerr
            if (i < requestableItems.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 300))
            }
        }

        setBulkRequesting(false)
    }

    const renderMatchedCard = (item: PreviewItem) => {
        if (!item.id) return null

        return (
            <Grid item xs={6} sm={4} md={3} lg={2} key={`matched-${item.tmdbId || item.id}`}>
                <MediaPosterCard
                    tmdbId={item.tmdbId}
                    title={item.title}
                    year={item.year}
                    posterUrl={item.posterUrl}
                    rank={item.rank}
                    mediaType={mediaType === 'movies' ? 'movie' : 'series'}
                    inLibrary={true}
                    libraryId={item.id}
                    overview={item.overview}
                    voteAverage={item.voteAverage}
                />
            </Grid>
        )
    }

    const renderMissingCard = (item: PreviewItem) => {
        const isRequesting = requestingItems.has(item.tmdbId)
        const status = statusCache.get(item.tmdbId)

        // Convert to JellyseerrStatus format for MediaPosterCard
        const jellyseerrStatus: JellyseerrStatus | undefined = status ? {
            requested: status.requested,
            requestStatus: status.requestStatus,
        } : undefined

        return (
            <Grid item xs={6} sm={4} md={3} lg={2} key={`missing-${item.tmdbId}`}>
                <MediaPosterCard
                    tmdbId={item.tmdbId}
                    title={item.title}
                    year={item.year}
                    posterUrl={item.posterUrl}
                    rank={item.rank}
                    mediaType={mediaType === 'movies' ? 'movie' : 'series'}
                    inLibrary={false}
                    jellyseerrStatus={jellyseerrStatus}
                    canRequest={jellyseerrConfigured && !loadingStatuses}
                    isRequesting={isRequesting}
                    onRequest={() => handleRequestItem(item)}
                    overview={item.overview}
                    voteAverage={item.voteAverage}
                />
            </Grid>
        )
    }

    const renderLoadingSkeletons = () => (
        <Grid container spacing={2}>
            {Array.from({ length: 12 }).map((_, i) => (
                <Grid item xs={6} sm={4} md={3} lg={2} key={i}>
                    <Card>
                        <Skeleton variant="rectangular" sx={{ paddingTop: '150%' }} />
                        <CardContent sx={{ py: 1 }}>
                            <Skeleton variant="text" width="80%" />
                            <Skeleton variant="text" width="40%" />
                        </CardContent>
                    </Card>
                </Grid>
            ))}
        </Grid>
    )

    // For local sources, there's no "missing" concept
    const isLocalSource = source === 'emby_history' || source === 'local'

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: { minHeight: '70vh' }
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                    <Typography variant="h6" component="span">
                        {mediaType === 'movies' ? 'Movies' : 'Series'} Preview
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Source: {sourceName}
                    </Typography>
                </Box>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={tabValue} onChange={handleTabChange}>
                        <Tab
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CheckCircleIcon fontSize="small" color="success" />
                                    In Your Library
                                    <Chip
                                        label={loading ? '...' : (selectedLanguages.length > 0
                                            ? `${filteredMatchedItems.length}/${matchedItems.length}`
                                            : matchedItems.length)}
                                        size="small"
                                        color="success"
                                        variant="outlined"
                                    />
                                </Box>
                            }
                        />
                        <Tab
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CloudDownloadIcon fontSize="small" color="warning" />
                                    Missing
                                    <Chip
                                        label={loading ? '...' : (isLocalSource ? 'N/A' : (selectedLanguages.length > 0
                                            ? `${filteredMissingItems.length}/${missingItems.length}`
                                            : missingItems.length))}
                                        size="small"
                                        color={isLocalSource ? 'default' : 'warning'}
                                        variant="outlined"
                                    />
                                </Box>
                            }
                            disabled={isLocalSource}
                        />
                    </Tabs>
                </Box>

                {/* Language Filter */}
                {!loading && availableLanguages.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                        <Button
                            size="small"
                            startIcon={<FilterListIcon />}
                            endIcon={showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            onClick={() => setShowFilters(!showFilters)}
                            sx={{ mb: 1 }}
                        >
                            Language Filter
                            {selectedLanguages.length > 0 && (
                                <Chip
                                    label={selectedLanguages.length}
                                    size="small"
                                    color="primary"
                                    sx={{ ml: 1 }}
                                />
                            )}
                        </Button>
                        <Collapse in={showFilters}>
                            <Box sx={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 1,
                                p: 2,
                                bgcolor: 'action.hover',
                                borderRadius: 1,
                                alignItems: 'center'
                            }}>
                                <FormControl size="small" sx={{ minWidth: 200, maxWidth: 400 }}>
                                    <InputLabel>Languages</InputLabel>
                                    <Select
                                        multiple
                                        value={selectedLanguages}
                                        onChange={(e) => setSelectedLanguages(e.target.value as string[])}
                                        input={<OutlinedInput label="Languages" />}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((value) => (
                                                    <Chip key={value} label={getLanguageName(value)} size="small" />
                                                ))}
                                            </Box>
                                        )}
                                    >
                                        {availableLanguages.map((lang) => (
                                            <MenuItem key={lang} value={lang}>
                                                <Checkbox checked={selectedLanguages.includes(lang)} />
                                                <ListItemText primary={getLanguageName(lang)} secondary={lang.toUpperCase()} />
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={includeUnknownLanguage}
                                            onChange={(e) => setIncludeUnknownLanguage(e.target.checked)}
                                            size="small"
                                        />
                                    }
                                    label="Include unknown language"
                                />
                                {selectedLanguages.length > 0 && (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => {
                                            setSelectedLanguages([])
                                            setIncludeUnknownLanguage(true)
                                        }}
                                    >
                                        Clear Filters
                                    </Button>
                                )}
                            </Box>
                        </Collapse>
                    </Box>
                )}

                <TabPanel value={tabValue} index={0}>
                    {loading ? (
                        renderLoadingSkeletons()
                    ) : filteredMatchedItems.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Typography color="text.secondary">
                                {selectedLanguages.length > 0
                                    ? `No items match the selected language filter. ${matchedItems.length} items available without filter.`
                                    : 'No items found in your library matching this source.'}
                            </Typography>
                        </Box>
                    ) : (
                        <Grid container spacing={2}>
                            {filteredMatchedItems.map(renderMatchedCard)}
                        </Grid>
                    )}
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    {loading ? (
                        renderLoadingSkeletons()
                    ) : filteredMissingItems.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Typography color="text.secondary">
                                {isLocalSource
                                    ? 'Local watch history source only shows items already in your library.'
                                    : selectedLanguages.length > 0
                                        ? `No missing items match the selected language filter. ${missingItems.length} items available without filter.`
                                        : 'All items from this source are already in your library!'}
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            {!jellyseerrConfigured && (
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    Configure Jellyseerr in Settings → Integrations to request missing items.
                                </Alert>
                            )}
                            <Grid container spacing={2}>
                                {filteredMissingItems.map(renderMissingCard)}
                            </Grid>
                        </>
                    )}
                </TabPanel>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                {tabValue === 1 && jellyseerrConfigured && getRequestableItems().length > 0 && mediaType === 'movies' && (
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={bulkRequesting ? <CircularProgress size={18} color="inherit" /> : <PlaylistAddIcon />}
                        onClick={handleRequestAll}
                        disabled={bulkRequesting || loadingStatuses}
                    >
                        {bulkRequesting
                            ? `Requesting ${bulkRequestProgress.current}/${bulkRequestProgress.total}...`
                            : `Request All (${getRequestableItems().length})`
                        }
                    </Button>
                )}
                {tabValue === 1 && jellyseerrConfigured && getRequestableItems().length > 0 && mediaType === 'series' && (
                    <Typography variant="body2" color="text.secondary">
                        Click on individual series to select seasons to request
                    </Typography>
                )}
            </DialogActions>

            {/* Season Selection Modal (for series) */}
            <SeasonSelectModal
                open={seasonModalOpen}
                onClose={() => {
                    setSeasonModalOpen(false)
                    setSeasonData(null)
                }}
                onSubmit={handleSeasonSubmit}
                title={seasonData?.title || ''}
                posterPath={seasonData?.posterPath}
                seasons={seasonData?.seasons || []}
                loading={seasonModalLoading}
            />
        </Dialog>
    )
}
