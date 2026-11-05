import { Box, Button, Chip, Paper, Typography } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { useTranslation } from 'react-i18next'
import { getProxiedImageUrl } from '@aperture/ui'
import type { ContentItem } from './types'

export function ContentCard({ item, onPlay }: { item: ContentItem; onPlay?: (id: string, href: string) => void }) {
  const { t } = useTranslation()
  const details = item.actions?.find((a) => a.id === 'details')
  const play = item.actions?.find((a) => a.id === 'play')
  return <Paper variant="outlined" sx={{ width: 170, flexShrink: 0, borderRadius: 3, overflow: 'hidden', bgcolor: 'background.paper', scrollSnapAlign: 'start', transition: 'transform .18s', '&:hover': { transform: 'translateY(-3px)' } }}>
    <Box component="a" href={details?.href} aria-label={item.name} sx={{ display: 'block', position: 'relative', aspectRatio: '2 / 3', bgcolor: 'action.hover', textDecoration: 'none' }}>
      {item.image ? <Box component="img" src={getProxiedImageUrl(item.image)} alt={item.name} loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary', p: 2 }}>{item.name}</Box>}
      {item.rank && <Chip size="small" label={`#${item.rank}`} sx={{ position: 'absolute', top: 8, insetInlineStart: 8, bgcolor: 'background.paper', fontWeight: 700 }} />}
    </Box>
    <Box sx={{ p: 1.5 }}>
      <Typography component="a" href={details?.href} variant="body2" fontWeight={650} sx={{ color: 'text.primary', textDecoration: 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 40 }}>{item.name}</Typography>
      <Typography variant="caption" color="text.secondary" noWrap component="div" sx={{ my: .5 }}>{item.subtitle}</Typography>
      {item.rating != null && <Box sx={{ display: 'flex', gap: .4, alignItems: 'center', mb: 1 }}><StarRoundedIcon sx={{ color: 'warning.main', fontSize: 16 }} /><Typography variant="caption">{Number(item.rating).toFixed(1)}</Typography></Box>}
      {play?.href && <Button size="small" fullWidth variant="outlined" startIcon={<PlayArrowIcon />} href={play.href} target="_blank" rel="noopener noreferrer" onClick={onPlay ? (e) => { e.preventDefault(); onPlay(item.id, play.href!) } : undefined} sx={{ borderRadius: 3 }}>{t('assistantToolUi.play')}</Button>}
    </Box>
  </Paper>
}
