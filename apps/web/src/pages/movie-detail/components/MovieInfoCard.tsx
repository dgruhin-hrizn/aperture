import { Box, Typography, Paper, Divider, Chip, Tooltip } from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import StreamIcon from '@mui/icons-material/Stream'
import type { Movie } from '../types'
import { formatRuntime } from '../hooks'

interface MovieInfoCardProps {
  movie: Movie
}

// Rotten Tomatoes score badge component
function RTScoreBadge({ score, type }: { score: number; type: 'critic' | 'audience' }) {
  const isFresh = score >= 60
  const icon = type === 'critic' ? '🍅' : '🍿'
  const label = type === 'critic' ? 'Tomatometer' : 'Audience'
  
  return (
    <Tooltip title={`${label}: ${score}%`}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 0.5,
        bgcolor: isFresh ? 'success.main' : 'error.main',
        color: 'white',
        px: 1,
        py: 0.25,
        borderRadius: 1,
        fontSize: '0.75rem',
        fontWeight: 600,
      }}>
        <span>{icon}</span>
        <span>{score}%</span>
      </Box>
    </Tooltip>
  )
}

// Metacritic score badge
function MetacriticBadge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 75) return '#66cc33'
    if (score >= 50) return '#ffcc33'
    return '#ff0000'
  }
  
  return (
    <Tooltip title={`Metacritic: ${score}/100`}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        bgcolor: getColor(),
        color: score >= 50 ? 'black' : 'white',
        width: 28,
        height: 28,
        borderRadius: 0.5,
        fontSize: '0.75rem',
        fontWeight: 700,
      }}>
        {score}
      </Box>
    </Tooltip>
  )
}

// Letterboxd score badge
function LetterboxdBadge({ score }: { score: number }) {
  // Letterboxd uses a 5-star scale
  const displayScore = score.toFixed(1)
  const percentage = (score / 5) * 100
  
  // Letterboxd colors: orange-ish gradient
  const getColor = () => {
    if (percentage >= 80) return '#00e054' // Green for excellent
    if (percentage >= 60) return '#40bcf4' // Blue for good
    if (percentage >= 40) return '#ee9b00' // Orange for average
    return '#ff8000' // Dark orange for below average
  }
  
  return (
    <Tooltip title={`Letterboxd: ${displayScore}/5`}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 0.5,
        bgcolor: getColor(),
        color: 'white',
        px: 1,
        py: 0.25,
        borderRadius: 1,
        fontSize: '0.75rem',
        fontWeight: 600,
      }}>
        <span>📽️</span>
        <span>{displayScore}</span>
      </Box>
    </Tooltip>
  )
}

export function MovieInfoCard({ movie }: MovieInfoCardProps) {
  const hasRatings = movie.rt_critic_score || movie.rt_audience_score || movie.metacritic_score || movie.letterboxd_score
  const hasStreamingProviders = movie.streaming_providers && movie.streaming_providers.length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Ratings Section */}
      {hasRatings && (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Critic Ratings
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {movie.rt_critic_score && (
              <RTScoreBadge score={movie.rt_critic_score} type="critic" />
            )}
            {movie.rt_audience_score && (
              <RTScoreBadge score={movie.rt_audience_score} type="audience" />
            )}
            {movie.metacritic_score && (
              <MetacriticBadge score={movie.metacritic_score} />
            )}
            {movie.letterboxd_score && (
              <LetterboxdBadge score={movie.letterboxd_score} />
            )}
          </Box>
          {movie.rt_consensus && (
            <Typography 
              variant="caption" 
              color="text.secondary" 
              sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}
            >
              "{movie.rt_consensus}"
            </Typography>
          )}
        </Paper>
      )}

      {/* Streaming Providers Section */}
      {hasStreamingProviders && (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <StreamIcon sx={{ color: 'info.main', fontSize: 20 }} />
            <Typography variant="subtitle2" color="text.secondary">
              Also Available On
            </Typography>
          </Box>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {movie.streaming_providers!.map((provider) => (
              <Chip
                key={provider.id}
                label={provider.name}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* Awards Section */}
      {movie.awards_summary && (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEventsIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            <Typography variant="body2" fontWeight={500}>
              {movie.awards_summary}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Main Info Section */}
      <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Movie Info
        </Typography>
        <Divider sx={{ my: 1 }} />
        
        {movie.community_rating && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
            <Typography variant="body2" color="text.secondary">Rating</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
              <Typography variant="body2" fontWeight={500}>
                {Number(movie.community_rating).toFixed(1)}
              </Typography>
            </Box>
          </Box>
        )}

        {movie.year && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
            <Typography variant="body2" color="text.secondary">Release Year</Typography>
            <Typography variant="body2" fontWeight={500}>{movie.year}</Typography>
          </Box>
        )}

        {movie.runtime_minutes && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
            <Typography variant="body2" color="text.secondary">Runtime</Typography>
            <Typography variant="body2" fontWeight={500}>{formatRuntime(movie.runtime_minutes)}</Typography>
          </Box>
        )}

        {movie.genres && movie.genres.length > 0 && (
          <Box sx={{ py: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>Genres</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {movie.genres.map((genre) => (
                <Chip key={genre} label={genre} size="small" variant="outlined" />
              ))}
            </Box>
          </Box>
        )}

        {movie.languages && movie.languages.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
            <Typography variant="body2" color="text.secondary">Language</Typography>
            <Typography variant="body2" fontWeight={500}>
              {movie.languages.join(', ')}
            </Typography>
          </Box>
        )}

        {movie.production_countries && movie.production_countries.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
            <Typography variant="body2" color="text.secondary">Country</Typography>
            <Typography variant="body2" fontWeight={500}>
              {movie.production_countries.join(', ')}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Franchise/Collection Section */}
      {movie.collection_name && (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Part of Collection
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Typography variant="body2" fontWeight={500}>
            {movie.collection_name}
          </Typography>
        </Paper>
      )}

      {/* Crew Section */}
      {(movie.directors?.length || movie.cinematographers?.length || movie.composers?.length) && (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Crew
          </Typography>
          <Divider sx={{ my: 1 }} />
          
          {movie.directors && movie.directors.length > 0 && (
            <Box sx={{ py: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Director</Typography>
              <Typography variant="body2" fontWeight={500}>
                {movie.directors.join(', ')}
              </Typography>
            </Box>
          )}
          
          {movie.writers && movie.writers.length > 0 && (
            <Box sx={{ py: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Writers</Typography>
              <Typography variant="body2" fontWeight={500}>
                {movie.writers.slice(0, 3).join(', ')}
              </Typography>
            </Box>
          )}
          
          {movie.cinematographers && movie.cinematographers.length > 0 && (
            <Box sx={{ py: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Cinematography</Typography>
              <Typography variant="body2" fontWeight={500}>
                {movie.cinematographers.join(', ')}
              </Typography>
            </Box>
          )}
          
          {movie.composers && movie.composers.length > 0 && (
            <Box sx={{ py: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Music</Typography>
              <Typography variant="body2" fontWeight={500}>
                {movie.composers.join(', ')}
              </Typography>
            </Box>
          )}
          
          {movie.editors && movie.editors.length > 0 && (
            <Box sx={{ py: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Editing</Typography>
              <Typography variant="body2" fontWeight={500}>
                {movie.editors.join(', ')}
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Keywords Section */}
      {movie.keywords && movie.keywords.length > 0 && (
        <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Keywords
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {movie.keywords.slice(0, 10).map((keyword) => (
              <Chip 
                key={keyword} 
                label={keyword} 
                size="small" 
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  )
}


