import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Tooltip,
  Collapse,
  IconButton,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { getProxiedImageUrl, FALLBACK_POSTER_URL } from '@aperture/ui'
import type { RecommendationInsights, MediaType } from '../types'

interface MovieInsightsProps {
  insights: RecommendationInsights
  mediaType?: MediaType
}

export function MovieInsights({ insights, mediaType = 'movie' }: MovieInsightsProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [insightsExpanded, setInsightsExpanded] = useState(true)

  if (!insights.isRecommended || !insights.isSelected) {
    return null
  }

  const isSeriesView = mediaType === 'series'
  const similarityTooltip = isSeriesView
    ? t('mediaDetail.insights.subtitleSeries')
    : t('mediaDetail.insights.subtitleMovie')

  return (
    <Box sx={{ mt: 4, px: 3 }}>
      <Paper
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
          border: '1px solid',
          borderColor: 'primary.main',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' },
          }}
          onClick={() => setInsightsExpanded(!insightsExpanded)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AutoAwesomeIcon sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {t('mediaDetail.insights.recommendedForYou')}
                <Chip
                  label={`#${insights.rank}`}
                  size="small"
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'white',
                    fontWeight: 700,
                    height: 22,
                  }}
                />
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('mediaDetail.insights.matchSubtitle', {
                  pct: Math.round((insights.scores?.final || 0) * 100),
                })}
              </Typography>
            </Box>
          </Box>
          <IconButton>
            {insightsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={insightsExpanded}>
          <Divider />
          <Box sx={{ p: 3 }}>
            {/* Score Breakdown */}
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              {t('mediaDetail.insights.howWeCalculated')}
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {/* Taste Similarity */}
              <Grid item xs={12} sm={6} md={3}>
                <Tooltip title={similarityTooltip} arrow>
                  <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <TrendingUpIcon sx={{ color: 'info.main', fontSize: 20 }} />
                      <Typography variant="body2" fontWeight={600}>{t('mediaDetail.insights.tasteMatch')}</Typography>
                    </Box>
                    <Typography variant="h4" fontWeight={700} color="info.main">
                      {insights.scores?.similarity != null
                        ? `${Math.round(insights.scores.similarity * 100)}%`
                        : t('mediaDetail.insights.na')}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(insights.scores?.similarity || 0) * 100}
                      sx={{ mt: 1, borderRadius: 1, bgcolor: 'grey.800', '& .MuiLinearProgress-bar': { bgcolor: 'info.main' } }}
                    />
                  </Paper>
                </Tooltip>
              </Grid>

              {/* Novelty Score */}
              <Grid item xs={12} sm={6} md={3}>
                <Tooltip title={t('mediaDetail.insights.tooltipDiscovery')} arrow>
                  <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <HubOutlinedIcon sx={{ color: 'success.main', fontSize: 20 }} />
                      <Typography variant="body2" fontWeight={600}>{t('mediaDetail.insights.discovery')}</Typography>
                    </Box>
                    <Typography variant="h4" fontWeight={700} color="success.main">
                      {insights.scores?.novelty != null
                        ? `${Math.round(insights.scores.novelty * 100)}%`
                        : t('mediaDetail.insights.na')}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(insights.scores?.novelty || 0) * 100}
                      sx={{ mt: 1, borderRadius: 1, bgcolor: 'grey.800', '& .MuiLinearProgress-bar': { bgcolor: 'success.main' } }}
                    />
                  </Paper>
                </Tooltip>
              </Grid>

              {/* Rating Score */}
              <Grid item xs={12} sm={6} md={3}>
                <Tooltip title={t('mediaDetail.insights.tooltipQuality')} arrow>
                  <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <ThumbUpIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                      <Typography variant="body2" fontWeight={600}>{t('mediaDetail.insights.quality')}</Typography>
                    </Box>
                    <Typography variant="h4" fontWeight={700} color="warning.main">
                      {insights.scores?.rating != null
                        ? `${Math.round(insights.scores.rating * 100)}%`
                        : t('mediaDetail.insights.na')}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(insights.scores?.rating || 0) * 100}
                      sx={{ mt: 1, borderRadius: 1, bgcolor: 'grey.800', '& .MuiLinearProgress-bar': { bgcolor: 'warning.main' } }}
                    />
                  </Paper>
                </Tooltip>
              </Grid>

              {/* Diversity Score */}
              <Grid item xs={12} sm={6} md={3}>
                <Tooltip title={t('mediaDetail.insights.tooltipVariety')} arrow>
                  <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <ShuffleIcon sx={{ color: 'secondary.main', fontSize: 20 }} />
                      <Typography variant="body2" fontWeight={600}>{t('mediaDetail.insights.variety')}</Typography>
                    </Box>
                    <Typography variant="h4" fontWeight={700} color="secondary.main">
                      {insights.scores?.diversity != null
                        ? `${Math.round(insights.scores.diversity * 100)}%`
                        : t('mediaDetail.insights.na')}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(insights.scores?.diversity || 0) * 100}
                      sx={{ mt: 1, borderRadius: 1, bgcolor: 'grey.800', '& .MuiLinearProgress-bar': { bgcolor: 'secondary.main' } }}
                    />
                  </Paper>
                </Tooltip>
              </Grid>
            </Grid>

            {/* Genre Analysis */}
            {insights.genreAnalysis && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  {t('mediaDetail.insights.genreAnalysis')}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {insights.genreAnalysis.matchingGenres.map((genre) => (
                    <Chip
                      key={genre}
                      label={genre}
                      size="small"
                      sx={{
                        bgcolor: 'success.main',
                        color: 'white',
                        fontWeight: 500,
                      }}
                      icon={<ThumbUpIcon sx={{ color: 'white !important', fontSize: 16 }} />}
                    />
                  ))}
                  {insights.genreAnalysis.newGenres.map((genre) => (
                    <Chip
                      key={genre}
                      label={genre}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: 'info.main', color: 'info.main' }}
                      icon={<HubOutlinedIcon sx={{ color: 'info.main', fontSize: 16 }} />}
                    />
                  ))}
                </Box>
                {insights.genreAnalysis.matchingGenres.length > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    <span style={{ color: '#4caf50', fontWeight: 600 }}>
                      {t('mediaDetail.insights.genresEnjoy', {
                        count: insights.genreAnalysis.matchingGenres.length,
                      })}
                    </span>
                    {insights.genreAnalysis.newGenres.length > 0 && (
                      <span style={{ color: '#2196f3', fontWeight: 600 }}>
                        {t('mediaDetail.insights.newGenresPart', {
                          count: insights.genreAnalysis.newGenres.length,
                        })}
                      </span>
                    )}
                  </Typography>
                )}
              </Box>
            )}

            {/* Evidence - Items that contributed to this recommendation */}
            {insights.evidence && insights.evidence.length > 0 && (
              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  {t('mediaDetail.insights.whyWeThink')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {isSeriesView
                    ? t('mediaDetail.insights.basedOnHistorySeries')
                    : t('mediaDetail.insights.basedOnHistoryMovie')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
                  {insights.evidence.map((ev) => {
                    const item = ev.similar_movie || ev.similar_series
                    if (!item) return null
                    const route = ev.similar_movie
                      ? `/movies/${item.id}`
                      : `/series/${item.id}`

                    return (
                      <Paper
                        key={ev.id}
                        onClick={() => navigate(route)}
                        sx={{
                          flexShrink: 0,
                          width: 120,
                          cursor: 'pointer',
                          borderRadius: 2,
                          overflow: 'hidden',
                          transition: 'transform 0.2s',
                          '&:hover': { transform: 'scale(1.05)' },
                          bgcolor: 'background.default',
                        }}
                      >
                        <Box sx={{ height: 160, bgcolor: 'grey.800', position: 'relative' }}>
                          <Box
                            component="img"
                            src={getProxiedImageUrl(item.poster_url)}
                            alt={item.title}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = FALLBACK_POSTER_URL
                            }}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <Chip
                            label={`${Math.round(ev.similarity * 100)}%`}
                            size="small"
                            sx={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              height: 20,
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              bgcolor: 'rgba(99, 102, 241, 0.9)',
                              color: 'white',
                            }}
                          />
                          <Chip
                            label={ev.evidence_type === 'favorite' ? '❤️' : ev.evidence_type === 'recent' ? '🕐' : '✓'}
                            size="small"
                            sx={{
                              position: 'absolute',
                              bottom: 4,
                              left: 4,
                              height: 20,
                              minWidth: 20,
                              fontSize: '0.7rem',
                              bgcolor: 'rgba(0,0,0,0.7)',
                            }}
                          />
                        </Box>
                        <Box sx={{ p: 1 }}>
                          <Typography variant="caption" fontWeight={500} noWrap display="block">
                            {item.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.year ?? t('mediaDetail.insights.na')}
                          </Typography>
                        </Box>
                      </Paper>
                    )
                  })}
                </Box>
              </Box>
            )}
          </Box>
        </Collapse>
      </Paper>
    </Box>
  )
}

