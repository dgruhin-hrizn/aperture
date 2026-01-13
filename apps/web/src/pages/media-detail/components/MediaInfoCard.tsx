import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  Chip,
  Avatar,
  Stack,
  Tooltip,
  Paper,
  LinearProgress,
} from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import BusinessIcon from '@mui/icons-material/Business'
import CreateIcon from '@mui/icons-material/Create'
import MovieFilterIcon from '@mui/icons-material/MovieFilter'
import PublicIcon from '@mui/icons-material/Public'
import LanguageIcon from '@mui/icons-material/Language'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import LinkIcon from '@mui/icons-material/Link'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import StreamIcon from '@mui/icons-material/Stream'
import CollectionsIcon from '@mui/icons-material/Collections'
import GroupIcon from '@mui/icons-material/Group'
import VisibilityIcon from '@mui/icons-material/Visibility'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CameraRollIcon from '@mui/icons-material/CameraRoll'
import MusicNoteIcon from '@mui/icons-material/MusicNote'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import FavoriteIcon from '@mui/icons-material/Favorite'
import StarIcon from '@mui/icons-material/Star'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { getProxiedImageUrl } from '@aperture/ui'
import type { Media, Actor, StudioItem, MovieWatchStats, SeriesWatchStats } from '../types'
import { isMovie, isSeries } from '../types'

type WatchStats = MovieWatchStats | SeriesWatchStats

interface MediaInfoCardProps {
  media: Media
  watchStats?: WatchStats | null
}

// Rotten Tomatoes score badge component
function RTScoreBadge({ score, type }: { score: number | string; type: 'critic' | 'audience' }) {
  const numScore = typeof score === 'string' ? parseFloat(score) : score
  if (isNaN(numScore)) return null

  const isFresh = numScore >= 60
  const icon = type === 'critic' ? '🍅' : '🍿'
  const label = type === 'critic' ? 'Tomatometer' : 'Audience'

  return (
    <Tooltip title={`${label}: ${numScore}%`}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          bgcolor: isFresh ? 'success.main' : 'error.main',
          color: 'white',
          px: 1,
          py: 0.25,
          borderRadius: 1,
          fontSize: '0.75rem',
          fontWeight: 600,
        }}
      >
        <span>{icon}</span>
        <span>{Math.round(numScore)}%</span>
      </Box>
    </Tooltip>
  )
}

// Metacritic score badge
function MetacriticBadge({ score }: { score: number | string }) {
  const numScore = typeof score === 'string' ? parseFloat(score) : score
  if (isNaN(numScore)) return null

  const getColor = () => {
    if (numScore >= 75) return '#66cc33'
    if (numScore >= 50) return '#ffcc33'
    return '#ff0000'
  }

  return (
    <Tooltip title={`Metacritic: ${Math.round(numScore)}/100`}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          bgcolor: getColor(),
          color: numScore >= 50 ? 'black' : 'white',
          px: 1,
          py: 0.25,
          borderRadius: 0.5,
          fontSize: '0.75rem',
          fontWeight: 700,
        }}
      >
        <span>Ⓜ️</span>
        <span>{Math.round(numScore)}</span>
      </Box>
    </Tooltip>
  )
}

// Letterboxd score badge
function LetterboxdBadge({ score }: { score: number | string }) {
  const numScore = typeof score === 'string' ? parseFloat(score) : score
  if (isNaN(numScore)) return null

  const displayScore = numScore.toFixed(1)
  const percentage = (numScore / 5) * 100

  const getColor = () => {
    if (percentage >= 80) return '#00e054'
    if (percentage >= 60) return '#40bcf4'
    if (percentage >= 40) return '#ee9b00'
    return '#ff8000'
  }

  return (
    <Tooltip title={`Letterboxd: ${displayScore}/5`}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          bgcolor: getColor(),
          color: 'white',
          px: 1,
          py: 0.25,
          borderRadius: 1,
          fontSize: '0.75rem',
          fontWeight: 600,
        }}
      >
        <span>📽️</span>
        <span>{displayScore}</span>
      </Box>
    </Tooltip>
  )
}

// Helper to get actors from either movie or series
function getActors(media: Media): Actor[] {
  if (isSeries(media)) {
    return media.actors || []
  }
  if (isMovie(media)) {
    return media.actors || []
  }
  return []
}

// Helper to get studios
function getStudios(media: Media): StudioItem[] {
  if (isSeries(media)) {
    return media.studios || []
  }
  if (isMovie(media)) {
    return media.studios || []
  }
  return []
}

export function MediaInfoCard({ media, watchStats }: MediaInfoCardProps) {
  const hasRatings =
    media.rt_critic_score ||
    media.rt_audience_score ||
    media.metacritic_score ||
    media.letterboxd_score
  const hasStreamingProviders =
    media.streaming_providers && media.streaming_providers.length > 0
  const actors = getActors(media)
  const studios = getStudios(media)

  // Check if there are any watch stats to display
  const hasWatchStats = watchStats && (
    isMovie(media) 
      ? (watchStats as MovieWatchStats).totalWatchers > 0
      : (watchStats as SeriesWatchStats).totalViewers > 0 || (watchStats as SeriesWatchStats).currentlyWatching > 0
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Community Watch Stats */}
      {hasWatchStats && (
        <Paper
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: 'background.paper',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
            border: '1px solid',
            borderColor: 'primary.main',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <GroupIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Community Activity
            </Typography>
          </Box>
          
          {isMovie(media) ? (
            // Movie watch stats - comprehensive
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Reach/Engagement Row */}
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Tooltip title={`${(watchStats as MovieWatchStats).watchPercentage}% of your ${(watchStats as MovieWatchStats).totalUsers} users`}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                    <VisibilityIcon sx={{ color: 'info.main', fontSize: 20 }} />
                    <Box>
                      <Typography variant="h5" fontWeight={700} color="info.main" lineHeight={1}>
                        {(watchStats as MovieWatchStats).totalWatchers}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
                        Watched
                      </Typography>
                    </Box>
                  </Box>
                </Tooltip>

                {(watchStats as MovieWatchStats).totalPlays > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                    <PlayArrowIcon sx={{ color: 'success.main', fontSize: 20 }} />
                    <Box>
                      <Typography variant="h5" fontWeight={700} color="success.main" lineHeight={1}>
                        {(watchStats as MovieWatchStats).totalPlays}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
                        Plays
                      </Typography>
                    </Box>
                  </Box>
                )}

                {(watchStats as MovieWatchStats).favoritesCount > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                    <FavoriteIcon sx={{ color: 'error.main', fontSize: 20 }} />
                    <Box>
                      <Typography variant="h5" fontWeight={700} color="error.main" lineHeight={1}>
                        {(watchStats as MovieWatchStats).favoritesCount}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
                        Favorited
                      </Typography>
                    </Box>
                  </Box>
                )}

                {(watchStats as MovieWatchStats).averageUserRating != null && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                    <StarIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                    <Box>
                      <Typography variant="h5" fontWeight={700} color="warning.main" lineHeight={1}>
                        {(watchStats as MovieWatchStats).averageUserRating!.toFixed(1)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
                        Avg rating ({(watchStats as MovieWatchStats).totalRatings})
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Reach Progress Bar */}
              {(watchStats as MovieWatchStats).watchPercentage > 0 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Household Reach
                    </Typography>
                    <Typography variant="caption" fontWeight={600} color="primary.main">
                      {(watchStats as MovieWatchStats).watchPercentage}%
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={(watchStats as MovieWatchStats).watchPercentage}
                    sx={{ 
                      height: 6, 
                      borderRadius: 3,
                      bgcolor: 'action.hover',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 3,
                      }
                    }}
                  />
                </Box>
              )}
            </Box>
          ) : (
            // Series watch stats - comprehensive
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Main Stats Row */}
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {(watchStats as SeriesWatchStats).currentlyWatching > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                    <TrendingUpIcon sx={{ color: 'success.main', fontSize: 20 }} />
                    <Box>
                      <Typography variant="h5" fontWeight={700} color="success.main" lineHeight={1}>
                        {(watchStats as SeriesWatchStats).currentlyWatching}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
                        Watching now
                      </Typography>
                    </Box>
                  </Box>
                )}

                {(watchStats as SeriesWatchStats).totalViewers > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                    <VisibilityIcon sx={{ color: 'info.main', fontSize: 20 }} />
                    <Box>
                      <Typography variant="h5" fontWeight={700} color="info.main" lineHeight={1}>
                        {(watchStats as SeriesWatchStats).totalViewers}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
                        Viewers
                      </Typography>
                    </Box>
                  </Box>
                )}

                {(watchStats as SeriesWatchStats).completedViewers > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                    <CheckCircleIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                    <Box>
                      <Typography variant="h5" fontWeight={700} color="warning.main" lineHeight={1}>
                        {(watchStats as SeriesWatchStats).completedViewers}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
                        Completed
                      </Typography>
                    </Box>
                  </Box>
                )}

                {(watchStats as SeriesWatchStats).totalEpisodePlays > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                    <PlayArrowIcon sx={{ color: 'secondary.main', fontSize: 20 }} />
                    <Box>
                      <Typography variant="h5" fontWeight={700} color="secondary.main" lineHeight={1}>
                        {(watchStats as SeriesWatchStats).totalEpisodePlays}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
                        Episode plays
                      </Typography>
                    </Box>
                  </Box>
                )}

                {(watchStats as SeriesWatchStats).averageUserRating != null && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                    <StarIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                    <Box>
                      <Typography variant="h5" fontWeight={700} color="warning.main" lineHeight={1}>
                        {(watchStats as SeriesWatchStats).averageUserRating!.toFixed(1)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
                        Avg rating ({(watchStats as SeriesWatchStats).totalRatings})
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Average Progress Bar */}
              {(watchStats as SeriesWatchStats).averageProgress > 0 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Average Viewer Progress ({(watchStats as SeriesWatchStats).totalEpisodes} episodes)
                    </Typography>
                    <Typography variant="caption" fontWeight={600} color="primary.main">
                      {(watchStats as SeriesWatchStats).averageProgress}%
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={(watchStats as SeriesWatchStats).averageProgress}
                    sx={{ 
                      height: 6, 
                      borderRadius: 3,
                      bgcolor: 'action.hover',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 3,
                      }
                    }}
                  />
                </Box>
              )}

              {/* Household Reach */}
              {(watchStats as SeriesWatchStats).watchPercentage > 0 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      User Reach
                    </Typography>
                    <Typography variant="caption" fontWeight={600} color="secondary.main">
                      {(watchStats as SeriesWatchStats).watchPercentage}%
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={(watchStats as SeriesWatchStats).watchPercentage}
                    color="secondary"
                    sx={{ 
                      height: 6, 
                      borderRadius: 3,
                      bgcolor: 'action.hover',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 3,
                      }
                    }}
                  />
                </Box>
              )}
            </Box>
          )}
        </Paper>
      )}

      {/* Critic Ratings Section */}
      {hasRatings && (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Critic Ratings
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {media.rt_critic_score && (
              <RTScoreBadge score={media.rt_critic_score} type="critic" />
            )}
            {media.rt_audience_score && (
              <RTScoreBadge score={media.rt_audience_score} type="audience" />
            )}
            {media.metacritic_score && <MetacriticBadge score={media.metacritic_score} />}
            {media.letterboxd_score && <LetterboxdBadge score={media.letterboxd_score} />}
          </Box>
          {media.rt_consensus && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}
            >
              "{media.rt_consensus}"
            </Typography>
          )}
        </Paper>
      )}

      {/* Streaming Providers Section */}
      {hasStreamingProviders && (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <StreamIcon sx={{ color: 'info.main', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Also Available On
            </Typography>
          </Box>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {media.streaming_providers!.map((provider) => (
              <Chip
                key={provider.id}
                label={provider.name}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
          </Stack>
        </Paper>
      )}

      {/* Collection Section (Movies only) */}
      {isMovie(media) && media.collection_name && (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CollectionsIcon sx={{ color: 'secondary.main', fontSize: 20 }} />
            <Box>
              <Typography variant="caption" color="text.secondary">
                Part of Collection
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {media.collection_name}
              </Typography>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Awards Section */}
      {media.awards_summary && (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEventsIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            <Typography variant="body2" fontWeight={500}>
              {media.awards_summary}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Keywords Section */}
      {media.keywords && media.keywords.length > 0 && (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography
            variant="subtitle1"
            fontWeight={600}
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <LocalOfferIcon fontSize="small" />
            Keywords
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {media.keywords.slice(0, 10).map((keyword) => (
              <Chip
                key={keyword}
                label={keyword}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
          </Stack>
        </Paper>
      )}

      <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          {/* Cast */}
          {actors.length > 0 && (
            <>
              <Typography
                variant="h6"
                fontWeight={600}
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <PersonIcon fontSize="small" />
                Cast
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                {actors.slice(0, 12).map((actor, idx) => (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar
                      src={getProxiedImageUrl(actor.thumb)}
                      sx={{ width: 40, height: 40, bgcolor: 'grey.700' }}
                    >
                      <PersonIcon fontSize="small" />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {actor.name}
                      </Typography>
                      {actor.role && (
                        <Typography variant="caption" color="text.secondary">
                          {actor.role}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            </>
          )}

          {/* Directors */}
          {media.directors && media.directors.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography
                variant="subtitle1"
                fontWeight={600}
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <MovieFilterIcon fontSize="small" />
                {isSeries(media) ? 'Created By' : 'Director'}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                {media.directors.map((director) => (
                  <Chip key={director} label={director} size="small" variant="outlined" />
                ))}
              </Stack>
            </>
          )}

          {/* Writers */}
          {media.writers && media.writers.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography
                variant="subtitle1"
                fontWeight={600}
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <CreateIcon fontSize="small" />
                Writers
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                {media.writers.slice(0, 10).map((writer) => (
                  <Chip key={writer} label={writer} size="small" variant="outlined" />
                ))}
              </Stack>
            </>
          )}

          {/* Movie-specific crew */}
          {isMovie(media) && (
            <>
              {media.cinematographers && media.cinematographers.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <CameraRollIcon fontSize="small" />
                    Cinematography
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                    {media.cinematographers.map((name) => (
                      <Chip key={name} label={name} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </>
              )}

              {media.composers && media.composers.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <MusicNoteIcon fontSize="small" />
                    Music
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                    {media.composers.map((name) => (
                      <Chip key={name} label={name} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </>
              )}

              {media.editors && media.editors.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <ContentCutIcon fontSize="small" />
                    Editing
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                    {media.editors.map((name) => (
                      <Chip key={name} label={name} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </>
              )}

              {/* External Links for Movies */}
              {(media.imdb_id || media.tmdb_id) && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    gutterBottom
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <LinkIcon fontSize="small" />
                    External Links
                  </Typography>
                  <Stack direction="row" gap={1}>
                    {media.imdb_id && (
                      <Chip
                        label="IMDb"
                        size="small"
                        component="a"
                        href={`https://www.imdb.com/title/${media.imdb_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        clickable
                        sx={{ fontWeight: 600 }}
                      />
                    )}
                    {media.tmdb_id && (
                      <Chip
                        label="TMDb"
                        size="small"
                        component="a"
                        href={`https://www.themoviedb.org/movie/${media.tmdb_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        clickable
                      />
                    )}
                  </Stack>
                </>
              )}
            </>
          )}

          {/* Studios */}
          {studios.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography
                variant="subtitle1"
                fontWeight={600}
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <BusinessIcon fontSize="small" />
                Studios
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                {studios.map((studio, idx) => {
                  const studioName = typeof studio === 'string' ? studio : studio.name
                  return (
                    <Chip
                      key={`${studioName}-${idx}`}
                      label={studioName}
                      size="small"
                      variant="outlined"
                    />
                  )
                })}
              </Stack>
            </>
          )}

          {/* Languages */}
          {media.languages && media.languages.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography
                variant="subtitle1"
                fontWeight={600}
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <LanguageIcon fontSize="small" />
                Languages
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                {media.languages.map((language) => (
                  <Chip key={language} label={language} size="small" variant="outlined" />
                ))}
              </Stack>
            </>
          )}

          {/* Production Countries */}
          {media.production_countries && media.production_countries.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography
                variant="subtitle1"
                fontWeight={600}
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <PublicIcon fontSize="small" />
                Countries
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                {media.production_countries.map((country) => (
                  <Chip key={country} label={country} size="small" variant="outlined" />
                ))}
              </Stack>
            </>
          )}

          {/* Series Awards (from original series card) */}
          {isSeries(media) && media.awards && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography
                variant="subtitle1"
                fontWeight={600}
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <EmojiEventsIcon fontSize="small" />
                Awards
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {media.awards}
              </Typography>
            </>
          )}

          {/* External Links (Series only has these explicitly) */}
          {isSeries(media) && (media.imdb_id || media.tmdb_id || media.tvdb_id) && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography
                variant="subtitle1"
                fontWeight={600}
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <LinkIcon fontSize="small" />
                External Links
              </Typography>
              <Stack direction="row" gap={1}>
                {media.imdb_id && (
                  <Chip
                    label="IMDb"
                    size="small"
                    component="a"
                    href={`https://www.imdb.com/title/${media.imdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    clickable
                    sx={{ fontWeight: 600 }}
                  />
                )}
                {media.tmdb_id && (
                  <Chip
                    label="TMDb"
                    size="small"
                    component="a"
                    href={`https://www.themoviedb.org/tv/${media.tmdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    clickable
                  />
                )}
                {media.tvdb_id && (
                  <Chip
                    label="TVDb"
                    size="small"
                    component="a"
                    href={`https://thetvdb.com/?id=${media.tvdb_id}&tab=series`}
                    target="_blank"
                    rel="noopener noreferrer"
                    clickable
                  />
                )}
              </Stack>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

